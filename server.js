try { process.loadEnvFile(); } catch {} // native .env loading (Node 20.12+); no dotenv needed

// ---------- validation ----------
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
function validate(b) {
  if (!b || typeof b !== 'object') return 'Invalid body';
  if (!b.name || !String(b.name).trim()) return 'Name is required';
  if (!b.guardianName || !String(b.guardianName).trim()) return 'Father/Guardian name is required';
  if (!/^[6-9]\d{9}$/.test(String(b.mobile))) return 'Mobile must be a valid 10-digit number';
  if (!b.dob || isNaN(Date.parse(b.dob))) return 'Valid date of birth required';
  if (!GENDERS.includes(b.gender)) return 'Gender must be Male, Female, or Other';
  const bloodGroup = String(b.bloodGroup ?? '').trim();
  if (bloodGroup && !GROUPS.includes(bloodGroup)) return 'Invalid blood group';
  return null;
}
const clean = b => ({
  name: String(b.name).trim(),
  guardianName: String(b.guardianName).trim(),
  mobile: String(b.mobile),
  dob: b.dob,
  gender: b.gender,
  bloodGroup: String(b.bloodGroup ?? '').trim(),
  address: String(b.address ?? '').trim(),
  note: String(b.note ?? '').trim(), // admin-only, optional
  createdAt: new Date(),
});

// ---------- CSV export (hand-rolled; a csv lib for 5 columns is overkill) ----------
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
function toCsv(rows) {
  const head = 'Name,Guardian Name,Mobile,DOB,Gender,Blood Group,Address,Registered At';
  const body = rows.map(r =>
    [r.name, r.guardianName, r.mobile, r.dob, r.gender, r.bloodGroup, r.address, r.createdAt?.toISOString?.() || r.createdAt]
      .map(csvCell).join(','));
  return '﻿' + [head, ...body].join('\r\n'); // BOM so Hindi opens right in Excel
}

// ---------- CSV parse (handles quotes/commas/newlines — matches our own export format) ----------
function parseCsv(text) {
  text = text.replace(/^﻿/, ''); // strip BOM
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

// header names -> our field names (accepts export headers or bare names, any case)
const HEADER_MAP = {
  name: 'name',
  'guardian name': 'guardianName',
  'father name': 'guardianName',
  "father's name": 'guardianName',
  'father/guardian name': 'guardianName',
  mobile: 'mobile',
  'mobile no': 'mobile',
  dob: 'dob',
  'date of birth': 'dob',
  gender: 'gender',
  sex: 'gender',
  'blood group': 'bloodGroup',
  bloodgroup: 'bloodGroup',
  address: 'address',
};
function csvToDonors(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'CSV needs a header row and at least one data row' };
  const fields = rows[0].map(h => HEADER_MAP[h.trim().toLowerCase()] || null);
  if (!['name', 'guardianName', 'mobile', 'dob', 'gender'].every(f => fields.includes(f)))
    return { error: 'Header must include: Name, Guardian Name, Mobile, DOB, Gender' };
  return {
    donors: rows.slice(1).map(r => {
      const o = {};
      fields.forEach((f, i) => { if (f) o[f] = (r[i] ?? '').trim(); });
      const m = o.dob?.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/); // DD/MM/YYYY -> ISO
      if (m) o.dob = `${m[3]}-${m[2]}-${m[1]}`;
      return o;
    }),
  };
}


// ---------- self-check: `node server.js --check` (no deps, no DB needed) ----------
if (process.argv.includes('--check')) {
  const assert = require('node:assert/strict');
  const valid = { name: 'राम', guardianName: 'श्याम', mobile: '9876543210', dob: '2000-01-01', gender: 'Male', bloodGroup: 'B+', address: 'Delhi' };
  assert.equal(validate(valid), null, 'valid row rejected');
  assert.equal(validate({ ...valid, name: '' }), 'Name is required', 'empty name accepted');
  assert.equal(validate({ ...valid, guardianName: undefined }), 'Father/Guardian name is required', 'missing guardian name accepted');
  assert.equal(validate({ ...valid, guardianName: '   ' }), 'Father/Guardian name is required', 'blank guardian name accepted');
  assert.ok(validate({ ...valid, mobile: '12345' }), 'bad mobile accepted');
  assert.ok(validate({ ...valid, dob: 'nope' }), 'bad dob accepted');
  assert.ok(validate({ ...valid, bloodGroup: 'Z+' }), 'bad group accepted');
  assert.equal(validate({ ...valid, bloodGroup: '' }), null, 'empty blood group rejected');
  assert.equal(validate({ ...valid, bloodGroup: '   ' }), null, 'blank blood group rejected');
  assert.equal(validate({ ...valid, bloodGroup: undefined }), null, 'missing blood group rejected');
  assert.equal(clean({ ...valid, bloodGroup: undefined }).bloodGroup, '', 'missing blood group not normalized');
  assert.equal(clean({ ...valid, bloodGroup: '   ' }).bloodGroup, '', 'blank blood group not normalized');
  assert.ok(validate({ ...valid, gender: 'Zebra' }), 'bad gender accepted');
  assert.ok(validate({ ...valid, gender: undefined }), 'missing gender accepted');
  assert.equal(validate({ ...valid, address: undefined }), null, 'missing address rejected — it is optional');
  assert.equal(clean({ ...valid, guardianName: '  श्याम  ' }).guardianName, 'श्याम', 'guardian name not trimmed');
  assert.ok(toCsv([{ ...valid, name: 'a"b', address: 'x,y' }]).includes('"a""b"'), 'csv quote escaping broken');
  assert.ok(toCsv([valid]).includes('Name,Guardian Name,Mobile,DOB,Gender,Blood Group,Address,Registered At'), 'csv column order broken');
  // round-trip: our export parses back into the same donors
  const rt = csvToDonors(toCsv([{ ...valid, name: 'राम, जी', guardianName: 'श्याम, जी', gender: 'Other', address: 'Delhi "110001"' }]));
  assert.ok(!rt.error && rt.donors.length === 1 && rt.donors[0].name === 'राम, जी' && rt.donors[0].guardianName === 'श्याम, जी' && rt.donors[0].gender === 'Other' && rt.donors[0].address === 'Delhi "110001"', 'csv round-trip broken');
  const dd = csvToDonors("Name,Father's Name,Mobile,DOB,Gender,Blood Group,Address\nx,y,9876543210,15/08/2001,Male,O+,Delhi");
  assert.equal(dd.donors?.[0].dob, '2001-08-15', 'DD/MM/YYYY conversion broken');
  assert.equal(dd.donors?.[0].gender, 'Male', 'gender import broken');
  assert.equal(dd.donors?.[0].guardianName, 'y', 'guardian name alias import broken');
  for (const alias of ['Guardian Name', 'Father Name', "Father's Name", 'Father/Guardian Name']) {
    const imported = csvToDonors(`Name,${alias.toUpperCase()},Mobile,DOB,Gender,Blood Group\nx,y,9876543210,2001-08-15,Male,O+`);
    assert.equal(imported.donors?.[0].guardianName, 'y', `${alias} import alias broken`);
  }
  assert.ok(csvToDonors('Name,Mobile,DOB,Gender,Blood Group\nx,9876543210,2001-08-15,Male,O+').error, 'missing guardian name header accepted');
  const noGroupHeader = csvToDonors(
    'Name,Guardian Name,Mobile,DOB,Gender,Address\nx,y,9876543210,2001-08-15,Male,Delhi'
  );
  assert.equal(noGroupHeader.error, undefined, 'CSV without blood group header rejected');
  assert.equal(noGroupHeader.donors?.[0].bloodGroup, undefined, 'absent blood group header created a value');
  assert.equal(clean(noGroupHeader.donors?.[0]).bloodGroup, '', 'CSV without blood group header not normalized');
  const blankGroupCell = csvToDonors(
    'Name,Guardian Name,Mobile,DOB,Gender,Blood Group\nx,y,9876543210,2001-08-15,Male,'
  );
  assert.equal(validate(blankGroupCell.donors?.[0]), null, 'blank CSV blood group rejected');
  assert.equal(clean(blankGroupCell.donors?.[0]).bloodGroup, '', 'blank CSV blood group not normalized');
  const invalidGroupCell = csvToDonors(
    'Name,Guardian Name,Mobile,DOB,Gender,Blood Group\nx,y,9876543210,2001-08-15,Male,Z+'
  );
  assert.equal(validate(invalidGroupCell.donors?.[0]), 'Invalid blood group', 'invalid CSV blood group accepted');
  assert.ok(csvToDonors('Foo,Bar\n1,2').error, 'bad header accepted');
  console.log('all checks passed');
  process.exit(0);
}

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { API_SORT } = require('./public/admin-sort');

const app = express();
app.use(express.json({ limit: '5mb' })); // room for CSV imports
app.use(express.static(path.join(__dirname, 'public'))); // absolute path — cwd differs on Vercel

let donors; // Mongo collection, set on startup

// ---------- auth (in-memory tokens; ponytail: restart logs everyone out, fine for a camp) ----------
const tokens = new Set();
function auth(req, res, next) {
  const t = (req.headers.cookie || '').match(/token=([\w-]+)/)?.[1];
  if (t && tokens.has(t)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// admin page lives OUTSIDE public/ — only served here, after a token check
app.get('/admin.html', (req, res) => {
  const t = (req.headers.cookie || '').match(/token=([\w-]+)/)?.[1];
  if (t && tokens.has(t)) return res.sendFile(require('path').join(__dirname, 'admin.html'));
  res.redirect('/');
});

app.post('/api/login', (req, res) => {
  const { user, pass } = req.body || {};
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    const t = crypto.randomUUID();
    tokens.add(t);
    res.setHeader('Set-Cookie', `token=${t}; HttpOnly; Path=/; Max-Age=28800`);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong username or password' });
});

// ---------- public: register ----------
// health check (also pings DB so it fails if Mongo is down)
app.get('/api/health', async (req, res) => {
  try {
    await donors.findOne({}, { projection: { _id: 1 } });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post('/api/register', async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  // duplicate: only discard when BOTH name + guardianName match (case-insensitive)
  const dup = await donors.findOne({
    name:         { $regex: `^${String(req.body.name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    guardianName: { $regex: `^${String(req.body.guardianName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  if (dup) return res.status(409).json({ error: 'यह व्यक्ति पहले से पंजीकृत है / Already registered' });
  await donors.insertOne(clean(req.body));
  res.json({ ok: true });
});

// ---------- admin ----------
app.get('/api/donors', auth, async (req, res) => {
  res.json(await donors.find().sort(API_SORT).toArray());
});

app.put('/api/donors/:id', auth, async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const { createdAt, ...fields } = clean(req.body);
  await donors.updateOne({ _id: new ObjectId(req.params.id) }, { $set: fields });
  res.json({ ok: true });
});

app.delete('/api/donors/:id', auth, async (req, res) => {
  await donors.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
});

app.get('/api/donors.csv', auth, async (req, res) => {
  const rows = await donors.find().sort({ name: 1 }).toArray();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="blood-camp-donors.csv"');
  res.send(toCsv(rows));
});

// ---------- CSV import: adds only rows whose mobile no. isn't already in the DB ----------
app.post('/api/import', auth, express.text({ type: '*/*', limit: '5mb' }), async (req, res) => {
  const parsed = csvToDonors(req.body || '');
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const existing = new Set((await donors.find({}, { projection: { mobile: 1 } }).toArray()).map(d => d.mobile));
  const report = { added: 0, skipped: 0, invalid: [] };
  const toInsert = [];

  parsed.donors.forEach((d, i) => {
    const err = validate(d);
    if (err) return report.invalid.push(`Row ${i + 2}: ${err}`); // +2 = header + 1-based
    if (existing.has(String(d.mobile))) return report.skipped++;
    existing.add(String(d.mobile)); // catch duplicates inside the file too
    toInsert.push(clean(d));
  });

  if (toInsert.length) await donors.insertMany(toInsert);
  report.added = toInsert.length;
  res.json(report);
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
new MongoClient(process.env.MONGODB_URI).connect()
  .then(client => {
    donors = client.db(process.env.DB_NAME || 'bloodcamp').collection('donors');
    app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
  })
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
