const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { API_SORT, sortDonors } = require('../public/admin-sort');

const donors = [
  { _id: '2', name: 'Zara', createdAt: '2026-08-10T10:00:00.000Z' },
  { _id: '1', name: 'Aman', createdAt: '2026-08-09T10:00:00.000Z' },
  { _id: '3', name: 'Mira' },
];

test('API_SORT requests newest registrations first with a stable ID tie-breaker', () => {
  assert.deepEqual(API_SORT, { createdAt: -1, _id: -1 });
  assert.equal(Object.isFrozen(API_SORT), true);

  const source = fs.readFileSync(path.join(__dirname, '../public/admin-sort.js'), 'utf8');
  const browserContext = {};
  vm.createContext(browserContext);
  vm.runInContext(source, browserContext);

  assert.equal(typeof browserContext.AdminDonorSort.sortDonors, 'function');
  assert.deepEqual(
    { ...browserContext.AdminDonorSort.API_SORT },
    { createdAt: -1, _id: -1 },
  );
  assert.equal(Object.isFrozen(browserContext.AdminDonorSort.API_SORT), true);
});

test('latest sort returns a new array without mutating the input', () => {
  const input = [donors[2], donors[1], donors[0]];
  const original = input.slice();

  const sorted = sortDonors(input);

  assert.deepEqual(sorted.map(({ _id }) => _id), ['2', '1', '3']);
  assert.notStrictEqual(sorted, input);
  assert.deepEqual(input, original);
});

test('date sorts keep malformed and missing timestamps after valid timestamps', () => {
  const withInvalidDate = [
    donors[2],
    { _id: '4', name: 'Invalid', createdAt: 'not-a-date' },
    donors[0],
    donors[1],
  ];

  assert.deepEqual(
    sortDonors(withInvalidDate, 'latest').map(({ _id }) => _id),
    ['2', '1', '4', '3'],
  );
  assert.deepEqual(
    sortDonors(withInvalidDate, 'oldest').map(({ _id }) => _id),
    ['1', '2', '3', '4'],
  );
});

test('name sort is case-insensitive with an ascending ID tie-breaker', () => {
  const equivalentNames = [
    { _id: '2', name: 'Alice' },
    { _id: '3', name: 'Bob' },
    { _id: '1', name: 'alice' },
  ];
  const sorted = sortDonors(equivalentNames, 'name');

  assert.deepEqual(sorted.map(({ name }) => name), ['alice', 'Alice', 'Bob']);
  assert.deepEqual(sorted.map(({ _id }) => _id), ['1', '2', '3']);
});

test('equal valid timestamps use ID descending for latest and ascending for oldest', () => {
  const sameDate = [
    { _id: '1', name: 'Aman', createdAt: '2026-08-10T10:00:00.000Z' },
    { _id: '3', name: 'Mira', createdAt: '2026-08-10T10:00:00.000Z' },
    { _id: '2', name: 'Zara', createdAt: '2026-08-10T10:00:00.000Z' },
  ];

  assert.deepEqual(
    sortDonors(sameDate, 'latest').map(({ _id }) => _id),
    ['3', '2', '1'],
  );
  assert.deepEqual(
    sortDonors(sameDate, 'oldest').map(({ _id }) => _id),
    ['1', '2', '3'],
  );
});

test('admin page provides the donor sort selector and wires it into rendering', () => {
  const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
  const sortScriptIndex = html.indexOf('<script src="/admin-sort.js"></script>');
  const appScriptIndex = html.search(/<script>\s*const GROUPS/);

  assert.notEqual(sortScriptIndex, -1);
  assert.notEqual(appScriptIndex, -1);
  assert.ok(sortScriptIndex < appScriptIndex);

  const select = html.match(/<select id="sort"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select);

  const options = [...select[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
    .map(([, value, label]) => [value, label.trim()]);
  assert.deepEqual(options, [
    ['latest', 'Latest first'],
    ['oldest', 'Oldest first'],
    ['name', 'Name A-Z'],
  ]);

  assert.match(html, /AdminDonorSort\.sortDonors\(filtered, sort\.value\)/);
  assert.match(html, /sort\.onchange = render;/);
});

test('server uses API_SORT for admin donors while preserving CSV name order', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

  assert.match(
    server,
    /const\s+\{\s*API_SORT\s*\}\s*=\s*require\(\s*['"]\.\/public\/admin-sort['"]\s*\)\s*;/,
  );
  assert.match(
    server,
    /app\.get\(\s*['"]\/api\/donors['"]\s*,\s*auth\s*,\s*async\s*\([^)]*\)\s*=>\s*\{\s*res\.json\(\s*await\s+donors\.find\(\s*\)\.sort\(\s*API_SORT\s*\)\.toArray\(\s*\)\s*\)\s*;\s*\}\s*\)/,
  );
  assert.match(
    server,
    /app\.get\(\s*['"]\/api\/donors\.csv['"]\s*,\s*auth\s*,\s*async\s*\([^)]*\)\s*=>\s*\{\s*const\s+rows\s*=\s*await\s+donors\.find\(\s*\)\.sort\(\s*\{\s*name\s*:\s*1\s*\}\s*\)\.toArray\(\s*\)\s*;/,
  );
});
