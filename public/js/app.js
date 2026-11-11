/* ==========================================================================
   KURSSTUFENKASSE - CLIENT APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // Helper: Format Currency (e.g. 50.00 -> "50,00 €")
    function formatCurrency(val) {
        const num = Number(val) || 0;
        return num.toFixed(2).replace('.', ',') + ' €';
    }

    // Navigation & Views
    const viewLogin = document.getElementById('view-login');
    const viewStudent = document.getElementById('view-student');
    const viewAdmin = document.getElementById('view-admin');

    const headerUserInfo = document.getElementById('header-user-info');
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');

    function showView(viewId) {
        [viewLogin, viewStudent, viewAdmin].forEach(v => v.classList.remove('active'));
        if (viewId === 'login') {
            viewLogin.classList.add('active');
            headerUserInfo.classList.add('hidden');
        } else if (viewId === 'student') {
            viewStudent.classList.add('active');
            headerUserInfo.classList.remove('hidden');
        } else if (viewId === 'admin') {
            viewAdmin.classList.add('active');
            headerUserInfo.classList.remove('hidden');
        }
    }

    // Login Tabs Switcher
    const lTabBtns = document.querySelectorAll('.l-tab-btn');
    const loginForms = document.querySelectorAll('.login-form');

    lTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            lTabBtns.forEach(b => b.classList.remove('active'));
            loginForms.forEach(f => f.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 1. LOGIN SUBMISSION
    const studentLoginForm = document.getElementById('student-login-form');
    const adminLoginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');

    function showError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
    }

    function hideError() {
        loginError.classList.add('hidden');
    }

    studentLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const code = document.getElementById('student-code').value.trim();

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'student', code })
            });
            const data = await res.json();
            if (data.success) {
                userDisplayName.textContent = `Schüler: ${data.studentName}`;
                loadDashboardData();
            } else {
                showError(data.error || 'Login fehlgeschlagen.');
            }
        } catch (err) {
            showError('Verbindungsfehler zum Server.');
        }
    });

    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const password = document.getElementById('admin-password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'admin', password })
            });
            const data = await res.json();
            if (data.success) {
                userDisplayName.textContent = 'Administrator';
                loadDashboardData();
            } else {
                showError(data.error || 'Falsches Passwort.');
            }
        } catch (err) {
            showError('Verbindungsfehler zum Server.');
        }
    });

    // LOGOUT
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showView('login');
    });

    // 2. LOAD DASHBOARD DATA
    async function loadDashboardData() {
        try {
            const res = await fetch('/api/data');
            if (res.status === 401) {
                showView('login');
                return;
            }
            const data = await res.json();

            if (data.role === 'student') {
                renderStudentDashboard(data.student);
                showView('student');
            } else if (data.role === 'admin') {
                renderAdminDashboard(data);
                showView('admin');
            }
        } catch (err) {
            console.error('Fehler beim Laden der Daten:', err);
        }
    }

    // RENDER STUDENT DASHBOARD
    function renderStudentDashboard(st) {
        document.getElementById('student-welcome-title').textContent = `Hallo, ${st.name}!`;
        document.getElementById('st-target-val').textContent = formatCurrency(st.target);
        document.getElementById('st-raised-val').textContent = formatCurrency(st.raised);
        document.getElementById('st-missing-val').textContent = formatCurrency(st.missing);
        document.getElementById('st-percent-val').textContent = `${st.percent}%`;

        document.getElementById('st-progress-fill').style.width = `${st.percent}%`;

        const tbody = document.getElementById('st-tx-tbody');
        tbody.innerHTML = '';

        if (!st.transactions || st.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--gray-muted);">Noch keine Einnahmen gebucht.</td></tr>';
            return;
        }

        st.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date}</td>
                <td>${tx.description}</td>
                <td><strong>+${formatCurrency(tx.amount)}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // RENDER ADMIN DASHBOARD
    function renderAdminDashboard(data) {
        document.getElementById('adm-total-raised').textContent = formatCurrency(data.totalRaised);
        document.getElementById('adm-total-target').textContent = formatCurrency(data.totalTarget);
        document.getElementById('adm-total-students').textContent = data.students.length;

        // Populate Student Table
        const stTbody = document.getElementById('adm-students-tbody');
        stTbody.innerHTML = '';

        // Populate Select Dropdown for adding transaction
        const select = document.getElementById('tx-student-select');
        select.innerHTML = '<option value="">-- Schüler wählen --</option>';

        data.students.forEach(st => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${st.name}</strong></td>
                <td><span class="code-badge">${st.code}</span></td>
                <td>${formatCurrency(st.target)}</td>
                <td><strong style="color: var(--sky-700);">${formatCurrency(st.raised)}</strong></td>
                <td>${formatCurrency(st.missing)}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="flex:1; height:8px; background:var(--sky-100); border-radius:4px; overflow:hidden;">
                            <div style="width:${st.percent}%; height:100%; background:var(--sky-600);"></div>
                        </div>
                        <span style="font-size:0.8rem; font-weight:700;">${st.percent}%</span>
                    </div>
                </td>
                <td>
                    <button class="btn-action-sm btn-edit-st" data-id="${st.id}" data-name="${st.name}" data-code="${st.code}" data-target="${st.target}">Bearbeiten</button>
                    <button class="btn-action-sm btn-regen-code" data-id="${st.id}" title="Neuen Zugangscode generieren">🔄 Code</button>
                    <button class="btn-action-sm danger btn-del-st" data-id="${st.id}">Löschen</button>
                </td>
            `;
            stTbody.appendChild(tr);

            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = st.name;
            select.appendChild(opt);
        });

        // Event listeners for Edit / Delete Student
        document.querySelectorAll('.btn-edit-st').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.getAttribute('data-id');
                const name = b.getAttribute('data-name');
                const code = b.getAttribute('data-code');
                const target = b.getAttribute('data-target');
                openStudentModal({ id, name, code, target });
            });
        });

        document.querySelectorAll('.btn-del-st').forEach(b => {
            b.addEventListener('click', async () => {
                if (confirm('Möchtest du diesen Schüler und alle zugehörigen Einnahmen wirklich löschen?')) {
                    const id = b.getAttribute('data-id');
                    await fetch(`/api/admin/students/${id}`, { method: 'DELETE' });
                    loadDashboardData();
                }
            });
        });

        // Regenerate Code Buttons
        document.querySelectorAll('.btn-regen-code').forEach(b => {
            b.addEventListener('click', async () => {
                if (confirm('Möchtest du einen neuen Zugangscode generieren? Der alte Code wird ungültig.')) {
                    const id = b.getAttribute('data-id');
                    const res = await fetch(`/api/admin/students/${id}/regenerate-code`, { method: 'POST' });
                    if (res.ok) {
                        loadDashboardData();
                    }
                }
            });
        });

        // Populate All Transactions History
        const txTbody = document.getElementById('adm-all-tx-tbody');
        txTbody.innerHTML = '';

        if (!data.allTransactions || data.allTransactions.length === 0) {
            txTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--gray-muted);">Bisher wurden keine Einnahmen gebucht.</td></tr>';
            return;
        }

        const studentMap = {};
        data.students.forEach(s => studentMap[s.id] = s.name);

        data.allTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date}</td>
                <td><strong>${studentMap[tx.studentId] || 'Unbekannt'}</strong></td>
                <td>${tx.description}</td>
                <td><strong style="color: var(--sky-700);">+${formatCurrency(tx.amount)}</strong></td>
                <td>
                    <button class="btn-action-sm danger btn-del-tx" data-id="${tx.id}">Stornieren</button>
                </td>
            `;
            txTbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-del-tx').forEach(b => {
            b.addEventListener('click', async () => {
                if (confirm('Möchtest du diese Einnahme-Buchung wirklich stornieren?')) {
                    const id = b.getAttribute('data-id');
                    await fetch(`/api/admin/transactions/${id}`, { method: 'DELETE' });
                    loadDashboardData();
                }
            });
        });
    }

    // 3. ADMIN FORMS & MODALS
    const addTxForm = document.getElementById('add-transaction-form');
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];

    addTxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = document.getElementById('tx-student-select').value;
        const amount = document.getElementById('tx-amount').value;
        const description = document.getElementById('tx-desc').value;
        const date = document.getElementById('tx-date').value;

        const res = await fetch('/api/admin/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, amount, description, date })
        });
        if (res.ok) {
            addTxForm.reset();
            document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
            loadDashboardData();
        }
    });

    // Student Modal
    const studentModal = document.getElementById('student-modal');
    const studentForm = document.getElementById('student-form');

    document.getElementById('add-student-modal-btn').addEventListener('click', () => {
        openStudentModal();
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        studentModal.classList.add('hidden');
    });

    function openStudentModal(st = null) {
        document.getElementById('edit-student-id').value = st ? st.id : '';
        document.getElementById('modal-student-name').value = st ? st.name : '';
        document.getElementById('modal-student-code').value = st ? st.code : generateRandomCode();
        document.getElementById('modal-student-target').value = st ? st.target : '';
        document.getElementById('modal-title').textContent = st ? 'Schüler bearbeiten' : 'Neuen Schüler hinzufügen';
        studentModal.classList.remove('hidden');
    }

    document.getElementById('gen-code-btn').addEventListener('click', () => {
        document.getElementById('modal-student-code').value = generateRandomCode();
    });

    function generateRandomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let res = '';
        for (let i = 0; i < 4; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return res;
    }

    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-student-id').value;
        const name = document.getElementById('modal-student-name').value;
        const code = document.getElementById('modal-student-code').value;
        const target = document.getElementById('modal-student-target').value;

        let res;
        if (id) {
            res = await fetch(`/api/admin/students/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, code, target })
            });
        } else {
            res = await fetch('/api/admin/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, code, target })
            });
        }

        if (res.ok) {
            studentModal.classList.add('hidden');
            loadDashboardData();
        }
    });

    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('open-settings-btn').addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const defaultTarget = document.getElementById('set-default-target').value;
        const newPassword = document.getElementById('set-new-password').value;

        const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultTarget, newPassword })
        });
        if (res.ok) {
            settingsModal.classList.add('hidden');
            loadDashboardData();
        }
    });

    // CSV Export
    document.getElementById('export-csv-btn').addEventListener('click', () => {
        window.location.href = '/api/admin/export';
    });

    // Check auto login session on startup
    loadDashboardData();
});
