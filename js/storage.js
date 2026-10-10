/* Budget Planner: data storage.
 *
 * Everything is kept in the browser's localStorage as JSON text (no database, nothing is sent anywhere).
 * This file only reads and writes data; it knows nothing about the page.
 */
(function (root) {
  'use strict';

  const KEYS = {
    transactions: 'bp_transactions_v1',
    budgets: 'bp_budgets_v1',
    categories: 'bp_custom_categories_v1',
    theme: 'bp_theme',
  };

  const isArray = Array.isArray;
  const isObject = v => v && typeof v === 'object' && !isArray(v);
  const isTransaction = t => isObject(t) && typeof t.id === 'string' && typeof t.date === 'string' &&
    (t.type === 'income' || t.type === 'expense') && Number.isFinite(Number(t.amount));

  function readRaw(key) {
    try { return root.localStorage.getItem(key); } catch (e) { return null; }
  }
  /** Returns true when the value was saved, false when the browser blocked or filled its storage. */
  function writeRaw(key, value) {
    try { root.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  /** Reads JSON from storage; falls back to an empty value when the data is missing or damaged. */
  function readJSON(key, makeEmpty, isValid) {
    const raw = readRaw(key);
    if (raw === null) return makeEmpty();
    try {
      const value = JSON.parse(raw);
      if (isValid(value)) return value;
    } catch (e) { /* damaged data: use the empty value */ }
    return makeEmpty();
  }

  /** Loads all saved data: { transactions, budgets, customCategories }. */
  function load() {
    const transactions = readJSON(KEYS.transactions, () => [], isArray).filter(isTransaction);
    transactions.forEach(t => { t.amount = Number(t.amount); });
    return {
      transactions,
      budgets: readJSON(KEYS.budgets, () => ({}), isObject),
      customCategories: readJSON(KEYS.categories, () => [], isArray),
    };
  }

  const saveTransactions = list => writeRaw(KEYS.transactions, JSON.stringify(list));
  const saveBudgets = obj => writeRaw(KEYS.budgets, JSON.stringify(obj));
  const saveCustomCategories = list => writeRaw(KEYS.categories, JSON.stringify(list));

  const getTheme = () => readRaw(KEYS.theme) || 'light';
  const setTheme = theme => writeRaw(KEYS.theme, theme);

  root.DataStore = { load, saveTransactions, saveBudgets, saveCustomCategories, getTheme, setTheme };
})(window);
