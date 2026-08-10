# Admin Donor Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin sorting selector that defaults to latest registrations first and supports oldest-first and name A-Z ordering.

**Architecture:** Put the donor ordering rules and MongoDB default sort specification in a small UMD module that works in both the browser and Node.js tests. The admin page will filter its loaded donor array, pass the result through this module, and render it immediately; the server will reuse the module's default MongoDB sort for `/api/donors`.

**Tech Stack:** Node.js 20 built-in test runner, vanilla JavaScript, HTML/CSS, Express, MongoDB

---

## File Structure

- Create `public/admin-sort.js`: shared sort modes, timestamp handling, deterministic comparators, and default MongoDB sort.
- Create `test/admin-sort.test.js`: behavior tests for sorting plus integration checks for admin markup and server route usage.
- Modify `admin.html`: load the sort module, add the selector, and apply the selected order after search filtering.
- Modify `server.js`: use the shared latest-first MongoDB sort for the admin donors endpoint.
- Modify `package.json`: add a `test` script using Node's built-in test runner.

### Task 1: Shared Donor Sorting Rules

**Files:**
- Create: `test/admin-sort.test.js`
- Create: `public/admin-sort.js`
- Modify: `package.json`

- [ ] **Step 1: Add the test command**

Add this script to `package.json`:

```json
"scripts": {
  "start": "node server.js",
  "check": "node server.js --check",
  "test": "node --test"
}
```

- [ ] **Step 2: Write failing sorting tests**

Create `test/admin-sort.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  API_SORT,
  sortDonors,
} = require('../public/admin-sort');

const donors = [
  { _id: '2', name: 'Zara', createdAt: '2026-08-10T10:00:00.000Z' },
  { _id: '1', name: 'Aman', createdAt: '2026-08-09T10:00:00.000Z' },
  { _id: '3', name: 'Mira' },
];

test('uses latest registration order for the admin API', () => {
  assert.deepEqual(API_SORT, { createdAt: -1, _id: -1 });
});

test('sorts latest registrations first without mutating input', () => {
  const input = [donors[2], donors[1], donors[0]];
  const result = sortDonors(input, 'latest');

  assert.deepEqual(result.map(d => d._id), ['2', '1', '3']);
  assert.deepEqual(input.map(d => d._id), ['3', '1', '2']);
  assert.notStrictEqual(result, input);
});

test('sorts oldest registrations first and keeps missing dates last', () => {
  const result = sortDonors(donors, 'oldest');
  assert.deepEqual(result.map(d => d._id), ['1', '2', '3']);
});

test('sorts donor names A-Z', () => {
  const result = sortDonors(donors, 'name');
  assert.deepEqual(result.map(d => d.name), ['Aman', 'Mira', 'Zara']);
});

test('uses identifiers to order equal timestamps deterministically', () => {
  const equalDates = [
    { _id: '1', name: 'First', createdAt: '2026-08-10T10:00:00.000Z' },
    { _id: '2', name: 'Second', createdAt: '2026-08-10T10:00:00.000Z' },
  ];

  assert.deepEqual(sortDonors(equalDates, 'latest').map(d => d._id), ['2', '1']);
  assert.deepEqual(sortDonors(equalDates, 'oldest').map(d => d._id), ['1', '2']);
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
npm.cmd test
```

Expected: FAIL with `Cannot find module '../public/admin-sort'`.

- [ ] **Step 4: Implement the minimal shared sorting module**

Create `public/admin-sort.js`:

```js
(function attachAdminDonorSort(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AdminDonorSort = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAdminDonorSort() {
  const API_SORT = Object.freeze({ createdAt: -1, _id: -1 });

  const idOf = donor => String(donor?._id ?? '');
  const timestampOf = donor => {
    const value = Date.parse(donor?.createdAt);
    return Number.isNaN(value) ? null : value;
  };

  function compareByDate(a, b, direction) {
    const aTime = timestampOf(a);
    const bTime = timestampOf(b);
    if (aTime === null && bTime === null) return idOf(a).localeCompare(idOf(b)) * direction;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    if (aTime !== bTime) return (aTime - bTime) * direction;
    return idOf(a).localeCompare(idOf(b)) * direction;
  }

  function sortDonors(donors, mode = 'latest') {
    return [...donors].sort((a, b) => {
      if (mode === 'oldest') return compareByDate(a, b, 1);
      if (mode === 'name') {
        const byName = String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, {
          sensitivity: 'base',
        });
        return byName || idOf(a).localeCompare(idOf(b));
      }
      return compareByDate(a, b, -1);
    });
  }

  return { API_SORT, sortDonors };
});
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit the shared sorting behavior**

```powershell
git add package.json public/admin-sort.js test/admin-sort.test.js
git commit -m "add donor sorting rules"
```

### Task 2: Admin Sorting Selector

**Files:**
- Modify: `test/admin-sort.test.js`
- Modify: `admin.html`

- [ ] **Step 1: Write a failing admin integration test**

Append to `test/admin-sort.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

test('admin page provides and applies the donor sort selector', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

  assert.match(html, /<script src="\/admin-sort\.js"><\/script>/);
  assert.match(html, /<select id="sort"/);
  assert.match(html, /<option value="latest">Latest first<\/option>/);
  assert.match(html, /<option value="oldest">Oldest first<\/option>/);
  assert.match(html, /<option value="name">Name A-Z<\/option>/);
  assert.match(html, /AdminDonorSort\.sortDonors\(filtered, sort\.value\)/);
  assert.match(html, /sort\.onchange = render/);
});
```

- [ ] **Step 2: Run the integration test to verify RED**

Run:

```powershell
npm.cmd test
```

Expected: FAIL because `admin.html` does not contain the sort script or selector.

- [ ] **Step 3: Add selector styling and markup**

In `admin.html`, load the helper before the inline application script:

```html
<script src="/admin-sort.js"></script>
<script>
```

Extend the existing `.bar input` rules to style both controls:

```css
.bar input, .bar select {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  font: inherit;
  background: var(--field);
  color: var(--ink);
}
.bar input { flex: 1; min-width: 180px; }
.bar select { min-width: 150px; }
.bar input:focus, .bar select:focus {
  outline: 0;
  border-color: var(--crimson);
  box-shadow: 0 0 0 4px var(--ring);
}
```

Add the selector immediately after the search field:

```html
<select id="sort" aria-label="Sort donors">
  <option value="latest">Latest first</option>
  <option value="oldest">Oldest first</option>
  <option value="name">Name A-Z</option>
</select>
```

- [ ] **Step 4: Apply sorting after filtering**

Replace the list calculation in `render()`:

```js
const filtered = data.filter(d =>
  !q || [d.name, d.guardianName, d.mobile, d.gender, d.bloodGroup]
    .join(' ')
    .toLowerCase()
    .includes(q)
);
const list = AdminDonorSort.sortDonors(filtered, sort.value);
```

Wire selection changes to the existing render function:

```js
search.oninput = render;
sort.onchange = render;
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit the admin selector**

```powershell
git add admin.html test/admin-sort.test.js
git commit -m "add admin donor sort selector"
```

### Task 3: Latest-First Admin API

**Files:**
- Modify: `test/admin-sort.test.js`
- Modify: `server.js`

- [ ] **Step 1: Write a failing server integration check**

Append to `test/admin-sort.test.js`:

```js
test('server uses the shared latest-first order for the admin donors API', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  assert.match(source, /const \{ API_SORT \} = require\('\.\/public\/admin-sort'\);/);
  assert.match(source, /donors\.find\(\)\.sort\(API_SORT\)\.toArray\(\)/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd test
```

Expected: FAIL because `server.js` still sorts `/api/donors` by name.

- [ ] **Step 3: Reuse the shared API sort**

Near the other top-level imports in `server.js`, add:

```js
const { API_SORT } = require('./public/admin-sort');
```

Update only the admin JSON endpoint:

```js
app.get('/api/donors', auth, async (req, res) => {
  res.json(await donors.find().sort(API_SORT).toArray());
});
```

Leave CSV export sorted by name.

- [ ] **Step 4: Run focused and existing checks**

Run:

```powershell
npm.cmd test
npm.cmd run check
```

Expected: 7 tests pass, followed by `all checks passed`.

- [ ] **Step 5: Commit the API ordering**

```powershell
git add server.js test/admin-sort.test.js
git commit -m "default admin donors to latest first"
```

### Task 4: Final Verification

**Files:**
- Verify: `admin.html`
- Verify: `public/admin-sort.js`
- Verify: `server.js`
- Verify: `test/admin-sort.test.js`

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm.cmd test
npm.cmd run check
git diff --check HEAD~3
```

Expected: all 7 tests pass, the server self-check prints `all checks passed`, and Git reports no whitespace errors.

- [ ] **Step 2: Review the final change set**

Run:

```powershell
git status --short
git log -4 --oneline
git diff HEAD~3 -- admin.html public/admin-sort.js server.js package.json test/admin-sort.test.js
```

Expected: the working tree is clean, the three implementation commits are present, and the diff contains only sorting-related changes.
