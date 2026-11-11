const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Simple password hashing using crypto (SHA-256)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Default admin password hash for "admin123"
const DEFAULT_ADMIN_HASH = hashPassword('admin123');

// Load database
function loadDb() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const db = JSON.parse(data);
            if (!db.admin || !db.admin.passwordHash) {
                db.admin = { passwordHash: DEFAULT_ADMIN_HASH };
            }
            return db;
        }
    } catch (e) {
        console.error('Error reading database:', e);
    }
    return {
        admin: { passwordHash: DEFAULT_ADMIN_HASH },
        settings: { defaultTarget: 50.00 },
        students: [],
        transactions: []
    };
}

// Save database
function saveDb(db) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// In-memory sessions (token -> { role, studentId })
const sessions = {};

function parseCookies(req) {
    const list = {};
    const rc = req.headers.cookie;
    if (rc && rc.length > 0) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
        });
    }
    return list;
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            let data = {};
            if (body) {
                try { data = JSON.parse(body); } catch (e) {}
            }

            const cookies = parseCookies(req);
            const token = cookies.sessionToken || req.headers['authorization']?.replace('Bearer ', '');
            const session = sessions[token];

            // 1. LOGIN
            if (pathname === '/api/login' && method === 'POST') {
                const { type, password, code } = data;
                const db = loadDb();

                if (type === 'admin') {
                    if (password && hashPassword(password) === db.admin.passwordHash) {
                        const newToken = crypto.randomBytes(16).toString('hex');
                        sessions[newToken] = { role: 'admin' };
                        res.setHeader('Set-Cookie', `sessionToken=${newToken}; Path=/; HttpOnly; SameSite=Lax`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, role: 'admin', token: newToken }));
                        return;
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Falsches Admin-Passwort.' }));
                        return;
                    }
                } else if (type === 'student') {
                    const student = db.students.find(s => s.code.trim().toUpperCase() === (code || '').trim().toUpperCase());
                    if (student) {
                        const newToken = crypto.randomBytes(16).toString('hex');
                        sessions[newToken] = { role: 'student', studentId: student.id };
                        res.setHeader('Set-Cookie', `sessionToken=${newToken}; Path=/; HttpOnly; SameSite=Lax`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, role: 'student', token: newToken, studentName: student.name }));
                        return;
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Ungültiger Zugangscode.' }));
                        return;
                    }
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Ungültige Anfrage.' }));
                return;
            }

            // 2. LOGOUT
            if (pathname === '/api/logout' && method === 'POST') {
                if (token && sessions[token]) {
                    delete sessions[token];
                }
                res.setHeader('Set-Cookie', 'sessionToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // 3. GET DATA
            if (pathname === '/api/data' && method === 'GET') {
                const db = loadDb();
                if (!session) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Nicht autorisiert.' }));
                    return;
                }

                if (session.role === 'admin') {
                    // Enrich students with total raised and transactions
                    const studentsWithStats = db.students.map(s => {
                        const sTxs = db.transactions.filter(t => t.studentId === s.id);
                        const raised = sTxs.reduce((sum, t) => sum + Number(t.amount), 0);
                        const target = s.target !== undefined ? s.target : db.settings.defaultTarget;
                        const missing = Math.max(0, target - raised);
                        const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 100;
                        return { ...s, raised, target, missing, percent, transactions: sTxs };
                    });

                    const totalRaised = studentsWithStats.reduce((sum, s) => sum + s.raised, 0);
                    const totalTarget = studentsWithStats.reduce((sum, s) => sum + s.target, 0);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        role: 'admin',
                        settings: db.settings,
                        students: studentsWithStats,
                        totalRaised,
                        totalTarget,
                        allTransactions: db.transactions
                    }));
                    return;
                } else if (session.role === 'student') {
                    const student = db.students.find(s => s.id === session.studentId);
                    if (!student) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Schüler nicht gefunden.' }));
                        return;
                    }
                    const sTxs = db.transactions.filter(t => t.studentId === student.id);
                    const raised = sTxs.reduce((sum, t) => sum + Number(t.amount), 0);
                    const target = student.target !== undefined ? student.target : db.settings.defaultTarget;
                    const missing = Math.max(0, target - raised);
                    const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 100;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        role: 'student',
                        student: {
                            id: student.id,
                            name: student.name,
                            target,
                            raised,
                            missing,
                            percent,
                            transactions: sTxs
                        }
                    }));
                    return;
                }
            }

            // 4. ADMIN: STUDENTS CRUD
            if (pathname === '/api/admin/students' && method === 'POST') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const { name, code, target } = data;
                if (!name || !code) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Name und Zugangscode sind erforderlich.' }));
                    return;
                }
                const db = loadDb();
                const newStudent = {
                    id: 'st-' + Date.now(),
                    name: name.trim(),
                    code: code.trim().toUpperCase(),
                    target: target !== undefined && target !== '' ? Number(target) : db.settings.defaultTarget
                };
                db.students.push(newStudent);
                saveDb(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, student: newStudent }));
                return;
            }

            if (pathname.startsWith('/api/admin/students/') && method === 'PUT') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const id = pathname.split('/').pop();
                const { name, code, target } = data;
                const db = loadDb();
                const student = db.students.find(s => s.id === id);
                if (!student) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Schüler nicht gefunden.' }));
                    return;
                }
                if (name) student.name = name.trim();
                if (code) student.code = code.trim().toUpperCase();
                if (target !== undefined) student.target = Number(target);
                saveDb(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, student }));
                return;
            }

            if (pathname.startsWith('/api/admin/students/') && method === 'DELETE') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const id = pathname.split('/').pop();
                const db = loadDb();
                db.students = db.students.filter(s => s.id !== id);
                db.transactions = db.transactions.filter(t => t.studentId !== id);
                saveDb(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // 5. ADMIN: TRANSACTIONS
            if (pathname === '/api/admin/transactions' && method === 'POST') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const { studentId, amount, description, date } = data;
                if (!studentId || amount === undefined) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Schüler und Betrag sind erforderlich.' }));
                    return;
                }
                const db = loadDb();
                const tx = {
                    id: 'tx-' + Date.now(),
                    studentId,
                    amount: Number(amount),
                    description: description || 'Einnahme',
                    date: date || new Date().toISOString().split('T')[0]
                };
                db.transactions.push(tx);
                saveDb(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, transaction: tx }));
                return;
            }

            if (pathname.startsWith('/api/admin/transactions/') && method === 'DELETE') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const id = pathname.split('/').pop();
                const db = loadDb();
                db.transactions = db.transactions.filter(t => t.id !== id);
                saveDb(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // 6. ADMIN: SETTINGS
            if (pathname === '/api/admin/settings' && method === 'PUT') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const { defaultTarget, newPassword } = data;
                const db = loadDb();
                if (defaultTarget !== undefined) {
                    db.settings.defaultTarget = Number(defaultTarget);
                }
                if (newPassword) {
                    db.admin.passwordHash = hashPassword(newPassword);
                }
                saveDb(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }

            // 7. ADMIN: CSV EXPORT
            if (pathname === '/api/admin/export' && method === 'GET') {
                if (!session || session.role !== 'admin') {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung.' }));
                    return;
                }
                const db = loadDb();
                let csv = 'Schüler;Zugangscode;Zielbetrag (€);Erwirtschaftet (€);Fehlend (€);Fortschritt (%);Anzahl Einnahmen\n';
                db.students.forEach(s => {
                    const sTxs = db.transactions.filter(t => t.studentId === s.id);
                    const raised = sTxs.reduce((sum, t) => sum + Number(t.amount), 0);
                    const target = s.target !== undefined ? s.target : db.settings.defaultTarget;
                    const missing = Math.max(0, target - raised);
                    const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 100;
                    csv += `"${s.name}";"${s.code}";"${target.toFixed(2).replace('.', ',')}";"${raised.toFixed(2).replace('.', ',')}";"${missing.toFixed(2).replace('.', ',')}";"${percent}%";"${sTxs.length}"\n`;
                });

                res.writeHead(200, {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="kursstufenkasse_export.csv"'
                });
                res.end('﻿' + csv); // BOM for Excel UTF-8
                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'API-Endpunkt nicht gefunden.' }));
        });
        return;
    }

    // Static File Serving
    let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, content404) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content404, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Kursstufenkasse Server läuft auf http://localhost:${PORT}`);
});
