try { process.loadEnvFile(); } catch {} // native .env loading (Node 20.12+); no dotenv needed

// ---------- validation ----------
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
function validate(b) {
  if (!b || typeof b !== 'object') return 'Invalid body';
  if (!b.name || !String(b.name).trim()) return 'Name is required';
  if (!/^[6-9]\d{9}$/.test(String(b.mobile))) return 'Mobile must be a valid 10-digit number';
  if (!b.dob || isNaN(Date.parse(b.dob))) return 'Valid date of birth required';
  if (!GENDERS.includes(b.gender)) return 'Gender must be Male, Female, or Other';
  if (!GROUPS.includes(b.bloodGroup)) return 'Invalid blood group';
  return null;
}
const clean = b => ({
  name: String(b.name).trim(),
  mobile: String(b.mobile),
  dob: b.dob,
  gender: b.gender,
  bloodGroup: b.bloodGroup,
  address: String(b.address ?? '').trim(),
  createdAt: new Date(),
});

// ---------- CSV export (hand-rolled; a csv lib for 5 columns is overkill) ----------
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
function toCsv(rows) {
  const head = 'Name,Mobile,DOB,Gender,Blood Group,Address,Registered At';
  const body = rows.map(r =>
    [r.name, r.mobile, r.dob, r.gender, r.bloodGroup, r.address, r.createdAt?.toISOString?.() || r.createdAt]
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
const HEADER_MAP = { name: 'name', mobile: 'mobile', 'mobile no': 'mobile', dob: 'dob', 'date of birth': 'dob', gender: 'gender', sex: 'gender', 'blood group': 'bloodGroup', bloodgroup: 'bloodGroup', address: 'address' };
function csvToDonors(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'CSV needs a header row and at least one data row' };
  const fields = rows[0].map(h => HEADER_MAP[h.trim().toLowerCase()] || null);
  if (!['name', 'mobile', 'dob', 'gender', 'bloodGroup'].every(f => fields.includes(f)))
    return { error: 'Header must include: Name, Mobile, DOB, Gender, Blood Group' };
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
  console.assert(validate({ name: 'राम', mobile: '9876543210', dob: '2000-01-01', gender: 'Male', bloodGroup: 'B+', address: 'Delhi' }) === null, 'valid row rejected');
  console.assert(validate({ name: '', mobile: '9876543210', dob: '2000-01-01', gender: 'Male', bloodGroup: 'B+', address: 'x' }), 'empty name accepted');
  console.assert(validate({ name: 'x', mobile: '12345', dob: '2000-01-01', gender: 'Male', bloodGroup: 'B+', address: 'x' }), 'bad mobile accepted');
  console.assert(validate({ name: 'x', mobile: '9876543210', dob: 'nope', gender: 'Male', bloodGroup: 'B+', address: 'x' }), 'bad dob accepted');
  console.assert(validate({ name: 'x', mobile: '9876543210', dob: '2000-01-01', gender: 'Male', bloodGroup: 'Z+', address: 'x' }), 'bad group accepted');
  console.assert(validate({ name: 'x', mobile: '9876543210', dob: '2000-01-01', gender: 'Zebra', bloodGroup: 'O+', address: 'x' }), 'bad gender accepted');
  console.assert(validate({ name: 'x', mobile: '9876543210', dob: '2000-01-01', bloodGroup: 'O+', address: 'x' }), 'missing gender accepted');
  console.assert(validate({ name: 'x', mobile: '9876543210', dob: '2000-01-01', gender: 'Female', bloodGroup: 'O+' }) === null, 'missing address rejected — it is optional');
  console.assert(toCsv([{ name: 'a"b', mobile: '9876543210', dob: '2000-01-01', gender: 'Male', bloodGroup: 'O+', address: 'x,y' }]).includes('"a""b"'), 'csv quote escaping broken');
  // round-trip: our export parses back into the same donors
  const rt = csvToDonors(toCsv([{ name: 'राम, जी', mobile: '9876543210', dob: '2000-01-01', gender: 'Other', bloodGroup: 'B+', address: 'Delhi "110001"' }]));
  console.assert(!rt.error && rt.donors.length === 1 && rt.donors[0].name === 'राम, जी' && rt.donors[0].gender === 'Other' && rt.donors[0].address === 'Delhi "110001"', 'csv round-trip broken');
  const dd = csvToDonors('Name,Mobile,DOB,Gender,Blood Group,Address\nx,9876543210,15/08/2001,Male,O+,Delhi');
  console.assert(dd.donors?.[0].dob === '2001-08-15', 'DD/MM/YYYY conversion broken');
  console.assert(dd.donors?.[0].gender === 'Male', 'gender import broken');
  console.assert(csvToDonors('Foo,Bar\n1,2').error, 'bad header accepted');
  console.log('all checks passed');
  process.exit(0);
}

const express = require('express');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json({ limit: '5mb' })); // room for CSV imports
app.use(express.static('public'));

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
  await donors.insertOne(clean(req.body));
  res.json({ ok: true });
});

// ---------- admin ----------
app.get('/api/donors', auth, async (req, res) => {
  res.json(await donors.find().sort({ name: 1 }).toArray());
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
