// =========================================================
// WorkHive — Supabase connection (NEW project)
//
// 1. Go to your new project on supabase.com → Project Settings → API
// 2. Copy "Project URL" and paste it below as SUPABASE_URL
// 3. Copy the "anon public" key and paste it below as SUPABASE_ANON_KEY
// 4. Run schema.sql once in the SQL Editor of that same project
// =========================================================
const SUPABASE_URL = "https://dqekyrtibpnvaghogwsa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZWt5cnRpYnBudmFnaG9nd3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjcwMzUsImV4cCI6MjEwNDA0MzAzNX0.ggdaEHSheJZWfMpUYQN6I_HgB0qwvmnryKFKfMTvVhA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (SUPABASE_URL.includes("PASTE_YOUR") || SUPABASE_ANON_KEY.includes("PASTE_YOUR")) {
    console.warn("[Supabase] Add your new project URL and anon key in supabase-client.js");
} else {
    console.log("[Supabase] client ready");
}

// ---------------------------------------------------------
// Shared helpers used across index.html, sign.html and all 3 dashboards
// ---------------------------------------------------------

// Lets people log in with either their email OR their username.
async function resolveLoginEmail(identifier) {
    if (identifier.includes("@")) return identifier;
    const { data, error } = await supabaseClient.rpc("username_to_email", { p_username: identifier });
    if (error || !data) return null;
    return data;
}

// Fetches the signed-in user's profile row (id, username, role, etc.)
async function getCurrentProfile() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
    if (error) {
        console.error("[Supabase] could not load profile:", error.message);
        return null;
    }
    return data;
}

// Sends whoever is logged in to the dashboard that matches their role.
function dashboardUrlForRole(role) {
    if (role === "admin") return "dashboard.html";
    if (role === "employer") return "employer-dashboard.html";
    return "job-seeker-dashboard.html";
}

// Guards a dashboard page: only lets a signed-in user with the right
// role stay on the page; everyone else is redirected. Call this at the
// top of every dashboard page's script. Returns the profile on success.
async function requireRole(allowedRole) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace("index.html");
        return null;
    }
    const profile = await getCurrentProfile();

    // Blocked or currently-banned accounts are signed out immediately.
    if (profile && (profile.is_blocked || (profile.banned_until && new Date(profile.banned_until) > new Date()))) {
        await supabaseClient.auth.signOut();
        window.location.replace("index.html");
        return null;
    }

    if (!profile || profile.role !== allowedRole) {
        // Signed in, but wrong dashboard for their role — send them to the right one.
        window.location.replace(profile ? dashboardUrlForRole(profile.role) : "index.html");
        return null;
    }
    return profile;
}