let EMPLOYER_PROFILE = null;
let MY_JOBS = [];
let MY_APPLICATIONS = [];
let MY_CONVERSATIONS = [];
let activeConversationId = null;

document.addEventListener("DOMContentLoaded", async () => {
    EMPLOYER_PROFILE = await requireRole("employer");
    if (!EMPLOYER_PROFILE) return;

    const nameEl = document.getElementById("employerName");
    if (nameEl) nameEl.innerHTML = (EMPLOYER_PROFILE.company_name || EMPLOYER_PROFILE.full_name || EMPLOYER_PROFILE.username) + "<small>Employer</small>";

    fillProfileView();
    wireEmployerUploads();
    await loadEmployerData();

    initViewSwitching();
    initModals();
    initDemoButtons();
    initSearch();
    initJobForm();
    initProfileForm();
    initMessages();
});

window.addEventListener("pageshow", async function (event) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) window.location.replace("index.html");
});


function initViewSwitching() {
    function showView(view) {
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        const target = document.getElementById("view-" + view);
        if (target) target.classList.add("active");
        document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
        const navLink = document.querySelector('.nav a[data-view="' + view + '"]');
        if (navLink) navLink.classList.add("active");
        window.scrollTo(0, 0);
    }
    window.showView = showView;
    document.querySelectorAll("[data-view]").forEach(el => {
        el.addEventListener("click", e => {
            e.preventDefault();
            showView(el.dataset.view);
            if (el.dataset.modal) openModal(el.dataset.modal);
        });
    });
}

function initModals() {
    window.openModal = id => document.getElementById(id).classList.add("open");
    window.closeModal = id => document.getElementById(id).classList.remove("open");
    window.addEventListener("click", event => {
        document.querySelectorAll(".modal").forEach(modal => {
            if (event.target === modal) modal.classList.remove("open");
        });
    });
}

function initDemoButtons() {
    document.querySelectorAll("[data-demo]").forEach(button => {
        button.addEventListener("click", async () => {
            if (button.dataset.demo === "logout") {
                openModal("logoutModal");
            }
        });
    });
    document.getElementById("confirmLogoutBtn").addEventListener("click", async function () {
        this.disabled = true;
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });
}


function initSearch() {
    document.querySelectorAll(".search").forEach(input => {
        input.addEventListener("input", () => {
            const term = input.value.toLowerCase();
            const scope = input.closest(".view") || document;
            scope.querySelectorAll("[data-searchable]").forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none";
            });
        });
    });

    const jobsFilterStatus = document.getElementById("jobsFilterStatus");
    const jobsFilterCategory = document.getElementById("jobsFilterCategory");
    if (jobsFilterStatus) jobsFilterStatus.addEventListener("change", renderJobs);
    if (jobsFilterCategory) jobsFilterCategory.addEventListener("change", renderJobs);

    const applicantsFilterJob = document.getElementById("applicantsFilterJob");
    const applicantsFilterStatus = document.getElementById("applicantsFilterStatus");
    if (applicantsFilterJob) applicantsFilterJob.addEventListener("change", renderApplicants);
    if (applicantsFilterStatus) applicantsFilterStatus.addEventListener("change", renderApplicants);
}


async function loadEmployerData() {
    const [{ data: jobs, error: jobsErr }, { data: apps, error: appsErr }, { data: convos, error: convosErr }] = await Promise.all([
        supabaseClient.from("jobs").select("*").eq("employer_id", EMPLOYER_PROFILE.id).order("created_at", { ascending: false }),
        supabaseClient.from("applications").select("*, jobs!inner(title, employer_id), profiles!applications_applicant_id_fkey(id, full_name, username, headline)").eq("jobs.employer_id", EMPLOYER_PROFILE.id).order("created_at", { ascending: false }),
        supabaseClient.from("conversations").select("*, profiles!conversations_jobseeker_id_fkey(full_name, username)").eq("employer_id", EMPLOYER_PROFILE.id).order("created_at", { ascending: false })
    ]);

    if (jobsErr) console.error("[jobs]", jobsErr.message);
    if (appsErr) console.error("[applications]", appsErr.message);
    if (convosErr) console.error("[conversations]", convosErr.message);

    MY_JOBS = jobs || [];
    MY_APPLICATIONS = apps || [];
    MY_CONVERSATIONS = convos || [];

    renderStats();
    renderProfileStats();
    renderNotifications();
    renderRecentCandidates();
    renderJobs();
    populateJobFilterOptions();
    renderApplicants();
    renderConversationList();
}

function renderStats() {
    document.getElementById("statActiveJobs").textContent = MY_JOBS.filter(j => j.status === "active").length;
    document.getElementById("statTotalApplicants").textContent = MY_APPLICATIONS.length;
    document.getElementById("statShortlisted").textContent = MY_APPLICATIONS.filter(a => a.status === "shortlisted").length;
    document.getElementById("statInterviews").textContent = MY_APPLICATIONS.filter(a => a.status === "interview").length;
}

function countStatus(s) { return MY_APPLICATIONS.filter(a => a.status === s).length; }

function renderProfileStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("pfActiveJobs", MY_JOBS.filter(j => j.status === "active").length);
    set("pfApplicants", MY_APPLICATIONS.length);
    set("pfInterviews", countStatus("interview"));
    set("pfHired", countStatus("accepted"));

    // Overview card sub-labels (real numbers instead of fixed text)
    const pending = countStatus("pending");
    set("trendActiveJobs", MY_JOBS.length + " total listing" + (MY_JOBS.length === 1 ? "" : "s"));
    set("trendApplicants", pending + " awaiting review");
    set("trendShortlisted", "In review pipeline");
    set("trendInterviews", countStatus("interview") ? "In progress" : "None yet");
}

function renderNotifications() {
    const el = document.getElementById("notificationsList");
    if (!el) return;
    const items = [];
    const pending = countStatus("pending");
    const interviews = countStatus("interview");
    const shortlisted = countStatus("shortlisted");
    if (pending) items.push("🔔 " + pending + " new applicant" + (pending === 1 ? "" : "s") + " need" + (pending === 1 ? "s" : "") + " review.");
    if (interviews) items.push("📅 " + interviews + " applicant" + (interviews === 1 ? " is" : "s are") + " at the interview stage.");
    if (shortlisted) items.push("★ " + shortlisted + " shortlisted applicant" + (shortlisted === 1 ? "" : "s") + " waiting for your next step.");
    if (MY_CONVERSATIONS.length) items.push("💬 " + MY_CONVERSATIONS.length + " active conversation" + (MY_CONVERSATIONS.length === 1 ? "" : "s") + ".");
    const expiring = MY_JOBS.filter(j => j.status === "active" && j.deadline && (new Date(j.deadline) - new Date()) / 86400000 <= 3 && new Date(j.deadline) >= new Date(new Date().toDateString()));
    expiring.forEach(j => items.push("⏰ \"" + j.title + "\" closes on " + j.deadline + "."));
    el.innerHTML = items.map(t => '<div class="notice">' + t + '</div>').join("") || '<div class="notice">No new notifications.</div>';
}

function statusBadgeClass(status) {
    return { pending: "pending", shortlisted: "short", interview: "active", accepted: "active", rejected: "rejected" }[status] || "pending";
}

function renderRecentCandidates() {
    const body = document.getElementById("recentCandidatesBody");
    if (!body) return;
    body.innerHTML = MY_APPLICATIONS.slice(0, 5).map(a => (
        '<tr data-searchable>' +
            '<td><div class="applicant"><div class="avatar">' + initials(a.profiles) + '</div><div><b>' + fullName(a.profiles) + '</b><small>' + (a.profiles?.headline || '') + '</small></div></div></td>' +
            '<td>' + (a.jobs ? a.jobs.title : '') + '</td>' +
            '<td>' + new Date(a.created_at).toLocaleDateString() + '</td>' +
            '<td><span class="badge ' + statusBadgeClass(a.status) + '">' + a.status + '</span></td>' +
            '<td><a class="btn outline" data-view="applicants">View</a></td>' +
        '</tr>'
    )).join("") || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888">No applications yet.</td></tr>';
    body.querySelectorAll("[data-view]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); window.showView(el.dataset.view); }));
}

function renderJobs() {
    const el = document.getElementById("employerJobsList");
    if (!el) return;
    const statusFilter = document.getElementById("jobsFilterStatus")?.value || "";
    const catFilter = document.getElementById("jobsFilterCategory")?.value || "";
    const jobs = MY_JOBS.filter(j => (!statusFilter || j.status === statusFilter) && (!catFilter || j.category === catFilter));

    el.innerHTML = jobs.map(j => {
        const count = MY_APPLICATIONS.filter(a => a.job_id === j.id).length;
        return (
            '<div class="job" data-searchable>' +
                '<div>' +
                    '<h3>' + j.title + '</h3>' +
                    '<p>📍 ' + (j.location || '') + ' &nbsp; 💰 ' + (j.salary || '') + '</p>' +
                    '<p>' + (j.job_type || '') + ' · ' + count + ' applicants' + (j.deadline ? ' · Deadline: ' + j.deadline : '') + '</p>' +
                '</div>' +
                '<div class="job-right">' +
                    '<span class="badge ' + (j.status === 'active' ? 'active' : 'pending') + '">' + (j.status === 'active' ? 'Active' : 'Closed') + '</span>' +
                    '<div class="actions" style="margin-top:10px">' +
                        '<button class="btn outline" data-view-applicants-for="' + j.id + '">Applicants</button>' +
                        '<button class="btn danger" data-close-job="' + j.id + '">' + (j.status === 'active' ? 'Close' : 'Reopen') + '</button>' +
                        '<button class="btn danger" data-delete-job="' + j.id + '">Delete</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }).join("") || '<p style="color:#888;font-size:13px">No job listings yet. Click "+ Post New Job" to create one.</p>';

    el.querySelectorAll("[data-view-applicants-for]").forEach(btn => btn.addEventListener("click", () => {
        document.getElementById("applicantsFilterJob").value = btn.dataset.viewApplicantsFor;
        window.showView("applicants");
        renderApplicants();
    }));
    el.querySelectorAll("[data-close-job]").forEach(btn => btn.addEventListener("click", async () => {
        const job = MY_JOBS.find(j => j.id === btn.dataset.closeJob);
        const newStatus = job.status === "active" ? "closed" : "active";
        const { error } = await supabaseClient.from("jobs").update({ status: newStatus }).eq("id", job.id);
        if (error) { alert("Could not update job: " + error.message); return; }
        await loadEmployerData();
    }));
    el.querySelectorAll("[data-delete-job]").forEach(btn => btn.addEventListener("click", async () => {
        if (!confirm("Delete this job listing? This cannot be undone.")) return;
        const { error } = await supabaseClient.from("jobs").delete().eq("id", btn.dataset.deleteJob);
        if (error) { alert("Could not delete job: " + error.message); return; }
        await loadEmployerData();
    }));
}

function populateJobFilterOptions() {
    const sel = document.getElementById("applicantsFilterJob");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Jobs</option>' + MY_JOBS.map(j => '<option value="' + j.id + '">' + j.title + '</option>').join("");
    sel.value = current;
}

function renderApplicants() {
    const body = document.getElementById("applicantsBody");
    if (!body) return;
    const jobFilter = document.getElementById("applicantsFilterJob")?.value || "";
    const statusFilter = document.getElementById("applicantsFilterStatus")?.value || "";
    const list = MY_APPLICATIONS.filter(a => (!jobFilter || a.job_id === jobFilter) && (!statusFilter || a.status === statusFilter));

    body.innerHTML = list.map(a => (
        '<tr data-searchable>' +
            '<td><div class="applicant"><div class="avatar">' + initials(a.profiles) + '</div><div><b>' + fullName(a.profiles) + '</b><small>' + (a.profiles?.headline || '') + '</small></div></div></td>' +
            '<td>' + (a.jobs ? a.jobs.title : '') + '</td>' +
            '<td>' + new Date(a.created_at).toLocaleDateString() + '</td>' +
            '<td><span class="badge ' + statusBadgeClass(a.status) + '">' + a.status + '</span></td>' +
            '<td><div class="actions">' +
                '<button type="button" class="btn outline" data-message="' + a.applicant_id + '" data-job-id="' + a.job_id + '">Message</button>' +
                '<button type="button" class="btn primary" data-set-status="interview" data-app-id="' + a.id + '">Interview</button>' +
                '<button type="button" class="btn outline" data-set-status="shortlisted" data-app-id="' + a.id + '">Shortlist</button>' +
                '<button type="button" class="btn outline" data-set-status="accepted" data-app-id="' + a.id + '">Hire</button>' +
                '<button type="button" class="btn danger" data-set-status="rejected" data-app-id="' + a.id + '">Reject</button>' +
            '</div></td>' +
        '</tr>'
    )).join("") || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888">No applicants match.</td></tr>';

    body.querySelectorAll("[data-set-status]").forEach(btn => btn.addEventListener("click", async () => {
        btn.disabled = true;
        const { data, error } = await supabaseClient.from("applications")
            .update({ status: btn.dataset.setStatus })
            .eq("id", btn.dataset.appId)
            .select("id, status");
        if (error) { btn.disabled = false; alert("Could not update: " + error.message); return; }
        if (!data || !data.length) {
            btn.disabled = false;
            alert("The status was not saved. Supabase blocked the update (missing RLS policy). Run fix-messaging-and-applications.sql in the Supabase SQL Editor.");
            return;
        }
        await loadEmployerData();
    }));
    body.querySelectorAll("[data-message]").forEach(btn => btn.addEventListener("click", async () => {
        await openOrCreateConversation(btn.dataset.message, btn.dataset.jobId);
        window.showView("messages");
    }));
}

function initials(profile) {
    const n = fullName(profile);
    return n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}
function fullName(profile) {
    return (profile && (profile.full_name || profile.username)) || "Applicant";
}


function initJobForm() {
    const jobForm = document.getElementById("jobForm");
    if (!jobForm) return;
    jobForm.addEventListener("submit", async event => {
        event.preventDefault();
        const inputs = jobForm.querySelectorAll("input, select, textarea");
        const [title, category, description, requirements, salary, jobType, location, vacancies, deadline] =
            Array.from(inputs).map(i => i.value);

        const { error } = await supabaseClient.from("jobs").insert({
            employer_id: EMPLOYER_PROFILE.id,
            title, category, description, requirements, salary,
            job_type: jobType, location,
            vacancies: parseInt(vacancies, 10) || 1,
            deadline: deadline || null,
            status: "active"
        });

        if (error) { alert("Could not post job: " + error.message); return; }

        closeModal("jobModal");
        jobForm.reset();
        await loadEmployerData();
        alert("Job posted successfully!");
    });
}


/* =========================================================
   Profile view + UPLOAD handlers (logo + business file)
   ========================================================= */
function fillProfileView() {
    const p = EMPLOYER_PROFILE;
    document.getElementById("profileCompanyName").textContent = p.company_name || p.full_name || p.username;
    document.getElementById("profileCategory").textContent = "Employer";
    document.getElementById("profileAddress").textContent = p.headline || "—";
    document.getElementById("profilePhone").textContent = p.phone || "—";
    document.getElementById("profileEmail").textContent = p.email;

    document.getElementById("formCompanyName").value = p.company_name || "";
    document.getElementById("formBio").value = p.bio || "";
    document.getElementById("formAddress").value = p.headline || "";
    document.getElementById("formPhone").value = p.phone || "";
    document.getElementById("formEmail").value = p.email;

    refreshLogo();
    refreshBusinessFile();
}

function refreshLogo() {
    const img  = document.getElementById("profileLogoImg");
    const init = document.getElementById("profileLogoInit");
    const name = (EMPLOYER_PROFILE.company_name || EMPLOYER_PROFILE.full_name || EMPLOYER_PROFILE.username || "🏪").trim();
    if (EMPLOYER_PROFILE.logo_url) {
        img.src = EMPLOYER_PROFILE.logo_url;
        img.style.display = "block";
        init.style.display = "none";
    } else {
        img.removeAttribute("src");
        img.style.display = "none";
        init.textContent = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "🏪";
        init.style.display = "";
    }
}

function refreshBusinessFile() {
    const remove = document.getElementById("businessRemoveBtn");
    const link   = document.getElementById("businessLink");
    const a      = document.getElementById("businessAnchor");
    const lbl    = document.getElementById("businessZoneLabel");
    if (EMPLOYER_PROFILE.business_file_url) {
        if (remove) remove.style.display = "";
        if (link)   link.style.display = "";
        if (a) { a.href = EMPLOYER_PROFILE.business_file_url; a.textContent = EMPLOYER_PROFILE.business_file_name || "document"; }
        if (lbl)    lbl.textContent = "Current Business File";
    } else {
        if (remove) remove.style.display = "none";
        if (link)   link.style.display = "none";
        if (lbl)    lbl.textContent = "Upload Business File";
    }
}

function setBusinessStatus(msg, cls) {
    const s = document.getElementById("businessStatus");
    if (!s) return;
    s.textContent = msg;
    s.className = "upload-zone-status " + (cls || "");
    s.style.display = msg ? "" : "none";
}

function setBusinessProgress(visible, p) {
    const wrap = document.getElementById("businessProgress");
    if (!wrap) return;
    wrap.style.display = visible ? "" : "none";
    const bar = wrap.firstElementChild;
    if (bar) bar.style.width = (p == null ? 0 : p) + "%";
}

async function handleLogo(file) {
    if (!file) return;
    const err = window.validateUpload(file, "image");
    if (err) { setBusinessStatus(err, "error"); alert(err); return; }
    const sniff = await window.sniffFile(file);
    if (sniff !== "image/jpeg" && sniff !== "image/png" && sniff !== "image/webp") {
        const m = "File contents don't look like a JPG/PNG/WEBP image.";
        setBusinessStatus(m, "error"); alert(m); return;
    }
    const btn = document.getElementById("logoPickBtn");
    btn.disabled = true;
    try {
        const { url } = await window.uploadWhFile(file, "logo", EMPLOYER_PROFILE.id);
        const { error } = await supabaseClient.from("profiles")
            .update({ logo_url: url })
            .eq("id", EMPLOYER_PROFILE.id);
        if (error) throw error;
        EMPLOYER_PROFILE.logo_url = url;
        refreshLogo();
        setBusinessStatus("Logo updated.", "ok");
        alert("Logo updated.");
    } catch (e) {
        const m = "Upload failed: " + (e.message || e);
        setBusinessStatus(m, "error"); alert(m);
    } finally {
        btn.disabled = false;
        setTimeout(() => setBusinessStatus("", ""), 4000);
    }
}

async function handleBusinessFile(file) {
    if (!file) return;
    const err = window.validateUpload(file, "doc");
    if (err) { setBusinessStatus(err, "error"); alert(err); return; }
    const remove = document.getElementById("businessRemoveBtn");
    remove.disabled = true;
    setBusinessStatus("Uploading…", "ok");
    setBusinessProgress(true, 25);
    try {
        setBusinessProgress(true, 60);
        const { url } = await window.uploadWhFile(file, "business", EMPLOYER_PROFILE.id);
        setBusinessProgress(true, 85);
        const { error } = await supabaseClient.from("profiles")
            .update({ business_file_url: url, business_file_name: file.name })
            .eq("id", EMPLOYER_PROFILE.id);
        if (error) throw error;
        EMPLOYER_PROFILE.business_file_url = url;
        EMPLOYER_PROFILE.business_file_name = file.name;
        setBusinessProgress(true, 100);
        refreshBusinessFile();
        setBusinessStatus("Business file uploaded!", "ok");
        alert("Business file uploaded.");
    } catch (e) {
        const m = "Upload failed: " + (e.message || e);
        setBusinessStatus(m, "error"); alert(m);
    } finally {
        setTimeout(() => setBusinessProgress(false, 0), 600);
        setTimeout(() => setBusinessStatus("", ""), 4000);
        remove.disabled = false;
    }
}

async function removeBusinessFile() {
    if (!confirm("Remove your current business file?")) return;
    const remove = document.getElementById("businessRemoveBtn");
    remove.disabled = true;
    try {
        await window.deleteWhFile(EMPLOYER_PROFILE.business_file_url);
        const { error } = await supabaseClient.from("profiles")
            .update({ business_file_url: null, business_file_name: null })
            .eq("id", EMPLOYER_PROFILE.id);
        if (error) throw error;
        EMPLOYER_PROFILE.business_file_url = null;
        EMPLOYER_PROFILE.business_file_name = null;
        refreshBusinessFile();
        setBusinessStatus("Business file removed.", "ok");
        alert("Business file removed.");
    } catch (e) {
        const m = "Could not remove: " + e.message;
        setBusinessStatus(m, "error"); alert(m);
    } finally { remove.disabled = false; }
}

function wireEmployerUploads() {
    const logoInput = document.getElementById("logoInput");
    const logoPick  = document.getElementById("logoPickBtn");
    const logoBox   = document.getElementById("profileLogo");

    if (logoPick) logoPick.addEventListener("click", e => { e.stopPropagation(); logoInput.click(); });
    if (logoBox)  logoBox.addEventListener("click", e => {
        if (e.target.closest(".profile-logo-edit")) logoInput.click();
    });
    if (logoInput) logoInput.addEventListener("change", e => {
        const f = e.target.files && e.target.files[0];
        if (f) handleLogo(f);
        e.target.value = "";
    });

    const busInput = document.getElementById("businessInput");
    const busPick  = document.getElementById("businessPickBtn");
    const busRem   = document.getElementById("businessRemoveBtn");
    if (busPick)  busPick.addEventListener("click", e => { e.stopPropagation(); busInput.click(); });
    if (busInput) busInput.addEventListener("change", e => {
        const f = e.target.files && e.target.files[0];
        if (f) handleBusinessFile(f);
        e.target.value = "";
    });
    if (busRem) busRem.addEventListener("click", removeBusinessFile);

    const zone = document.getElementById("businessZone");
    if (zone) {
        zone.addEventListener("click", e => {
            if (e.target.id === "businessRemoveBtn") return;
            busInput.click();
        });
        ["dragenter","dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("dragging"); }));
        ["dragleave","drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("dragging"); }));
        zone.addEventListener("drop", e => {
            const f = e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) handleBusinessFile(f);
        });
    }
}

function initProfileForm() {
    const profileForm = document.getElementById("profileForm");
    if (!profileForm) return;
    profileForm.addEventListener("submit", async event => {
        event.preventDefault();
        const updates = {
            company_name: document.getElementById("formCompanyName").value.trim(),
            bio: document.getElementById("formBio").value.trim(),
            headline: document.getElementById("formAddress").value.trim(),
            phone: document.getElementById("formPhone").value.trim()
        };
        const { error } = await supabaseClient.from("profiles").update(updates).eq("id", EMPLOYER_PROFILE.id);
        if (error) { alert("Could not save: " + error.message); return; }
        Object.assign(EMPLOYER_PROFILE, updates);
        fillProfileView();
        alert("Changes saved successfully.");
    });
}


let lastChatKey = "";

function initMessages() {
    const messageForm = document.getElementById("messageForm");
    if (messageForm) {
        messageForm.addEventListener("submit", async event => {
            event.preventDefault();
            const input = document.getElementById("messageInput");
            const text = input.value.trim();
            if (!text) return;
            if (!activeConversationId) { alert("Pick a conversation first, or click Message next to an applicant."); return; }

            const { error } = await supabaseClient.from("messages").insert({
                conversation_id: activeConversationId,
                sender_id: EMPLOYER_PROFILE.id,
                body: text
            });
            if (error) { alert("Could not send: " + error.message); return; }
            input.value = "";
            lastChatKey = "";
            await renderChat();
        });
    }

    setInterval(pollMessages, 4000);
}

async function refreshConversations() {
    const { data, error } = await supabaseClient.from("conversations")
        .select("*, profiles!conversations_jobseeker_id_fkey(full_name, username)")
        .eq("employer_id", EMPLOYER_PROFILE.id)
        .order("created_at", { ascending: false });
    if (error || !data) return;
    const changed = data.length !== MY_CONVERSATIONS.length;
    MY_CONVERSATIONS = data;
    if (changed) renderConversationList();
}

async function pollMessages() {
    if (document.hidden) return;
    await refreshConversations();
    const view = document.getElementById("view-messages");
    if (activeConversationId && view && view.classList.contains("active")) await renderChat();
}

function seekerName(c) {
    return c.profiles ? (c.profiles.full_name || c.profiles.username) : "Job Seeker";
}

function renderConversationList() {
    const list = document.getElementById("conversationList");
    if (!list) return;
    list.innerHTML = "";
    if (!activeConversationId && MY_CONVERSATIONS[0]) activeConversationId = MY_CONVERSATIONS[0].id;

    MY_CONVERSATIONS.forEach(c => {
        const div = document.createElement("div");
        div.className = "conversation" + (c.id === activeConversationId ? " active" : "");
        const name = seekerName(c);
        div.innerHTML = '<div class="avatar">' + name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() + '</div>' +
            '<div><b>' + name + '</b><small>Tap to view conversation</small></div>';
        div.addEventListener("click", () => {
            activeConversationId = c.id;
            renderConversationList();
        });
        list.appendChild(div);
    });

    if (!MY_CONVERSATIONS.length) {
        list.innerHTML = '<div style="padding:16px;color:#888;font-size:13px">No conversations yet. Message an applicant from the Applications tab.</div>';
    }

    lastChatKey = "";
    renderChat();
}

async function renderChat() {
    const head = document.getElementById("chatHead");
    const body = document.getElementById("chatBody");
    if (!head || !body) return;
    const c = MY_CONVERSATIONS.find(x => x.id === activeConversationId);
    if (!c) { head.innerHTML = ""; body.innerHTML = ""; lastChatKey = ""; return; }

    head.innerHTML = seekerName(c) + "<small>Job Seeker</small>";

    const { data: messages, error } = await supabaseClient.from("messages").select("*").eq("conversation_id", c.id).order("created_at", { ascending: true });
    if (error) {
        body.innerHTML = '<div style="padding:16px;color:#c62828;font-size:13px">Could not load messages: ' + error.message + '</div>';
        return;
    }

    const key = c.id + ":" + (messages || []).map(m => m.id).join(",");
    if (key === lastChatKey) return;
    lastChatKey = key;

    body.innerHTML = "";
    (messages || []).forEach(m => {
        const bubble = document.createElement("div");
        bubble.className = "bubble" + (m.sender_id === EMPLOYER_PROFILE.id ? " mine" : "");
        bubble.textContent = m.body;
        body.appendChild(bubble);
    });
    body.scrollTop = body.scrollHeight;
}

async function openOrCreateConversation(jobseekerId, jobId) {
    if (!jobseekerId || jobseekerId === "undefined" || jobseekerId === "null") return;
    let convo = MY_CONVERSATIONS.find(c => c.jobseeker_id === jobseekerId);
    if (!convo) {
        const { data, error } = await supabaseClient.from("conversations")
            .insert({ employer_id: EMPLOYER_PROFILE.id, jobseeker_id: jobseekerId, job_id: jobId || null })
            .select("*, profiles!conversations_jobseeker_id_fkey(full_name, username)")
            .single();
        if (error) { alert("Could not start conversation: " + error.message); return; }
        MY_CONVERSATIONS.unshift(data);
        convo = data;
    }
    activeConversationId = convo.id;
    renderConversationList();
}
