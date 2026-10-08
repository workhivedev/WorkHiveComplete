document.addEventListener("DOMContentLoaded", async function () {

let SEEKER_PROFILE = await requireRole("jobseeker");
if (!SEEKER_PROFILE) return;

function toast(msg, type) {
  let el = document.getElementById("wh-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "wh-toast";
    el.style.cssText = "position:fixed;bottom:24px;right:24px;max-width:340px;padding:12px 16px;border-radius:10px;font-size:14px;color:#fff;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.2);transition:opacity .3s";
    document.body.appendChild(el);
  }
  el.style.background = type === "error" ? "#c62828" : "#2e7d32";
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.style.opacity = "0"; }, 4000);
}

document.getElementById("seekerName").innerHTML = (SEEKER_PROFILE.full_name || SEEKER_PROFILE.username) + "<small>Job Seeker</small>";
document.getElementById("welcomeHeading").textContent = "Welcome back, " + (SEEKER_PROFILE.full_name || SEEKER_PROFILE.username).split(" ")[0] + " 👋";

/* =========================
   VIEW SWITCHING (SPA nav)
========================= */
function showView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById("view-" + view);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
  const navLink = document.querySelector('.nav a[data-view="' + view + '"]');
  if (navLink) navLink.classList.add("active");

  window.scrollTo(0, 0);
}

document.querySelectorAll("[data-view]").forEach(function (el) {
  el.addEventListener("click", function (e) {
    e.preventDefault();
    showView(this.dataset.view);
  });
});

/* =========================
   MODAL
========================= */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}
window.closeModal = closeModal;

window.addEventListener("click", function (event) {
  document.querySelectorAll(".modal").forEach(function (modal) {
    if (event.target === modal) modal.classList.remove("open");
  });
});

/* =========================
   LOGOUT / RESUME DEMO BUTTON
========================= */
document.querySelectorAll("[data-demo]").forEach(function (button) {
  button.addEventListener("click", async function () {
    if (this.dataset.demo === "logout") {
      openModal("logoutModal");
    } else if (this.dataset.demo === "resume") {
      toast("Resume upload isn't wired up yet — hook this button to Supabase Storage when you're ready.");
    }
  });
});

document.getElementById("confirmLogoutBtn").addEventListener("click", async function () {
  this.disabled = true;
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

/* =========================
   DATA
========================= */
let jobs = [];
let savedJobIds = [];
let applications = [];
let conversations = [];
let activeConversationId = null;
let applyingJobId = null;

const statusBadge = {
  pending: '<span class="badge pending">Pending</span>',
  shortlisted: '<span class="badge short">Shortlisted</span>',
  interview: '<span class="badge active">Interview</span>',
  rejected: '<span class="badge rejected">Rejected</span>',
  accepted: '<span class="badge active">Accepted</span>'
};

function hasApplied(jobId) {
  return applications.some(function (a) { return a.job_id === jobId; });
}

async function loadAll() {
  const [{ data: jobsData }, { data: savedData }, { data: appsData }, { data: convosData }] = await Promise.all([
    supabaseClient.from("jobs").select("*, profiles!jobs_employer_id_fkey(company_name, full_name, id)").eq("status", "active").order("created_at", { ascending: false }),
    supabaseClient.from("saved_jobs").select("job_id").eq("user_id", SEEKER_PROFILE.id),
    supabaseClient.from("applications").select("*, jobs(title, employer_id, profiles!jobs_employer_id_fkey(company_name, full_name, id))").eq("applicant_id", SEEKER_PROFILE.id).order("created_at", { ascending: false }),
    supabaseClient.from("conversations").select("*, profiles!conversations_employer_id_fkey(company_name, full_name)").eq("jobseeker_id", SEEKER_PROFILE.id).order("created_at", { ascending: false })
  ]);

  jobs = jobsData || [];
  savedJobIds = (savedData || []).map(s => s.job_id);
  applications = appsData || [];
  conversations = convosData || [];

  renderAll();
  renderConversationList();
}

/* =========================
   RENDER: JOB CARD
========================= */
function jobCard(job) {
  const saved = savedJobIds.includes(job.id);
  const applied = hasApplied(job.id);
  const company = job.profiles ? (job.profiles.company_name || job.profiles.full_name) : "Employer";

  return (
    '<div class="job" data-searchable data-category="' + (job.category || "") + '" data-type="' + (job.job_type || "") + '">' +
      '<div>' +
        '<h3>' + job.title + '</h3>' +
        '<p>🏢 ' + company + ' &nbsp; 📍 ' + (job.location || "") + '</p>' +
        '<p>💰 ' + (job.salary || "") + ' &nbsp;·&nbsp; ' + (job.job_type || "") + ' &nbsp;·&nbsp; Posted ' + new Date(job.created_at).toLocaleDateString() + '</p>' +
      '</div>' +
      '<div class="job-right">' +
        '<span class="badge ' + (job.job_type === "Full-time" ? "active" : "pending") + '">' + (job.category || "") + '</span>' +
        '<div class="actions" style="margin-top:10px;justify-content:flex-end">' +
          '<button type="button" class="save-btn' + (saved ? ' saved' : '') + '" data-action="save" data-id="' + job.id + '">' + (saved ? '★ Saved' : '☆ Save') + '</button>' +
          '<button type="button" class="btn primary" data-action="apply" data-id="' + job.id + '"' + (applied ? ' disabled' : '') + '>' + (applied ? 'Applied' : 'Apply Now') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderJobsList() {
  const el = document.getElementById("jobsList");
  if (el) el.innerHTML = jobs.map(jobCard).join("") || '<div class="empty-notice">No open jobs right now — check back soon.</div>';
}

function renderRecommended() {
  const el = document.getElementById("recommendedList");
  if (!el) return;
  const recommended = jobs.filter(function (j) { return !hasApplied(j.id); }).slice(0, 3);
  el.innerHTML = recommended.map(jobCard).join("") || '<div class="empty-notice">No recommendations yet.</div>';
}

function renderSaved() {
  const el = document.getElementById("savedList");
  if (!el) return;
  const saved = jobs.filter(function (j) { return savedJobIds.includes(j.id); });
  el.innerHTML = saved.map(jobCard).join("");
  const empty = document.getElementById("savedEmpty");
  if (empty) empty.style.display = saved.length ? "none" : "block";
}

function renderApplications() {
  const body = document.getElementById("applicationsTableBody");
  if (!body) return;
  body.innerHTML = applications.map(function (a, i) {
    const company = a.jobs && a.jobs.profiles ? (a.jobs.profiles.company_name || a.jobs.profiles.full_name) : "";
    const employerId = a.jobs ? a.jobs.employer_id : null;
    return (
      '<tr data-searchable>' +
        '<td>' + (a.jobs ? a.jobs.title : '') + '</td>' +
        '<td>' + company + '</td>' +
        '<td>' + new Date(a.created_at).toLocaleDateString() + '</td>' +
        '<td>' + (statusBadge[a.status] || '') + '</td>' +
        '<td><button type="button" class="btn outline" data-action="view-application" data-index="' + i + '">View</button></td>' +
        '<td><button type="button" class="btn outline" data-message-employer="' + employerId + '" data-job-id="' + a.job_id + '">Message</button></td>' +
      '</tr>'
    );
  }).join("");
  const empty = document.getElementById("applicationsEmpty");
  if (empty) empty.style.display = applications.length ? "none" : "block";

  body.querySelectorAll("[data-message-employer]").forEach(btn => btn.addEventListener("click", async () => {
    if (!btn.dataset.messageEmployer || btn.dataset.messageEmployer === "null") { toast("Could not find the employer for this job.", "error"); return; }
    await openOrCreateConversation(btn.dataset.messageEmployer, btn.dataset.jobId);
    showView("messages");
  }));
}

function renderStats() {
  const a = document.getElementById("statApplications");
  const s = document.getElementById("statSaved");
  const i = document.getElementById("statInterviews");
  if (a) a.textContent = applications.length;
  if (s) s.textContent = savedJobIds.length;
  if (i) i.textContent = applications.filter(function (x) { return x.status === "interview"; }).length;
}

function renderAll() {
  renderJobsList();
  renderRecommended();
  renderSaved();
  renderApplications();
  renderStats();
}

/* =========================
   SAVE / APPLY ACTIONS
========================= */
async function toggleSave(jobId) {
  if (savedJobIds.includes(jobId)) {
    await supabaseClient.from("saved_jobs").delete().eq("user_id", SEEKER_PROFILE.id).eq("job_id", jobId);
  } else {
    await supabaseClient.from("saved_jobs").insert({ user_id: SEEKER_PROFILE.id, job_id: jobId });
  }
  const { data } = await supabaseClient.from("saved_jobs").select("job_id").eq("user_id", SEEKER_PROFILE.id);
  savedJobIds = (data || []).map(s => s.job_id);
  renderAll();
}

function startApply(jobId) {
  if (hasApplied(jobId)) return;
  applyingJobId = jobId;
  const job = jobs.find(function (j) { return j.id === jobId; });
  if (!job) return;
  const titleEl = document.getElementById("applyModalTitle");
  const msgEl = document.getElementById("applyMessage");
  if (titleEl) titleEl.textContent = "Apply for " + job.title;
  if (msgEl) msgEl.value = "";
  openModal("applyModal");
}

document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "save") toggleSave(id);
  else if (action === "apply") startApply(id);
  else if (action === "view-application") {
    const a = applications[parseInt(btn.dataset.index, 10)];
    toast((a && a.message) ? a.message : "No cover message was included with this application.");
  }
});

const applyForm = document.getElementById("applyForm");
if (applyForm) {
  applyForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!applyingJobId) return;
    const message = document.getElementById("applyMessage").value.trim();

    const { error } = await supabaseClient.from("applications").insert({
      job_id: applyingJobId,
      applicant_id: SEEKER_PROFILE.id,
      message: message,
      status: "pending"
    });

    if (error) { toast("Could not submit application: " + error.message, "error"); return; }

    closeModal("applyModal");
    const { data } = await supabaseClient.from("applications").select("*, jobs(title, employer_id, profiles!jobs_employer_id_fkey(company_name, full_name, id))").eq("applicant_id", SEEKER_PROFILE.id).order("created_at", { ascending: false });
    applications = data || [];
    renderAll();
    toast("Application submitted!");
  });
}

/* =========================
   PROFILE FORM
========================= */
function fillProfileView() {
  const p = SEEKER_PROFILE;
  document.getElementById("profileFullName").textContent = p.full_name || p.username;
  document.getElementById("profileHeadline").textContent = p.headline || "Job Seeker";
  document.getElementById("profileLogo").textContent = (p.full_name || p.username).split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  document.getElementById("profileAddress").textContent = p.bio ? p.bio.slice(0, 40) : "—";
  document.getElementById("profilePhone").textContent = p.phone || "—";
  document.getElementById("profileEmail").textContent = p.email;

  const tagsEl = document.getElementById("profileSkillsTags");
  const skills = (p.skills || "").split(",").map(s => s.trim()).filter(Boolean);
  tagsEl.innerHTML = '<b style="display:block;color:#777;font-size:11px;text-transform:uppercase;margin-bottom:6px;">Skills</b>' +
    skills.map(s => '<span class="skill-tag">' + s + '</span>').join("");

  document.getElementById("formFullName").value = p.full_name || "";
  document.getElementById("formHeadline").value = p.headline || "";
  document.getElementById("formBio").value = p.bio || "";
  document.getElementById("formAddress").value = "";
  document.getElementById("formPhone").value = p.phone || "";
  document.getElementById("formEmail").value = p.email;
  document.getElementById("formSkills").value = p.skills || "";
}

const profileForm = document.getElementById("profileForm");
if (profileForm) {
  profileForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const updates = {
      full_name: document.getElementById("formFullName").value.trim(),
      headline: document.getElementById("formHeadline").value.trim(),
      bio: document.getElementById("formBio").value.trim(),
      phone: document.getElementById("formPhone").value.trim(),
      skills: document.getElementById("formSkills").value.trim()
    };
    const { error } = await supabaseClient.from("profiles").update(updates).eq("id", SEEKER_PROFILE.id);
    if (error) { toast("Could not save: " + error.message, "error"); return; }
    Object.assign(SEEKER_PROFILE, updates);
    fillProfileView();
    toast("Changes saved successfully.");
  });
}

/* =========================
   SEARCH / FILTERS
========================= */
function applyJobsFilter() {
  const searchEl = document.getElementById("jobsSearch");
  const categoryEl = document.getElementById("jobsCategory");
  const typeEl = document.getElementById("jobsType");
  if (!searchEl || !categoryEl || !typeEl) return;

  const term = searchEl.value.toLowerCase();
  const category = categoryEl.value;
  const type = typeEl.value;

  document.querySelectorAll("#jobsList .job").forEach(function (card) {
    const matchesText = card.innerText.toLowerCase().includes(term);
    const matchesCategory = !category || card.dataset.category === category;
    const matchesType = !type || card.dataset.type === type;
    card.style.display = (matchesText && matchesCategory && matchesType) ? "" : "none";
  });
}

const jobsSearch = document.getElementById("jobsSearch");
const jobsCategory = document.getElementById("jobsCategory");
const jobsType = document.getElementById("jobsType");
if (jobsSearch) jobsSearch.addEventListener("input", applyJobsFilter);
if (jobsCategory) jobsCategory.addEventListener("change", applyJobsFilter);
if (jobsType) jobsType.addEventListener("change", applyJobsFilter);

const topSearch = document.getElementById("topSearch");
if (topSearch) {
  topSearch.addEventListener("input", function () {
    const term = this.value.toLowerCase();
    document.querySelectorAll(".view.active [data-searchable]").forEach(function (row) {
      row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none";
    });
  });
}

/* =========================
   MESSAGES (real, job seeker <-> employer)
========================= */
function renderConversationList() {
  const list = document.getElementById("conversationList");
  if (!list) return;
  list.innerHTML = "";
  if (!activeConversationId && conversations[0]) activeConversationId = conversations[0].id;

  conversations.forEach(function (c) {
    const div = document.createElement("div");
    div.className = "conversation" + (c.id === activeConversationId ? " active" : "");
    div.dataset.conversationId = c.id;
    const name = c.profiles ? (c.profiles.company_name || c.profiles.full_name) : "Employer";
    div.innerHTML = '<div class="avatar">' + name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() + '</div>' +
      '<div><b>' + name + '</b><small>Tap to view conversation</small></div>';
    list.appendChild(div);
  });

  if (!conversations.length) {
    list.innerHTML = '<div style="padding:16px;color:#888;font-size:13px">No conversations yet. Message an employer from My Applications.</div>';
  }

  renderChat();
}

document.addEventListener("click", function (e) {
  const conv = e.target.closest(".conversation");
  if (!conv || !conv.dataset.conversationId) return;
  activeConversationId = conv.dataset.conversationId;
  renderConversationList();
});

let lastChatKey = "";

async function renderChat() {
  const head = document.getElementById("chatHead");
  const body = document.getElementById("chatBody");
  if (!head || !body) return;
  const c = conversations.find(function (x) { return x.id === activeConversationId; });
  if (!c) { head.innerHTML = ""; body.innerHTML = ""; lastChatKey = ""; return; }

  const name = c.profiles ? (c.profiles.company_name || c.profiles.full_name) : "Employer";
  head.innerHTML = name + '<small>Employer</small>';

  const { data: messages, error: msgErr } = await supabaseClient.from("messages").select("*").eq("conversation_id", c.id).order("created_at", { ascending: true });
  if (msgErr) {
    body.innerHTML = '<div style="padding:16px;color:#c62828;font-size:13px">Could not load messages: ' + msgErr.message + '</div>';
    return;
  }
  const key = c.id + ":" + (messages || []).map(function (m) { return m.id; }).join(",");
  if (key === lastChatKey) return;
  lastChatKey = key;
  body.innerHTML = "";
  (messages || []).forEach(function (m) {
    const bubble = document.createElement("div");
    bubble.className = "bubble" + (m.sender_id === SEEKER_PROFILE.id ? " mine" : "");
    bubble.textContent = m.body;
    body.appendChild(bubble);
  });
  body.scrollTop = body.scrollHeight;
}

async function openOrCreateConversation(employerId, jobId) {
  if (!employerId) return;
  let convo = conversations.find(c => c.employer_id === employerId);
  if (!convo) {
    const { data, error } = await supabaseClient.from("conversations")
      .insert({ employer_id: employerId, jobseeker_id: SEEKER_PROFILE.id, job_id: jobId || null })
      .select("*, profiles!conversations_employer_id_fkey(company_name, full_name)")
      .single();
    if (error) { toast("Could not start conversation: " + error.message, "error"); return; }
    conversations.unshift(data);
    convo = data;
  }
  activeConversationId = convo.id;
  renderConversationList();
}

const messageForm = document.getElementById("messageForm");
if (messageForm) {
  messageForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const input = document.getElementById("messageInput");
    if (!input) return;
    const text = input.value.trim();
    if (text === "" || !activeConversationId) return;

    const { error } = await supabaseClient.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: SEEKER_PROFILE.id,
      body: text
    });
    if (error) { toast("Could not send: " + error.message, "error"); return; }
    input.value = "";
    lastChatKey = "";
    await renderChat();
  });
}

async function pollMessages() {
  if (document.hidden) return;
  const { data } = await supabaseClient.from("conversations")
    .select("*, profiles!conversations_employer_id_fkey(company_name, full_name)")
    .eq("jobseeker_id", SEEKER_PROFILE.id)
    .order("created_at", { ascending: false });
  if (data && data.length !== conversations.length) { conversations = data; renderConversationList(); }
  const view = document.getElementById("view-messages");
  if (activeConversationId && view && view.classList.contains("active")) await renderChat();
}
setInterval(pollMessages, 4000);

/* =========================
   INIT
========================= */
fillProfileView();
await loadAll();

});