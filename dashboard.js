/* =========================================================
   ADMIN DASHBOARD — WorkHive (Enhanced)
========================================================= */

let ADMIN_PROFILE = null;
let ALL_JOBS = [];
let ALL_APPLICATIONS = [];
let ALL_JOBSEEKERS = [];
let ALL_EMPLOYERS = [];

document.addEventListener('DOMContentLoaded', async () => {
    ADMIN_PROFILE = await requireRole('admin');
    if (!ADMIN_PROFILE) return;

    const emailEl = document.getElementById('userEmail');
    const initEl = document.getElementById('userInitial');
    if (emailEl) emailEl.textContent = ADMIN_PROFILE.email;
    if (initEl) initEl.textContent = ADMIN_PROFILE.email.charAt(0).toUpperCase();

    await loadAdminData();
    wireAdminSearch();
});

window.addEventListener('pageshow', async function (event) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) window.location.replace('index.html');
});

/* ─── DATA ─────────────────────────────────────────────── */
async function loadAdminData() {
    const [{ data: jobs }, { data: apps }, { data: seekers }, { data: employers }] = await Promise.all([
        supabaseClient.from('jobs').select('*, profiles!jobs_employer_id_fkey(company_name, full_name)').order('created_at', { ascending: false }),
        supabaseClient.from('applications').select('*, jobs(title), profiles!applications_applicant_id_fkey(full_name, username, email)').order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*').eq('role', 'jobseeker').order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*').eq('role', 'employer').order('created_at', { ascending: false })
    ]);

    ALL_JOBS = jobs || [];
    ALL_APPLICATIONS = apps || [];
    ALL_JOBSEEKERS = seekers || [];
    ALL_EMPLOYERS = employers || [];

    renderStats();
    renderSummary();
    renderOverviewCandidates();
    renderJobs();
    renderApplications();
    renderJobSeekers();
    renderEmployers();
    updateAppsBadge();
}

function updateAppsBadge() {
    const pending = ALL_APPLICATIONS.filter(a => a.status === 'pending').length;
    const badge = document.getElementById('appsBadge');
    if (!badge) return;
    if (pending > 0) {
        badge.textContent = pending;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderStats() {
    const activeJobs = ALL_JOBS.filter(j => j.status === 'active').length;
    const shortlisted = ALL_APPLICATIONS.filter(a => a.status === 'shortlisted').length;
    const interviews = ALL_APPLICATIONS.filter(a => a.status === 'interview').length;
    document.getElementById('statActiveJobs').textContent = activeJobs;
    document.getElementById('statTotalApplicants').textContent = ALL_APPLICATIONS.length;
    document.getElementById('statShortlisted').textContent = shortlisted;
    document.getElementById('statInterviews').textContent = interviews;
}

function renderSummary() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('summaryJobSeekers', ALL_JOBSEEKERS.length);
    set('summaryEmployers', ALL_EMPLOYERS.length);
    set('summaryJobs', ALL_JOBS.length);
    set('summaryAccepted', ALL_APPLICATIONS.filter(a => a.status === 'accepted').length);

    // update chart bars proportionally
    const counts = {
        pending: ALL_APPLICATIONS.filter(a => a.status === 'pending').length,
        shortlisted: ALL_APPLICATIONS.filter(a => a.status === 'shortlisted').length,
        interview: ALL_APPLICATIONS.filter(a => a.status === 'interview').length,
        accepted: ALL_APPLICATIONS.filter(a => a.status === 'accepted').length,
        rejected: ALL_APPLICATIONS.filter(a => a.status === 'rejected').length
    };
    const max = Math.max(...Object.values(counts), 1);
    const bars = document.querySelectorAll('#adminMiniChart .bar');
    const vals = Object.values(counts);
    bars.forEach((bar, i) => {
        bar.style.height = Math.max(8, Math.round((vals[i] / max) * 100)) + '%';
        bar.title = Object.keys(counts)[i] + ': ' + vals[i];
    });
}

/* ─── STATUS BADGE ──────────────────────────────────────── */
function statusBadge(status) {
    const map = {
        pending:    { cls: 'bg-amber-50 text-amber-700 border border-amber-200',    icon: 'fa-clock' },
        shortlisted:{ cls: 'bg-blue-50 text-blue-700 border border-blue-200',       icon: 'fa-list-check' },
        interview:  { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'fa-handshake' },
        rejected:   { cls: 'bg-red-50 text-red-600 border border-red-200',          icon: 'fa-xmark' },
        accepted:   { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'fa-check' }
    };
    const s = status || 'pending';
    const def = map[s] || { cls: 'bg-gray-100 text-gray-600', icon: 'fa-circle' };
    return `<span class="pill-badge ${def.cls}"><i class="fa-solid ${def.icon} text-[9px]"></i>${s}</span>`;
}

/* ─── OVERVIEW CANDIDATES ────────────────────────────────── */
function renderOverviewCandidates() {
    const body = document.getElementById('overviewCandidatesBody');
    if (!body) return;
    const rows = ALL_APPLICATIONS.slice(0, 7);
    body.innerHTML = rows.map(rowForApplication).join('') ||
        '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-400 text-xs">No applications yet.</td></tr>';
}

function avatarInitials(name) {
    return (name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function rowForApplication(a) {
    const name = a.profiles ? (a.profiles.full_name || a.profiles.username) : 'Unknown';
    const initials = avatarInitials(name);
    return `
    <tr data-searchable data-status="${a.status || 'pending'}" class="table-row border-b border-gray-50 dark:border-gray-800">
        <td class="px-5 py-3.5">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-[10px] flex-shrink-0">${initials}</div>
                <span class="font-medium text-gray-800 dark:text-gray-200">${esc(name)}</span>
            </div>
        </td>
        <td class="px-5 py-3.5 text-gray-600 dark:text-gray-400">${esc(a.jobs ? a.jobs.title : '—')}</td>
        <td class="px-5 py-3.5 text-gray-500 dark:text-gray-500">${new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td class="px-5 py-3.5">${statusBadge(a.status)}</td>
        <td class="px-5 py-3.5 text-right">
            <select data-app-id="${a.id}" class="app-status select-status text-[11px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FCB800] cursor-pointer">
                ${['pending','shortlisted','interview','accepted','rejected'].map(s =>
                    `<option value="${s}"${s === a.status ? ' selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
            </select>
        </td>
    </tr>`;
}

/* ─── FULL APPLICATIONS TABLE ────────────────────────────── */
function renderApplications() {
    const body = document.getElementById('applicationsBody');
    if (!body) return;
    body.innerHTML = ALL_APPLICATIONS.map(rowForApplication).join('') ||
        '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-400 text-xs">No applications yet.</td></tr>';

    body.querySelectorAll('.app-status').forEach(sel => {
        sel.addEventListener('change', async () => {
            const { error } = await supabaseClient.from('applications')
                .update({ status: sel.value }).eq('id', sel.dataset.appId);
            if (error) { toast('Could not update status: ' + error.message, 'error'); return; }
            await loadAdminData();
        });
    });
}

/* ─── JOBS ───────────────────────────────────────────────── */
function renderJobs() {
    const el = document.getElementById('adminJobsList');
    if (!el) return;

    el.innerHTML = ALL_JOBS.map(j => {
        const appCount = ALL_APPLICATIONS.filter(a => a.job_id === j.id).length;
        const company = j.profiles ? (j.profiles.company_name || j.profiles.full_name) : '—';
        return `
        <div data-searchable class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex gap-4 items-start hover:border-amber-200 dark:hover:border-amber-800 transition group">
            <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-[#FCB800] flex-shrink-0 group-hover:bg-amber-100 transition">
                <i class="fa-solid fa-briefcase text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h4 class="font-semibold text-sm text-gray-900 dark:text-white truncate">${esc(j.title)}</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${esc(company)} · ${esc(j.location || '')}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${statusBadge(j.status)}
                    </div>
                </div>
                <div class="flex items-center gap-4 mt-3">
                    <span class="text-[11px] text-gray-500 dark:text-gray-400"><i class="fa-solid fa-money-bill-wave mr-1 text-emerald-500"></i>${esc(j.salary || '—')}</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400"><i class="fa-solid fa-clock mr-1 text-blue-400"></i>${esc(j.job_type || '—')}</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400"><i class="fa-solid fa-users mr-1 text-purple-400"></i>${appCount} applicant${appCount !== 1 ? 's' : ''}</span>
                    <div class="ml-auto">
                        <button data-job-id="${j.id}" class="delete-job text-[11px] font-semibold text-red-400 hover:text-red-600 transition flex items-center gap-1">
                            <i class="fa-solid fa-trash-can"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('') || '<div class="text-sm text-gray-400 py-8 text-center">No job listings yet.</div>';

    el.querySelectorAll('.delete-job').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!(await confirmDialog('Delete this job listing? Its applications will be removed too.', { confirmLabel: 'Delete' }))) return;
            const { error } = await supabaseClient.rpc('admin_delete_job', { p_job_id: btn.dataset.jobId });
            if (error) { toast('Could not delete: ' + error.message, 'error'); return; }
            toast('Job listing deleted.', 'success');
            await loadAdminData();
        });
    });
}

/* ─── USER MANAGEMENT ────────────────────────────────────── */
function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function userStatus(u) {
    if (u.is_blocked) return { type: 'blocked' };
    if (u.banned_until && new Date(u.banned_until) > new Date()) return { type: 'banned', until: new Date(u.banned_until) };
    return { type: 'active' };
}

function userStatusBadge(u) {
    const st = userStatus(u);
    if (st.type === 'blocked') return '<span class="pill-badge bg-red-50 text-red-600 border border-red-200"><i class="fa-solid fa-ban text-[9px]"></i>Blocked</span>';
    if (st.type === 'banned') return `<span class="pill-badge bg-orange-50 text-orange-600 border border-orange-200"><i class="fa-solid fa-hourglass-half text-[9px]"></i>Banned until ${esc(st.until.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</span>`;
    return '<span class="pill-badge bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fa-solid fa-circle-check text-[9px]"></i>Active</span>';
}

function userActionButtons(u) {
    const id = esc(u.id);
    const st = userStatus(u);
    const parts = [];
    if (st.type === 'blocked') {
        parts.push(`<button data-act="unblock" data-user-id="${id}" class="action-btn action-btn-unblock"><i class="fa-solid fa-lock-open"></i>Unblock</button>`);
    } else {
        parts.push(st.type === 'banned'
            ? `<button data-act="unban" data-user-id="${id}" class="action-btn action-btn-unblock"><i class="fa-solid fa-rotate-left"></i>Lift Ban</button>`
            : `<button data-act="ban" data-user-id="${id}" class="action-btn action-btn-ban"><i class="fa-solid fa-clock"></i>Ban</button>`);
        parts.push(`<button data-act="block" data-user-id="${id}" class="action-btn action-btn-block"><i class="fa-solid fa-ban"></i>Block</button>`);
    }
    parts.push(`<button data-act="delete" data-user-id="${id}" class="action-btn action-btn-delete"><i class="fa-solid fa-trash-can"></i>Delete</button>`);
    return '<div class="flex items-center gap-2">' + parts.join('') + '</div>';
}

function renderJobSeekers() {
    const body = document.getElementById('jobSeekersBody');
    if (!body) return;
    body.innerHTML = ALL_JOBSEEKERS.map(u => {
        const name = u.full_name || u.username || '—';
        return `
        <tr data-searchable class="table-row border-b border-gray-50 dark:border-gray-800">
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-[10px] flex-shrink-0">${avatarInitials(name)}</div>
                    <div>
                        <div class="font-medium text-gray-800 dark:text-gray-200 text-xs">${esc(name)}</div>
                        <div class="text-[10px] text-gray-400">${esc(u.email || '')}</div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate">${esc(u.skills || '—')}</td>
            <td class="px-5 py-3.5 text-xs text-gray-500">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</td>
            <td class="px-5 py-3.5">${userStatusBadge(u)}</td>
            <td class="px-5 py-3.5">${userActionButtons(u)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-400 text-xs">No job seekers yet.</td></tr>';
    body.onclick = handleUserAction;
}

function renderEmployers() {
    const body = document.getElementById('employersBody');
    if (!body) return;
    body.innerHTML = ALL_EMPLOYERS.map(u => {
        const name = u.full_name || u.username || '—';
        return `
        <tr data-searchable class="table-row border-b border-gray-50 dark:border-gray-800">
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 font-bold text-[10px] flex-shrink-0">${avatarInitials(name)}</div>
                    <div>
                        <div class="font-medium text-gray-800 dark:text-gray-200 text-xs">${esc(name)}</div>
                        <div class="text-[10px] text-gray-400">${esc(u.email || '')}</div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400">${esc(u.company_name || '—')}</td>
            <td class="px-5 py-3.5 text-xs text-gray-500">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</td>
            <td class="px-5 py-3.5">${userStatusBadge(u)}</td>
            <td class="px-5 py-3.5">${userActionButtons(u)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-400 text-xs">No employers yet.</td></tr>';
    body.onclick = handleUserAction;
}

async function handleUserAction(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const user = ALL_JOBSEEKERS.concat(ALL_EMPLOYERS).find(u => u.id === btn.dataset.userId);
    if (!user) return;
    const name = user.full_name || user.username || 'this user';
    const act = btn.dataset.act;

    if (act === 'ban') {
        const days = await banDialog(name);
        if (!days) return;
        await moderateUser(user.id, 'ban', days, `${name} banned for ${days} day${days === 1 ? '' : 's'}.`);
    } else if (act === 'block') {
        if (!(await confirmDialog(`Block ${name}? They won't be able to log in until unblocked.`, { confirmLabel: 'Block' }))) return;
        await moderateUser(user.id, 'block', null, `${name} has been blocked.`);
    } else if (act === 'unban' || act === 'unblock') {
        await moderateUser(user.id, 'unban', null, `${name} can log in again.`);
    } else if (act === 'delete') {
        if (!(await confirmDialog(`Permanently delete ${name}? This cannot be undone.`, { confirmLabel: 'Delete' }))) return;
        const { error } = await supabaseClient.rpc('admin_delete_user', { p_user_id: user.id });
        if (error) { toast('Could not delete: ' + error.message, 'error'); return; }
        toast(`${name} has been deleted.`, 'success');
        await loadAdminData();
    }
}

async function moderateUser(userId, action, days, successMsg) {
    const { error } = await supabaseClient.rpc('admin_moderate_user', {
        p_user_id: userId, p_action: action, p_days: days
    });
    if (error) { toast('Action failed: ' + error.message, 'error'); return; }
    toast(successMsg, 'success');
    await loadAdminData();
}

/* ─── TOAST ──────────────────────────────────────────────── */
function toast(message, type = 'success') {
    let box = document.getElementById('toastBox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toastBox';
        box.className = 'fixed bottom-6 right-6 z-[70] flex flex-col gap-2';
        document.body.appendChild(box);
    }
    const colors = { error: 'bg-red-600', success: 'bg-emerald-600', info: 'bg-blue-600' };
    const icons = { error: 'fa-circle-exclamation', success: 'fa-circle-check', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `${colors[type] || colors.success} text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg max-w-xs flex items-center gap-2 transition-all`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i>${message}`;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
}

/* ─── DIALOGS ────────────────────────────────────────────── */
function openModal(innerHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4';
    overlay.innerHTML = `<div class="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function confirmDialog(message, opts) {
    const label = (opts && opts.confirmLabel) || 'Confirm';
    return new Promise(resolve => {
        const o = openModal(`
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Please confirm</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">${esc(message)}</p>
            <div class="flex gap-3 pt-1">
                <button data-r="no" class="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
                <button data-r="yes" class="flex-1 py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition">${esc(label)}</button>
            </div>`);
        o.addEventListener('click', ev => {
            const r = ev.target.dataset && ev.target.dataset.r;
            if (r || ev.target === o) { o.remove(); resolve(r === 'yes'); }
        });
    });
}

function banDialog(name) {
    return new Promise(resolve => {
        const o = openModal(`
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Temporarily Ban — ${esc(name)}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Choose duration. The user won't be able to log in until the ban expires.</p>
            <div class="flex flex-wrap gap-2">
                ${[1, 3, 7, 14, 30].map(d => `<button data-preset="${d}" class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:border-[#FCB800] hover:bg-amber-50 transition">${d}d</button>`).join('')}
            </div>
            <input id="banDaysInput" type="number" min="1" max="3650" step="1" value="7"
                class="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FCB800] transition">
            <p id="banError" class="text-[11px] text-red-500 hidden">Enter a number between 1 and 3650.</p>
            <div class="flex gap-3 pt-1">
                <button data-r="no" class="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
                <button data-r="yes" class="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition">Confirm Ban</button>
            </div>`);
        const input = o.querySelector('#banDaysInput');
        o.addEventListener('click', ev => {
            const t = ev.target;
            if (t.dataset && t.dataset.preset) { input.value = t.dataset.preset; return; }
            if (t === o || (t.dataset && t.dataset.r === 'no')) { o.remove(); resolve(null); return; }
            if (t.dataset && t.dataset.r === 'yes') {
                const days = Number(input.value);
                if (!Number.isInteger(days) || days < 1 || days > 3650) { o.querySelector('#banError').classList.remove('hidden'); return; }
                o.remove(); resolve(days);
            }
        });
    });
}

/* ─── SEARCH ─────────────────────────────────────────────── */
function wireAdminSearch() {
    const headerSearch = document.getElementById('adminSearch');
    if (headerSearch) headerSearch.addEventListener('input', () => filterSearchable(headerSearch.value, document));

    const seekerSearch = document.getElementById('jobSeekersSearch');
    if (seekerSearch) seekerSearch.addEventListener('input', () => filterSearchable(seekerSearch.value, document.getElementById('jobSeekersBody')));

    const employerSearch = document.getElementById('employersSearch');
    if (employerSearch) employerSearch.addEventListener('input', () => filterSearchable(employerSearch.value, document.getElementById('employersBody')));
}

function filterSearchable(term, scopeEl) {
    const t = term.toLowerCase();
    (scopeEl || document).querySelectorAll('[data-searchable]').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(t) ? '' : 'none';
    });
}

/* ─── TABS ───────────────────────────────────────────────── */
function switchTab(event, tabId) {
    if (event) event.preventDefault();
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('is-active'));
    const active = document.getElementById('tab-' + tabId);
    if (active) active.classList.remove('hidden');
    const navLink = document.querySelector(`.sidebar-link[data-tab="${tabId}"]`);
    if (navLink) navLink.classList.add('is-active');
}

/* ─── DARK MODE ──────────────────────────────────────────── */
function updateToggleIcon(isDark) {
    const icon = document.getElementById('themeToggleIcon');
    if (!icon) return;
    icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateToggleIcon(isDark);
}
(function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
        updateToggleIcon(true);
    
        }
    })();

/* ─── LOGOUT ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.querySelector('a[href="#logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            document.getElementById('logoutModal')?.classList.remove('hidden');
        });
    }
});
function closeLogoutModal() { document.getElementById('logoutModal')?.classList.add('hidden'); }
async function executeLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}
