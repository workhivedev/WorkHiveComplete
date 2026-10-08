function highlightAbout() {
    const section = document.getElementById('about');
    section.scrollIntoView({ behavior: 'smooth' });
    section.style.background = 'white';
    setTimeout(() => {
        section.style.background = '#fafafa';
    }, 1200);
}


let HOME_JOBS = [];
let HOME_PROFILE = null;

function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function timeAgo(dateStr) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days <= 0) return "Posted today";
    if (days === 1) return "Posted yesterday";
    if (days < 30) return "Posted " + days + " days ago";
    return "Posted " + new Date(dateStr).toLocaleDateString();
}

function companyOf(job) {
    return job.profiles ? (job.profiles.company_name || job.profiles.full_name || "Employer") : "Employer";
}

async function initHomeAuth() {
    const btn = document.getElementById("headerAuthBtn");
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    HOME_PROFILE = await getCurrentProfile();
    if (HOME_PROFILE && btn) {
        btn.textContent = "Go to Dashboard";
        btn.href = dashboardUrlForRole(HOME_PROFILE.role);
    }
}

async function loadHomeJobs() {
    const subtitle = document.getElementById("jobsSubtitle");
    const { data, error } = await supabaseClient
        .from("jobs")
        .select("*, profiles!jobs_employer_id_fkey(company_name, full_name)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(12);

    if (error) {
        console.error("[homepage] could not load jobs:", error.message);
        subtitle.textContent = "We couldn't load jobs right now. Please try again later.";
        HOME_JOBS = [];
    } else {
        HOME_JOBS = data || [];
        subtitle.textContent = HOME_JOBS.length
            ? "Showing the latest " + HOME_JOBS.length + " open position" + (HOME_JOBS.length === 1 ? "" : "s") + " posted by employers on WorkHive."
            : "No open positions yet — new jobs posted by employers will appear here.";
    }

    document.getElementById("statJobs").textContent = HOME_JOBS.length;
    document.getElementById("statCompanies").textContent = new Set(HOME_JOBS.map(j => j.employer_id)).size;
    renderHomeJobs(HOME_JOBS);
}

function renderHomeJobs(list) {
    const el = document.getElementById("homeJobsList");
    if (!list.length) {
        el.innerHTML = '<div class="job-empty"><i class="fa-regular fa-folder-open"></i><p>No jobs found.</p></div>';
        return;
    }
    const applyHref = HOME_PROFILE ? dashboardUrlForRole(HOME_PROFILE.role) : "index.html";
    el.innerHTML = list.map(job => `
        <div class="job-card">
            <div class="job-card-top">
                <h4>${escapeHtml(job.title)}</h4>
                ${job.job_type ? `<span class="job-tag">${escapeHtml(job.job_type)}</span>` : ""}
            </div>
            <div class="job-meta">
                <span><i class="fa-solid fa-building"></i> ${escapeHtml(companyOf(job))}</span>
                ${job.location ? `<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(job.location)}</span>` : ""}
                ${job.salary ? `<span><i class="fa-solid fa-peso-sign"></i> ${escapeHtml(job.salary)}</span>` : ""}
            </div>
            <p>${escapeHtml((job.description || "").slice(0, 160))}${(job.description || "").length > 160 ? "…" : ""}</p>
            <div class="job-card-foot">
                <small>${timeAgo(job.created_at)}${job.category ? " • " + escapeHtml(job.category) : ""}</small>
                <a href="${applyHref}" class="btn-apply">Apply Now</a>
            </div>
        </div>`).join("");
}

function initHeroSearch() {
    const form = document.getElementById("heroSearchForm");
    const input = document.getElementById("heroSearchInput");
    const filter = () => {
        const term = input.value.trim().toLowerCase();
        const filtered = HOME_JOBS.filter(j =>
            [j.title, j.location, j.category, j.job_type, j.description, companyOf(j)].join(" ").toLowerCase().includes(term));
        renderHomeJobs(filtered);
        return filtered;
    };
    form.addEventListener("submit", e => {
        e.preventDefault();
        filter();
        document.getElementById("jobs").scrollIntoView({ behavior: "smooth" });
    });
    input.addEventListener("input", filter);
}

document.addEventListener("DOMContentLoaded", async () => {
    initHeroSearch();
    await initHomeAuth();
    await loadHomeJobs();
});
