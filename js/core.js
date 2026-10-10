/* Budget Planner: pure logic (dates, money format, validation, CSV, backup checks).
 *
 * This file never touches the page (no DOM), so it can be tested with Node: `node --test tests/`.
 * Date, CSV and backup helpers are adapted from "Track Daily" by Yogabharathi (MIT licence, see LICENSE).
 * Validation rules (section "Validation") are written for this project and are described in the documentation.
 */
(function (root) {
  'use strict';

  /* ---------------- Limits used by validation ---------------- */

  const LIMITS = {
    MIN_AMOUNT: 0.01,
    // Latvian law "Par nodokļiem un nodevām", Article 30: cash transactions above 7200 EUR are not allowed.
    MAX_AMOUNT: 7200,
    MAX_BUDGET: 1000000,
    MIN_DATE: '2000-01-01',
    MAX_FUTURE_INCOME_DAYS: 365,
    MAX_DESCRIPTION: 100,
    MAX_NOTES: 300,
    MAX_TAGS: 10,
    MAX_TAG_LENGTH: 30,
    CATEGORY_NAME_MIN: 2,
    CATEGORY_NAME_MAX: 30,
    USERNAME_MAX: 30,
    PASSWORD_MAX: 64,
  };

  /* ---------------- Dates ---------------- */

  const pad = n => String(n).padStart(2, '0');

  /** Local-time YYYY-MM-DD (toISOString() would use UTC and could be a day off). */
  function toISODate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayISO() { return toISODate(new Date()); }

  /** True only for real calendar dates in the form YYYY-MM-DD (rejects 2026-02-31 and similar). */
  function isValidISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  /** Shifts a YYYY-MM-DD by a number of days. */
  function addDaysISO(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    return toISODate(new Date(y, m - 1, d + days));
  }

  /** 'YYYY-MM' shifted by delta months. */
  function addMonths(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  /** All 'YYYY-MM' keys from the month of `from` to the month of `to`; keeps only the last `maxCount`. */
  function monthsInRange(from, to, maxCount) {
    const out = [];
    let cur = from.slice(0, 7);
    const end = to.slice(0, 7);
    while (cur <= end && out.length < 1200) { out.push(cur); cur = addMonths(cur, 1); }
    return maxCount && out.length > maxCount ? out.slice(out.length - maxCount) : out;
  }

  /** True when `date` is inside the optional [from, to] range (empty bound = open). */
  function inRange(date, from, to) {
    return (!from || date >= from) && (!to || date <= to);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------------- Money and date formatting (Latvian format, euro) ---------------- */

  const moneyFmt = new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' });
  const moneyRoundFmt = new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  function formatMoney(n) { return moneyFmt.format(Number(n) || 0); }
  function formatMoneyRound(n) { return moneyRoundFmt.format(Math.round(Number(n) || 0)); }
  function formatDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('lv-LV', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function monthLabel(ym) {
    return new Date(ym + '-02T00:00:00').toLocaleDateString('lv-LV', { month: 'long', year: 'numeric' });
  }

  /* ---------------- Validation ---------------- */

  /** True when the number has at most two decimal places (12.5 and 12.50 pass, 12.505 does not). */
  function hasMax2Decimals(n) { return Math.abs(Math.round(n * 100) - n * 100) < 1e-7; }

  /**
   * Checks a money amount typed by the user (string) or read from a file (number).
   * Rules: a number, at least 0.01, at most MAX_AMOUNT, at most 2 decimal places.
   * Returns { value, error }; error is null when the amount is valid.
   */
  function checkAmount(raw, max) {
    const limit = max == null ? LIMITS.MAX_AMOUNT : max;
    const text = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (text === '') return { value: NaN, error: 'Enter an amount.' };
    if (!/^\d+(\.\d+)?$/.test(text)) return { value: NaN, error: 'Amount must be a positive number.' };
    const value = Number(text);
    if (!hasMax2Decimals(value)) return { value, error: 'Amount can have at most 2 decimal places.' };
    if (value < LIMITS.MIN_AMOUNT) return { value, error: 'Amount must be at least 0.01 EUR.' };
    if (value > limit) return { value, error: 'Amount cannot be more than ' + limit.toFixed(2) + ' EUR' + (limit === LIMITS.MAX_AMOUNT ? ' (cash payment limit in Latvia).' : '.') };
    return { value, error: null };
  }

  /**
   * Validates one transaction. `f` = { type, amount, description, date, category, tags, notes }.
   * `ctx` = { today: 'YYYY-MM-DD', categories: [{ id, kind }] }.
   * Returns a list of error messages (empty list = valid).
   */
  function validateTransaction(f, ctx) {
    const errors = [];
    if (f.type !== 'income' && f.type !== 'expense') errors.push('Type must be income or expense.');

    const a = checkAmount(f.amount);
    if (a.error) errors.push(a.error);

    if (!f.date) errors.push('Pick a date.');
    else if (!isValidISODate(f.date)) errors.push('Date is not valid.');
    else if (f.date < LIMITS.MIN_DATE) errors.push('Date cannot be before ' + LIMITS.MIN_DATE + '.');
    else if (f.type === 'expense' && f.date > ctx.today) errors.push('An expense date cannot be in the future.');
    else if (f.type === 'income' && f.date > addDaysISO(ctx.today, LIMITS.MAX_FUTURE_INCOME_DAYS)) errors.push('Income date cannot be more than 1 year ahead.');

    if (!f.category) errors.push('Choose a category.');
    else {
      const cat = ctx.categories.find(c => c.id === f.category);
      if (!cat) errors.push('Category does not exist.');
      else if (cat.kind !== 'both' && cat.kind !== f.type) errors.push('Category does not fit this transaction type.');
    }

    const description = String(f.description || '');
    if (description.length > LIMITS.MAX_DESCRIPTION) errors.push('Description is too long (max ' + LIMITS.MAX_DESCRIPTION + ' characters).');
    if ((f.notes || '').length > LIMITS.MAX_NOTES) errors.push('Notes are too long (max ' + LIMITS.MAX_NOTES + ' characters).');
    const tags = f.tags || [];
    if (tags.length > LIMITS.MAX_TAGS) errors.push('Use at most ' + LIMITS.MAX_TAGS + ' tags.');
    else if (tags.some(t => t.length > LIMITS.MAX_TAG_LENGTH)) errors.push('Each tag can have at most ' + LIMITS.MAX_TAG_LENGTH + ' characters.');
    return errors;
  }

  /** Date range filter: both dates optional, but when given they must be real dates and From <= To. Returns an error or null. */
  function validateDateRange(from, to) {
    if (from && !isValidISODate(from)) return 'The "From" date is not valid.';
    if (to && !isValidISODate(to)) return 'The "To" date is not valid.';
    if (from && to && from > to) return 'The "From" date must not be after the "To" date.';
    return null;
  }

  /** Monthly budget amount: a number from 0 up to MAX_BUDGET with at most 2 decimals. Returns { value, error }. */
  function checkBudgetAmount(raw) {
    const text = String(raw == null ? '' : raw).trim().replace(',', '.');
    if (text === '') return { value: 0, error: null };
    if (!/^\d+(\.\d+)?$/.test(text)) return { value: 0, error: 'Budget must be a positive number.' };
    const value = Number(text);
    if (!hasMax2Decimals(value)) return { value, error: 'Budget can have at most 2 decimal places.' };
    if (value > LIMITS.MAX_BUDGET) return { value, error: 'Budget cannot be more than ' + LIMITS.MAX_BUDGET + ' EUR.' };
    return { value, error: null };
  }

  /** Custom category name: 2-30 characters (letters, digits, spaces, & ' -), unique ignoring case. Returns an error or null. */
  function validateCategoryName(name, existingLabels) {
    const n = String(name || '').trim();
    if (n.length < LIMITS.CATEGORY_NAME_MIN) return 'Category name must have at least ' + LIMITS.CATEGORY_NAME_MIN + ' characters.';
    if (n.length > LIMITS.CATEGORY_NAME_MAX) return 'Category name can have at most ' + LIMITS.CATEGORY_NAME_MAX + ' characters.';
    if (!/^[\p{L}\p{N}][\p{L}\p{N} &'\-]*$/u.test(n)) return 'Category name can contain only letters, digits, spaces and & \' -.';
    if (existingLabels.some(l => l.toLowerCase() === n.toLowerCase())) return 'A category with this name already exists.';
    return null;
  }

  /** Sign-in form check (format only, not the password itself). Returns an error or null. */
  function validateLoginInput(username, password) {
    if (!String(username || '').trim()) return 'Enter a username.';
    if (!password) return 'Enter a password.';
    if (username.length > LIMITS.USERNAME_MAX) return 'Username is too long.';
    if (password.length > LIMITS.PASSWORD_MAX) return 'Password is too long.';
    return null;
  }

  /* ---------------- CSV ---------------- */

  /** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at the start of a text cell). */
  function csvEscape(value) {
    let s = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  const CSV_HEADER = ['Description', 'Amount', 'Type', 'Category', 'Date', 'Tags', 'Notes'];

  function buildCSV(transactions, categoryLabel) {
    const rows = transactions.map(t => [
      csvEscape(t.description), t.amount, t.type, csvEscape(categoryLabel(t.category)),
      t.date, csvEscape((t.tags || []).join('|')), csvEscape(t.notes || ''),
    ]);
    return [CSV_HEADER.join(',')].concat(rows.map(r => r.join(','))).join('\n');
  }

  /** RFC 4180-style parser: quoted fields may contain commas, quotes and newlines. Returns an array of rows. */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], cur = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.some(v => v.trim() !== '')) rows.push(row);
    return rows;
  }

  /** Undo the leading apostrophe csvEscape adds, so export -> import round-trips. */
  function unescapeCell(s) {
    return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
  }

  function txKey(t) {
    return [t.date, t.type, Number(t.amount).toFixed(2), String(t.description).trim().toLowerCase()].join('|');
  }

  /**
   * Turns CSV text into transactions. Rows that fail the same validation as the add form (amount limits,
   * date rules, ...) are skipped, and so are exact duplicates (same date, type, amount and description).
   */
  function importTransactions(text, categories, existing, makeId, today) {
    const rows = parseCSV(text);
    const result = { added: [], invalid: 0, duplicates: 0 };
    if (rows.length < 2) return result;
    const seen = new Set((existing || []).map(txKey));
    const ctx = { today: today || todayISO(), categories };
    rows.slice(1).forEach(r => {
      const description = unescapeCell((r[0] || '').trim());
      const type = (r[2] || '').trim().toLowerCase() === 'income' ? 'income' : 'expense';
      const label = unescapeCell((r[3] || '').trim()).toLowerCase();
      const match = categories.find(c => c.label.toLowerCase() === label && (c.kind === 'both' || c.kind === type));
      const category = match ? match.id : (type === 'income' ? 'other_income' : 'other_expense');
      const date = (r[4] || '').trim();
      const tags = (r[5] || '').split('|').map(s => unescapeCell(s.trim())).filter(Boolean);
      const notes = unescapeCell((r[6] || '').trim());
      const amountText = String(r[1] || '').replace(/,/g, '');
      const fields = { type, amount: amountText, description, date, category, tags, notes };
      if (!description || validateTransaction(fields, ctx).length) { result.invalid++; return; }
      const tx = { id: makeId(), description, amount: Number(amountText), type, category, date, tags, notes };
      const key = txKey(tx);
      if (seen.has(key)) { result.duplicates++; return; }
      seen.add(key);
      result.added.push(tx);
    });
    return result;
  }

  /* ---------------- Totals ---------------- */

  /** Sum of amounts per category for one transaction type inside an optional date range. */
  function totalsByCategory(transactions, type, from, to) {
    const out = {};
    transactions.forEach(t => {
      if (t.type === type && inRange(t.date, from, to)) out[t.category] = (out[t.category] || 0) + t.amount;
    });
    return out;
  }

  /** Expense totals per category for one month ('YYYY-MM'). */
  function spentByCategory(transactions, ym) {
    return totalsByCategory(transactions, 'expense', ym + '-01', ym + '-31');
  }

  /** Income and expense total for each month key in the list. */
  function monthlyTotals(transactions, months) {
    return months.map(ym => {
      let income = 0, expense = 0;
      transactions.forEach(t => {
        if (t.date.slice(0, 7) !== ym) return;
        if (t.type === 'income') income += t.amount; else if (t.type === 'expense') expense += t.amount;
      });
      return { month: ym, income, expense };
    });
  }

  /* ---------------- Backup (JSON) ---------------- */

  /** Structural check of a JSON backup before it is allowed to replace the data in the browser. */
  function validateBackup(b) {
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(b) || b.app !== 'budget-planner') return false;
    if (!Array.isArray(b.transactions) || !Array.isArray(b.customCategories) || !isObj(b.budgets)) return false;
    return b.transactions.every(t => isObj(t) && typeof t.id === 'string' && typeof t.description === 'string' &&
      (t.type === 'income' || t.type === 'expense') && !checkAmount(t.amount).error && isValidISODate(t.date) && typeof t.category === 'string') &&
      b.customCategories.every(k => isObj(k) && typeof k.id === 'string' && typeof k.label === 'string');
  }

  const api = {
    LIMITS, toISODate, todayISO, isValidISODate, addDaysISO, addMonths, monthsInRange, inRange, escapeHtml,
    formatMoney, formatMoneyRound, formatDate, monthLabel,
    checkAmount, validateTransaction, validateDateRange, checkBudgetAmount, validateCategoryName, validateLoginInput,
    csvEscape, buildCSV, parseCSV, importTransactions,
    totalsByCategory, spentByCategory, monthlyTotals, validateBackup,
  };
  root.TD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
