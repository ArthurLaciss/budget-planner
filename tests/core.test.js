// Tests for the logic layer (js/core.js) and sign-in (js/auth.js). Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const TD = require('../js/core.js');
const Auth = require('../js/auth.js');

const cats = [
  { id: 'food', label: 'Food & Dining', kind: 'expense' },
  { id: 'salary', label: 'Salary', kind: 'income' },
  { id: 'inv', label: 'Investment', kind: 'both' },
];
const ctx = { today: '2026-10-10', categories: cats };
const good = { type: 'expense', amount: '12.50', date: '2026-10-10', category: 'food', description: 'Lunch', tags: [], notes: '' };
const errorsFor = patch => TD.validateTransaction(Object.assign({}, good, patch), ctx);

test('valid transaction passes', () => assert.deepEqual(errorsFor({}), []));

test('amount must be positive', () => {
  assert.ok(errorsFor({ amount: '0' }).length);
  assert.ok(errorsFor({ amount: '-5' }).length);
  assert.ok(errorsFor({ amount: '' }).length);
  assert.ok(errorsFor({ amount: 'abc' }).length);
});

test('amount limit is 7200 EUR (Latvian cash limit)', () => {
  assert.equal(TD.LIMITS.MAX_AMOUNT, 7200);
  assert.deepEqual(errorsFor({ amount: '7200' }), []);
  assert.ok(errorsFor({ amount: '7200.01' }).length);
  assert.ok(errorsFor({ amount: '9000' }).length);
});

test('amount has at most 2 decimals', () => {
  assert.deepEqual(errorsFor({ amount: '1.5' }), []);
  assert.ok(errorsFor({ amount: '1.505' }).length);
});

test('expense date cannot be in the future, income may be up to a year ahead', () => {
  assert.ok(errorsFor({ date: '2026-10-11' }).length);
  assert.deepEqual(errorsFor({ type: 'income', category: 'salary', date: '2026-12-01' }), []);
  assert.ok(errorsFor({ type: 'income', category: 'salary', date: '2028-01-01' }).length);
});

test('date must be real and not before 2000', () => {
  assert.ok(errorsFor({ date: '1999-12-31' }).length);
  assert.ok(errorsFor({ date: '2026-02-30' }).length);
  assert.ok(errorsFor({ date: '' }).length);
});

test('category must exist and fit the type', () => {
  assert.ok(errorsFor({ category: 'nope' }).length);
  assert.ok(errorsFor({ category: 'salary' }).length);
  assert.deepEqual(errorsFor({ category: 'inv' }), []);
});

test('text length limits', () => {
  assert.ok(errorsFor({ description: 'x'.repeat(101) }).length);
  assert.ok(errorsFor({ notes: 'x'.repeat(301) }).length);
  assert.ok(errorsFor({ tags: Array(11).fill('a') }).length);
});

test('date range: From must not be after To', () => {
  assert.equal(TD.validateDateRange('2026-01-01', '2026-02-01'), null);
  assert.ok(TD.validateDateRange('2026-03-01', '2026-02-01'));
  assert.ok(TD.validateDateRange('2026-13-01', ''));
});

test('budget amount and category name rules', () => {
  assert.equal(TD.checkBudgetAmount('250.5').error, null);
  assert.ok(TD.checkBudgetAmount('-1').error);
  assert.ok(TD.checkBudgetAmount('2000000').error);
  assert.equal(TD.validateCategoryName('Sports', ['Food']), null);
  assert.ok(TD.validateCategoryName('a', []));
  assert.ok(TD.validateCategoryName('food', ['Food']));
});

test('euro formatting', () => {
  assert.match(TD.formatMoney(1234.5), /1\s?234,50\s?€/);
});

test('CSV round trip and validation of imported rows', () => {
  const tx = [{ id: 'a', type: 'expense', amount: 12.5, description: 'Test, "q"', date: '2026-10-01', category: 'food', tags: ['x'], notes: '' }];
  const csv = TD.buildCSV(tx, id => cats.find(c => c.id === id).label);
  const res = TD.importTransactions(csv, cats, [], () => 'id1', '2026-10-10');
  assert.equal(res.added.length, 1);
  assert.equal(res.added[0].description, 'Test, "q"');
  const bad = 'Description,Amount,Type,Category,Date,Tags,Notes\nX,99999,expense,Food & Dining,2026-10-01,,\n';
  const r2 = TD.importTransactions(bad, cats, [], () => 'id2', '2026-10-10');
  assert.equal(r2.added.length, 0);
  assert.equal(r2.invalid, 1);
});

test('totals by category and per month', () => {
  const tx = [
    { type: 'expense', amount: 10, category: 'food', date: '2026-10-01' },
    { type: 'expense', amount: 5, category: 'food', date: '2026-09-01' },
    { type: 'income', amount: 100, category: 'salary', date: '2026-10-02' },
  ];
  assert.deepEqual(TD.totalsByCategory(tx, 'expense', '2026-10-01', '2026-10-31'), { food: 10 });
  assert.equal(TD.monthlyTotals(tx, ['2026-10'])[0].income, 100);
});

test('SHA-256 fallback equals Node crypto', async () => {
  const crypto = require('node:crypto');
  const text = Auth.SALT + 'admin';
  assert.equal(Auth.sha256Fallback(text), crypto.createHash('sha256').update(text).digest('hex'));
});

test('login: admin/admin works, others rejected', async () => {
  assert.equal((await Auth.login('admin', 'wrong')).ok, false);
  assert.equal((await Auth.login('user', 'admin')).ok, false);
  assert.equal((await Auth.login('admin', 'admin')).ok, true);
});
