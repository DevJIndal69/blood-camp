# Optional Blood Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make blood group optional for public registration, admin editing, and CSV imports while continuing to reject invalid non-empty values.

**Architecture:** Keep blood-group rules in the existing server validation and cleaning functions so every write path shares one normalized representation. Update the existing public and admin HTML controls without introducing new modules, and extend the existing dependency-free self-check and Node test suite to cover the behavior.

**Tech Stack:** Node.js 20, vanilla JavaScript, HTML/CSS, Node built-in test runner, Express, MongoDB

---

## File Structure

- Modify `server.js`: accept empty blood groups, normalize them to `''`, relax the CSV header requirement, and extend the server self-check.
- Modify `public/index.html`: remove the browser-required constraint and label blood group as optional.
- Modify `admin.html`: add a blank `Not provided` choice in edit mode.
- Modify `test/admin-sort.test.js`: add source-level integration checks for the public and admin controls.

### Task 1: Optional Server Validation And CSV Import

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add failing server self-check assertions**

In the `if (process.argv.includes('--check'))` block, add these assertions after the existing blood-group validation assertion:

```js
assert.equal(validate({ ...valid, bloodGroup: '' }), null, 'empty blood group rejected');
assert.equal(validate({ ...valid, bloodGroup: '   ' }), null, 'blank blood group rejected');
assert.equal(validate({ ...valid, bloodGroup: undefined }), null, 'missing blood group rejected');
assert.equal(clean({ ...valid, bloodGroup: undefined }).bloodGroup, '', 'missing blood group not normalized');
assert.equal(clean({ ...valid, bloodGroup: '   ' }).bloodGroup, '', 'blank blood group not normalized');
```

Add CSV assertions near the existing import checks:

```js
const noGroupHeader = csvToDonors(
  'Name,Guardian Name,Mobile,DOB,Gender,Address\nx,y,9876543210,2001-08-15,Male,Delhi'
);
assert.equal(noGroupHeader.error, undefined, 'CSV without blood group header rejected');
assert.equal(noGroupHeader.donors?.[0].bloodGroup, undefined, 'absent blood group header created a value');
assert.equal(
  clean(noGroupHeader.donors?.[0]).bloodGroup,
  '',
  'CSV without blood group header not normalized'
);

const blankGroupCell = csvToDonors(
  'Name,Guardian Name,Mobile,DOB,Gender,Blood Group\nx,y,9876543210,2001-08-15,Male,'
);
assert.equal(validate(blankGroupCell.donors?.[0]), null, 'blank CSV blood group rejected');
assert.equal(clean(blankGroupCell.donors?.[0]).bloodGroup, '', 'blank CSV blood group not normalized');

const invalidGroupCell = csvToDonors(
  'Name,Guardian Name,Mobile,DOB,Gender,Blood Group\nx,y,9876543210,2001-08-15,Male,Z+'
);
assert.equal(validate(invalidGroupCell.donors?.[0]), 'Invalid blood group', 'invalid CSV blood group accepted');
```

- [ ] **Step 2: Run the server check to verify RED**

Run:

```powershell
npm.cmd run check
```

Expected: FAIL because empty blood groups are rejected and the CSV header still requires Blood Group.

- [ ] **Step 3: Allow and normalize optional blood groups**

Update `validate()`:

```js
const bloodGroup = String(b.bloodGroup ?? '').trim();
if (bloodGroup && !GROUPS.includes(bloodGroup)) return 'Invalid blood group';
```

Replace the existing direct `GROUPS.includes(b.bloodGroup)` check with the code above.

Update `clean()`:

```js
bloodGroup: String(b.bloodGroup ?? '').trim(),
```

- [ ] **Step 4: Relax the required CSV header list**

Change the required field check in `csvToDonors()`:

```js
if (!['name', 'guardianName', 'mobile', 'dob', 'gender'].every(f => fields.includes(f)))
  return { error: 'Header must include: Name, Guardian Name, Mobile, DOB, Gender' };
```

Keep `HEADER_MAP` support for `blood group` and `bloodgroup`, so the column is still parsed when supplied.

- [ ] **Step 5: Run checks to verify GREEN**

Run:

```powershell
npm.cmd run check
npm.cmd test
```

Expected: server prints `all checks passed`; all existing Node tests pass.

- [ ] **Step 6: Commit server behavior**

```powershell
git add server.js
git commit -m "make blood group optional in server flows"
```

### Task 2: Public And Admin Optional Controls

**Files:**
- Modify: `test/admin-sort.test.js`
- Modify: `public/index.html`
- Modify: `admin.html`

- [ ] **Step 1: Write failing HTML integration tests**

Append these tests to `test/admin-sort.test.js`:

```js
test('public registration marks blood group optional', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const field = html.match(
    /<label>[^<]*Blood Group[\s\S]*?<\/label>\s*<select name="bloodGroup"([^>]*)>([\s\S]*?)<\/select>/
  );

  assert.ok(field, 'blood group field not found');
  assert.doesNotMatch(field[1], /\brequired\b/);
  assert.match(field[0], /optional/i);
  assert.match(field[2], /<option value="">/);
});

test('admin edit mode allows blood group to remain unprovided', () => {
  const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

  assert.match(
    html,
    /<option value="" \$\{!d\.bloodGroup \? 'selected' : ''\}>Not provided<\/option>/
  );
  assert.match(html, /<select class="group-sel">/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd test
```

Expected: two new tests fail because the public selector is required and admin edit mode has no blank option.

- [ ] **Step 3: Make the public selector optional**

In `public/index.html`, update the label and selector:

```html
<label>
  रक्त समूह / Blood Group
  <span style="font-weight:400;color:var(--muted)">(वैकल्पिक / optional)</span>
</label>
<select name="bloodGroup">
  <option value="">-- चुनें --</option>
  <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
  <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
</select>
```

- [ ] **Step 4: Add the admin blank edit choice**

In the admin edit-row template, update the blood-group cell:

```js
<td><select class="group-sel"><option value="" ${!d.bloodGroup ? 'selected' : ''}>Not provided</option>${GROUPS.map(g => `<option ${g === d.bloodGroup ? 'selected' : ''}>${g}</option>`).join('')}</select></td>
```

- [ ] **Step 5: Run tests and server checks to verify GREEN**

Run:

```powershell
npm.cmd test
npm.cmd run check
```

Expected: all Node tests pass and the server prints `all checks passed`.

- [ ] **Step 6: Commit UI behavior**

```powershell
git add public/index.html admin.html test/admin-sort.test.js
git commit -m "make blood group optional in donor forms"
```

### Task 3: Final Verification

**Files:**
- Verify: `server.js`
- Verify: `public/index.html`
- Verify: `admin.html`
- Verify: `test/admin-sort.test.js`

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm.cmd test
npm.cmd run check
git diff --check HEAD~2
```

Expected: all Node tests pass, the server prints `all checks passed`, and Git reports no whitespace errors.

- [ ] **Step 2: Review the final change set**

Run:

```powershell
git status --short
git log -4 --oneline
git diff HEAD~2 -- server.js public/index.html admin.html test/admin-sort.test.js
```

Expected: the working tree is clean, both implementation commits are present, and the diff contains only optional blood-group behavior and its tests.
