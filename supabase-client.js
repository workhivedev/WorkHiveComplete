const SUPABASE_URL = "https://dqekyrtibpnvaghogwsa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZWt5cnRpYnBudmFnaG9nd3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjcwMzUsImV4cCI6MjEwNDA0MzAzNX0.ggdaEHSheJZWfMpUYQN6I_HgB0qwvmnryKFKfMTvVhA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (SUPABASE_URL.includes("PASTE_YOUR") || SUPABASE_ANON_KEY.includes("PASTE_YOUR")) {
    console.warn("[Supabase] Add your new project URL and anon key in supabase-client.js");
} else {
    console.log("[Supabase] client ready");
}



async function resolveLoginEmail(identifier) {
    if (identifier.includes("@")) return identifier;
    const { data, error } = await supabaseClient.rpc("username_to_email", { p_username: identifier });
    if (error || !data) return null;
    return data;
}


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


function dashboardUrlForRole(role) {
    if (role === "admin") return "dashboard.html";
    if (role === "employer") return "employer-dashboard.html";
    return "job-seeker-dashboard.html";
}


async function requireRole(allowedRole) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace("index.html");
        return null;
    }
    const profile = await getCurrentProfile();


    if (profile && (profile.is_blocked || (profile.banned_until && new Date(profile.banned_until) > new Date()))) {
        await supabaseClient.auth.signOut();
        window.location.replace("index.html");
        return null;
    }

    if (!profile || profile.role !== allowedRole) {

        window.location.replace(profile ? dashboardUrlForRole(profile.role) : "index.html");
        return null;
    }
    return profile;
}


const WH_BUCKET = "workhive-uploads";

const ALLOWED_IMAGE = {
    "image/jpeg":  ["jpg", "jpeg"],
    "image/png":   ["png"],
    "image/webp":  ["webp"]
};
const ALLOWED_DOC = {
    "application/pdf": ["pdf"],
    "application/msword": ["doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"]
};

const IMG_MAX = 2 * 1024 * 1024;   // 2 MB
const DOC_MAX = 10 * 1024 * 1024;  // 10 MB


async function sniffFile(file) {
    try {
        const head = await file.slice(0, 12).arrayBuffer();
        const b = new Uint8Array(head);
        if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";                     // JPEG
        if (b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47) return "image/png";             // PNG
        if (b[0]===0x52 && b[1]===0x49 && b[2]===0x46 && b[3]===0x46 &&
            b[8]===0x57 && b[9]===0x45 && b[10]===0x42 && b[11]===0x50) return "image/webp";          // WEBP
        if (b[0]===0x25 && b[1]===0x50 && b[2]===0x44 && b[3]===0x46) return "application/pdf";       // PDF
    } catch {}
    return "unknown";
}


function validateUpload(file, kind) {
    const allowed = kind === "image" ? ALLOWED_IMAGE : ALLOWED_DOC;
    const maxMB   = kind === "image" ? 2 : 10;
    const mime    = (file.type || "").toLowerCase();
    const ext     = (file.name.split(".").pop() || "").toLowerCase();

    if (!Object.keys(allowed).includes(mime))
        return "Invalid file type. Allowed: " + Object.keys(allowed).join(", ");
    if (!allowed[mime].includes(ext))
        return "Wrong file extension for " + mime + ". Expected ." + allowed[mime].join(" or .");
    if (file.size > maxMB * 1024 * 1024)
        return "File is too large. Max " + maxMB + " MB (your file is " +
                (file.size / 1024 / 1024).toFixed(1) + " MB).";
    return null;
}

async function uploadWhFile(file, slot, profileId) {
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = profileId + "/" + slot + "/" + Date.now() + "_" + safe;
    const { error } = await supabaseClient.storage
        .from(WH_BUCKET)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type
        });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(WH_BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
}


async function deleteWhFile(url) {
    if (!url) return;
    const marker = "/storage/v1/object/public/" + WH_BUCKET + "/";
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.substring(idx + marker.length);
    try { await supabaseClient.storage.from(WH_BUCKET).remove([path]); } catch {}
}

window.WH_BUCKET      = WH_BUCKET;
window.validateUpload = validateUpload;
window.sniffFile      = sniffFile;
window.uploadWhFile   = uploadWhFile;
window.deleteWhFile   = deleteWhFile;
