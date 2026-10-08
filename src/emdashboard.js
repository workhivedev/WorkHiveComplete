/* ============================================================
   WorkHive — Employer Dashboard logic
   Shares the same localStorage "workhive_jobs" /
   "workhive_applications" tables as jobseeker-dashboard.js, so a
   job posted here immediately shows up in Browse Jobs, and an
   application submitted there shows up here. This is a stand-in
   for the Supabase jobs/applications tables — swap these
   load/save functions for Supabase queries once wired up, the
   rendering code stays the same. jobs are tagged with
   employerId so postings/applicants can be scoped per employer
   once real accounts exist.
   ============================================================ */

const LS_JOBS = 'workhive_jobs';
const LS_APPLICATIONS = 'workhive_applications';
const LS_COMPANY = 'workhive_company_profile';
const CURRENT_EMPLOYER_ID = 'demo-employer';

function loadJobs() { return JSON.parse(localStorage.getItem(LS_JOBS) || '[]'); }
function saveJobs(list) { localStorage.setItem(LS_JOBS, JSON.stringify(list)); }
function loadApplications() { return JSON.parse(localStorage.getItem(LS_APPLICATIONS) || '[]'); }
function saveApplications(list) { localStorage.setItem(LS_APPLICATIONS, JSON.stringify(list)); }
function loadCompany() { return JSON.parse(localStorage.getItem(LS_COMPANY) || '{}'); }
function saveCompany(c) { localStorage.setItem(LS_COMPANY, JSON.stringify(c)); }

function myJobs() {
    return loadJobs().filter(j => !j.employerId || j.employerId === CURRENT_EMPLOYER_ID);
}

// ---------- Actions ----------
function createJobId() { return 'j' + Date.now(); }

function closePosting(jobId) {
    const jobs = loadJobs().filter(j => j.id !== jobId);
    saveJobs(jobs);
    renderAll();
}

function updateApplicantStatus(index, status) {
    const applications = loadApplications();
    if (applications[index]) {
        applications[index].status = status;
        saveApplications(applications);
    }
    renderAll();
}

// ---------- Rendering ----------
function statusBadge(status) {
    const map = {
        'Submitted': 'bg-blue-50 text-blue-600 dark:bg-blue-500/10',
        'In Review': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10',
        'Interview': 'bg-purple-50 text-purple-600 dark:bg-purple-500/10',
        'Rejected': 'bg-red-50 text-red-600 dark:bg-red-500/10',
        'Hired': 'bg-green-50 text-green-600 dark:bg-green-500/10'
    };
    return `<span class="px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}">${status}</span>`;
}

function postingCard(job) {
    const applicantCount = loadApplications().filter(a => a.jobId === job.id).length;
    return `
    <div class="border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-semibold text-sm">${job.title}</p>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">${job.type}</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${job.location} · ${job.salary || 'Salary not specified'}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1"><i class="fa-solid fa-users mr-1"></i>${applicantCount} applicant${applicantCount === 1 ? '' : 's'} · Posted ${job.posted}</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button onclick="switchTab(event,'applicants'); document.getElementById('applicantsJobFilter').value='${job.id}'; renderApplicants();" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FCB800] hover:bg-[#e0a400] text-gray-900">View Applicants</button>
        <button onclick="closePosting('${job.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-red-500">Close</button>
      </div>
    </div>`;
}

function renderPostings() {
    const jobs = myJobs();
    document.getElementById('noPostings').classList.toggle('hidden', jobs.length > 0);
    document.getElementById('postingsList').innerHTML = jobs.map(postingCard).join('');
    document.getElementById('overviewPostings').innerHTML = jobs.length
        ? jobs.slice(0, 3).map(postingCard).join('')
        : `<p class="text-center text-sm text-gray-500 dark:text-gray-400 py-6">No job postings yet. <a href="#" onclick="switchTab(event,'post')" class="text-[#FCB800] font-medium hover:underline">Post your first job →</a></p>`;
}

function renderApplicantsFilterOptions() {
    const select = document.getElementById('applicantsJobFilter');
    const current = select.value;
    const jobs = myJobs();
    select.innerHTML = '<option value="">All job postings</option>' +
        jobs.map(j => `<option value="${j.id}">${j.title}</option>`).join('');
    select.value = current;
}

function renderApplicants() {
    const jobIds = new Set(myJobs().map(j => j.id));
    const jobFilter = document.getElementById('applicantsJobFilter').value;
    const applications = loadApplications()
        .map((a, index) => ({ ...a, index }))
        .filter(a => jobIds.has(a.jobId) && (!jobFilter || a.jobId === jobFilter));

    document.getElementById('noApplicants').classList.toggle('hidden', applications.length > 0);
    document.getElementById('applicantsTable').innerHTML = applications.map(a => `
        <tr>
          <td class="px-4 py-3 font-medium">${a.applicantName || 'Job Seeker'}</td>
          <td class="px-4 py-3 text-gray-500 dark:text-gray-400">${a.title}</td>
          <td class="px-4 py-3 text-gray-500 dark:text-gray-400">${a.appliedOn}</td>
          <td class="px-4 py-3">${statusBadge(a.status)}</td>
          <td class="px-4 py-3">
            <select onchange="updateApplicantStatus(${a.index}, this.value)" class="text-xs border border-gray-300 dark:border-gray-600 bg-transparent rounded-lg px-2 py-1">
              ${['Submitted', 'In Review', 'Interview', 'Rejected', 'Hired'].map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('');
}

function renderStats() {
    const jobs = myJobs();
    const jobIds = new Set(jobs.map(j => j.id));
    const applications = loadApplications().filter(a => jobIds.has(a.jobId));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    document.getElementById('statActive').textContent = jobs.length;
    document.getElementById('statApplicants').textContent = applications.length;
    document.getElementById('statNew').textContent = applications.filter(a => a.appliedOn >= weekAgo).length;
    document.getElementById('statHired').textContent = applications.filter(a => a.status === 'Hired').length;
}

function fillCompanyForm() {
    const c = loadCompany();
    document.getElementById('cp_name').value = c.name || '';
    document.getElementById('cp_industry').value = c.industry || '';
    document.getElementById('cp_location').value = c.location || '';
    document.getElementById('cp_about').value = c.about || '';
    const initial = (c.name || 'E').trim().charAt(0).toUpperCase();
    document.getElementById('userInitial').textContent = initial;
    document.getElementById('userNameLabel').textContent = c.name || 'Employer';
}

function renderAll() {
    renderStats();
    renderPostings();
    renderApplicantsFilterOptions();
    renderApplicants();
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
    fillCompanyForm();
    renderAll();

    document.getElementById('applicantsJobFilter').addEventListener('change', renderApplicants);

    document.getElementById('postJobForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const jobs = loadJobs();
        jobs.unshift({
            id: createJobId(),
            employerId: CURRENT_EMPLOYER_ID,
            title: document.getElementById('pj_title').value.trim(),
            company: loadCompany().name || 'Your Company',
            location: document.getElementById('pj_location').value.trim(),
            type: document.getElementById('pj_type').value,
            salary: document.getElementById('pj_salary').value.trim(),
            tags: document.getElementById('pj_skills').value.split(',').map(s => s.trim()).filter(Boolean),
            description: document.getElementById('pj_description').value.trim(),
            posted: 'Today'
        });
        saveJobs(jobs);
        e.target.reset();
        renderAll();
        const msg = document.getElementById('postJobMsg');
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 2000);
    });

    document.getElementById('companyForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCompany({
            name: document.getElementById('cp_name').value.trim(),
            industry: document.getElementById('cp_industry').value.trim(),
            location: document.getElementById('cp_location').value.trim(),
            about: document.getElementById('cp_about').value.trim()
        });
        fillCompanyForm();
        const msg = document.getElementById('companySavedMsg');
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 2000);
    });
});