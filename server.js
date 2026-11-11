require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// ─── KONFIGURATION ───
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ FEHLER: SUPABASE_URL und SUPABASE_SERVICE_KEY müssen in .env oder Render Environment Variables gesetzt sein!');
  console.error('   Erstelle eine .env Datei oder setze die Variablen in Render.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PORT = process.env.PORT || 3000;

// ─── HILFSFUNKTIONEN ───
function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

// Sessions im RAM (für 2 Jahre Betrieb okay, bei Skalierung → Redis)
const sessions = {};

function parseCookies(req) {
  const list = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) list[k] = decodeURIComponent(v.join('='));
  });
  return list;
}

async function getDefaultTarget() {
  const { data } = await supabase.from('settings').select('default_target').eq('id', 1).single();
  return data?.default_target ?? 50.00;
}

async function enrichStudents(students, transactions) {
  const defaultTarget = await getDefaultTarget();
  return students.map(s => {
    const sTxs = transactions.filter(t => t.student_id === s.id);
    const raised = sTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const target = s.target !== null && s.target !== undefined ? Number(s.target) : defaultTarget;
    const missing = Math.max(0, target - raised);
    const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 100;
    return { ...s, raised, target, missing, percent, transactions: sTxs };
  });
}

// ─── SERVER ───
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') return res.writeHead(204).end();

  // Body Parsing
  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(r => req.on('end', r));
  let data = {};
  if (body) {
    try { data = JSON.parse(body); } catch (e) { }
  }

  const cookies = parseCookies(req);
  const token = cookies.sessionToken || req.headers.authorization?.replace('Bearer ', '');
  const session = sessions[token];

  // ─── API ROUTES ───
  if (pathname.startsWith('/api/')) {
    // --- LOGIN ---
    if (pathname === '/api/login' && method === 'POST') {
      const { type, password, code } = data;

      if (type === 'admin') {
        const { data: admin, error } = await supabase.from('admin_auth').select('password_hash').eq('id', 1).single();
        if (!error && admin && hashPassword(password) === admin.password_hash) {
          const t = crypto.randomBytes(16).toString('hex');
          sessions[t] = { role: 'admin' };
          res.setHeader('Set-Cookie', `sessionToken=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
          return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, role: 'admin' }));
        }
        return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Falsches Admin-Passwort.' }));
      }

      if (type === 'student') {
        const { data: stu, error } = await supabase.from('students').select('id, name').eq('code', code?.toUpperCase().trim()).single();
        if (stu) {
          const t = crypto.randomBytes(16).toString('hex');
          sessions[t] = { role: 'student', studentId: stu.id };
          res.setHeader('Set-Cookie', `sessionToken=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
          return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, role: 'student', studentName: stu.name }));
        }
        return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Ungültiger Zugangscode.' }));
      }
      return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Ungültiger Logintyp.' }));
    }

    // --- LOGOUT ---
    if (pathname === '/api/logout' && method === 'POST') {
      if (token) delete sessions[token];
      res.setHeader('Set-Cookie', 'sessionToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
    }

    // --- AUTH CHECK ---
    if (!session) {
      return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Nicht autorisiert. Bitte neu einloggen.' }));
    }

    // --- GET DATA (Student & Admin) ---
    if (pathname === '/api/data' && method === 'GET') {
      const [studentsRes, txsRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('transactions').select('*')
      ]);

      if (studentsRes.error || txsRes.error) {
        console.error('DB Error:', studentsRes.error || txsRes.error);
        return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Datenbankfehler beim Laden.' }));
      }

      const enriched = await enrichStudents(studentsRes.data, txsRes.data);

      if (session.role === 'admin') {
        const { data: settings } = await supabase.from('settings').select('default_target').eq('id', 1).single();
        const totalRaised = enriched.reduce((a, b) => a + b.raised, 0);
        const totalTarget = enriched.reduce((a, b) => a + b.target, 0);
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          success: true, role: 'admin',
          settings: { defaultTarget: settings?.default_target ?? 50 },
          students: enriched,
          totalRaised,
          totalTarget,
          allTransactions: txsRes.data
        }));
      } else {
        const me = enriched.find(s => s.id === session.studentId);
        if (!me) return res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Schüler nicht gefunden.' }));
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, role: 'student', student: me }));
      }
    }

    // --- ADMIN ONLY CHECK ---
    if (session.role !== 'admin') {
      return res.writeHead(403, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Admin-Berechtigung erforderlich.' }));
    }

    // --- ADMIN: STUDENTS CRUD ---
    if (pathname === '/api/admin/students' && method === 'POST') {
      const { name, code, target } = data;
      if (!name?.trim() || !code?.trim()) {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Name und Zugangscode sind Pflicht.' }));
      }
      const defaultTarget = await getDefaultTarget();
      const newStudent = {
        id: generateId('st'),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        target: target !== undefined && target !== '' ? Number(target) : defaultTarget
      };
      const { error } = await supabase.from('students').insert(newStudent);
      if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, student: newStudent }));
    }

    if (pathname.startsWith('/api/admin/students/') && method === 'PUT') {
      const id = pathname.split('/').pop();
      const { name, code, target } = data;
      const updates = {};
      if (name) updates.name = name.trim();
      if (code) updates.code = code.trim().toUpperCase();
      if (target !== undefined && target !== '') updates.target = Number(target);
      else if (target === '') updates.target = null; // Reset to default

      const { error } = await supabase.from('students').update(updates).eq('id', id);
      if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
    }

    if (pathname.startsWith('/api/admin/students/') && method === 'DELETE') {
      const id = pathname.split('/').pop();
      const { error } = await supabase.from('students').delete().eq('id', id); // Cascade deletes transactions
      if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
    }

    // --- ADMIN: REGENERATE STUDENT CODE ---
    if (pathname.startsWith('/api/admin/students/') && pathname.endsWith('/regenerate-code') && method === 'POST') {
      const id = pathname.split('/')[pathname.split('/').length - 2];
      const newCode = generateCode();
      const { error } = await supabase.from('students').update({ code: newCode }).eq('id', id);
      if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, code: newCode }));
    }

    // --- ADMIN: TRANSACTIONS ---
    if (pathname === '/api/admin/transactions' && method === 'POST') {
      const { studentId, amount, description, date } = data;
      if (!studentId || amount === undefined || amount === '') {
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'Schüler und Betrag sind Pflicht.' }));
      }
      const newTx = {
        id: generateId('tx'),
        student_id: studentId,
        amount: Number(amount),
        description: description?.trim() || 'Einnahme',
        date: date || new Date().toISOString().split('T')[0]
      };
      const { error } = await supabase.from('transactions').insert(newTx);
      if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, transaction: newTx }));
    }

    if (pathname.startsWith('/api/admin/transactions/') && method === 'DELETE') {
      const id = pathname.split('/').pop();
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
    }

    // --- ADMIN: SETTINGS (Default Target & Admin Password) ---
    if (pathname === '/api/admin/settings' && method === 'PUT') {
      const { defaultTarget, newPassword } = data;
      if (defaultTarget !== undefined && defaultTarget !== '') {
        const { error } = await supabase.from('settings').update({ default_target: Number(defaultTarget) }).eq('id', 1);
        if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      }
      if (newPassword?.trim()) {
        const { error } = await supabase.from('admin_auth').update({ password_hash: hashPassword(newPassword.trim()) }).eq('id', 1);
        if (error) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: error.message }));
      }
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
    }

    // --- ADMIN: CSV EXPORT ---
    if (pathname === '/api/admin/export' && method === 'GET') {
      const [studentsRes, txsRes, settingsRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('settings').select('default_target').eq('id', 1).single()
      ]);

      const students = studentsRes.data || [];
      const txs = txsRes.data || [];
      const defaultTarget = settingsRes.data?.default_target ?? 50;

      let csv = 'Schüler;Zugangscode;Zielbetrag (€);Erwirtschaftet (€);Fehlend (€);Fortschritt (%);Anzahl Einnahmen\n';
      students.forEach(s => {
        const sTxs = txs.filter(t => t.student_id === s.id);
        const raised = sTxs.reduce((a, b) => a + Number(b.amount), 0);
        const target = s.target !== null && s.target !== undefined ? Number(s.target) : defaultTarget;
        const missing = Math.max(0, target - raised);
        const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 100;
        csv += `"${s.name}";"${s.code}";"${target.toFixed(2).replace('.', ',')}";"${raised.toFixed(2).replace('.', ',')}";"${missing.toFixed(2).replace('.', ',')}";"${pct}%";"${sTxs.length}"\n`;
      });

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kursstufenkasse_export.csv"'
      });
      return res.end('﻿' + csv); // UTF-8 BOM for Excel
    }

    return res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: false, error: 'API-Endpunkt nicht gefunden.' }));
  }

  // ─── STATIC FILE SERVING ───
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

  // Security: Prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    return res.writeHead(403).end('Forbidden');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA Fallback: serve index.html for client-side routing
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (e, c) => {
          if (e) return res.writeHead(500).end('Server Error');
          res.writeHead(200, { 'Content-Type': 'text/html' }).end(c);
        });
      } else {
        res.writeHead(500).end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': mime }).end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Kursstufenkasse Server läuft auf http://localhost:${PORT}`);
  console.log(`📊 Datenbank: Supabase (${SUPABASE_URL})`);
});