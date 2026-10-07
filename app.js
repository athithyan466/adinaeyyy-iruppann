const MAX = 60;
const BUCKET = "songs";

const { createClient } = window.supabase;

const supabaseClient = createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const $ = id => document.getElementById(id);

const screens = {
  home: $("home"),
  add: $("add"),
  play: $("play")
};

const audio = $("audio");

let currentSong = null;
let currentUrl = null;
let voices = [];

function showScreen(name) {
  Object.values(screens).forEach(s => s && s.classList.remove("active"));
  if (screens[name]) screens[name].classList.add("active");
  if (name !== "play") stopAudio();
  if (name === "add") loadOwnSong();
}

function status(message, error = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = message;
  el.className = "status" + (error ? " error" : "");
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

async function participantSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return session;

  const { data, error } = await supabaseClient.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

async function countSongs() {
  const { count, error } = await supabaseClient
    .from("songs")
    .select("id", { count: "exact", head: true });

  if (error) throw error;

  const n = Number(count || 0);
  if ($("countHome")) $("countHome").textContent = `${n} / ${MAX}`;
  if ($("countAdd")) $("countAdd").textContent = `${n} / ${MAX}`;
  return n;
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return [];
  voices = speechSynthesis.getVoices();
  return voices;
}

if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function indianVoice() {
  const vs = loadVoices();
  return (
    vs.find(v => (v.lang || "").toLowerCase() === "en-in") ||
    vs.find(v => /india|ravi|heera/i.test(v.name || "") && (v.lang || "").toLowerCase().startsWith("en")) ||
    vs.find(v => (v.lang || "").toLowerCase().startsWith("en")) ||
    vs[0] ||
    null
  );
}

function announce(name) {
  if (!("speechSynthesis" in window)) return Promise.resolve();

  speechSynthesis.cancel();
  speechSynthesis.resume();

  const u = new SpeechSynthesisUtterance(`HERE COMES ${name}`);
  const v = indianVoice();

  if (v) {
    u.voice = v;
    u.lang = v.lang || "en-IN";
  } else {
    u.lang = "en-IN";
  }

  u.rate = 0.72;
  u.pitch = 0.7;
  u.volume = 1;

  return new Promise(resolve => {
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

async function playOwnSong(song) {
  try {
    stopAudio();
    currentSong = song;

    $("announcement").textContent = `HERE COMES ${song.name}`;
    $("trackName").textContent = song.song_name;

    const { data, error } = await supabaseClient.storage
      .from(BUCKET)
      .createSignedUrl(song.file_path, 3600);

    if (error) throw error;

    currentUrl = data.signedUrl;
    audio.src = currentUrl;
    audio.load();

    await announce(song.name);
    await audio.play();

    $("playPauseBtn").textContent = "❚❚";
  } catch (e) {
    console.error(e);
    $("announcement").textContent = "PLAYBACK ERROR";
    $("trackName").textContent = e.message || "Unable to play your song";
  }
}

function stopAudio() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  currentUrl = null;
  if ($("playPauseBtn")) $("playPauseBtn").textContent = "▶";
}

async function loadOwnSong() {
  try {
    const session = await participantSession();

    const { data, error } = await supabaseClient
      .from("songs")
      .select("id,name,song_name,file_path,created_at")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const btn = $("mySongBtn");
    if (!btn) return;

    if (data) {
      btn.hidden = false;
      btn.onclick = () => {
        showScreen("play");
        playOwnSong(data);
      };
    } else {
      btn.hidden = true;
    }

    await countSongs();
  } catch (e) {
    console.error(e);
  }
}

async function addSong() {
  const name = $("nameInput").value.trim();
  const title = $("songInput").value.trim();
  const file = $("fileInput").files[0];

  if (!name || !title || !file) {
    status("Please enter your name, song name and audio file.", true);
    return;
  }

  if (!file.type.startsWith("audio/")) {
    status("Please select an audio file.", true);
    return;
  }

  if (file.size > 25 * 1024 * 1024) {
    status("Maximum audio file size is 25 MB.", true);
    return;
  }

  const btn = $("saveBtn");

  try {
    btn.disabled = true;
    status("Uploading...");

    const total = await countSongs();
    if (total >= MAX) throw new Error("The 60-song limit has been reached.");

    const session = await participantSession();
    const ext = (file.name.split(".").pop() || "audio").replace(/[^a-z0-9]/gi, "").toLowerCase() || "audio";
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;

    const upload = await supabaseClient.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (upload.error) throw upload.error;

    const insert = await supabaseClient.from("songs").insert({
      owner_id: session.user.id,
      name,
      song_name: title,
      file_path: path
    }).select("id,name,song_name,file_path,created_at").single();

    if (insert.error) {
      await supabaseClient.storage.from(BUCKET).remove([path]);
      throw insert.error;
    }

    localStorage.setItem("mySongId", String(insert.data.id));

    $("nameInput").value = "";
    $("songInput").value = "";
    $("fileInput").value = "";

    status("Song added successfully.");
    await countSongs();
    await loadOwnSong();
  } catch (e) {
    console.error(e);
    status(e.message || "Upload failed.", true);
  } finally {
    btn.disabled = false;
  }
}

$("addBtn")?.addEventListener("click", async () => {
  showScreen("add");
  await loadOwnSong();
});

$("saveBtn")?.addEventListener("click", addSong);

$("playPauseBtn")?.addEventListener("click", async () => {
  if (!audio.src || !currentSong) return;

  if (audio.paused) {
    await audio.play();
    $("playPauseBtn").textContent = "❚❚";
  } else {
    audio.pause();
    $("playPauseBtn").textContent = "▶";
  }
});

$("progress")?.addEventListener("input", e => {
  if (audio.duration) audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
});

audio.ontimeupdate = () => {
  if (!audio.duration) return;
  $("progress").value = (audio.currentTime / audio.duration) * 100;
  $("currentTime").textContent = formatTime(audio.currentTime);
  $("duration").textContent = formatTime(audio.duration);
};

audio.onended = () => {
  $("playPauseBtn").textContent = "▶";
};

document.querySelectorAll("[data-back]").forEach(b => {
  b.addEventListener("click", () => showScreen("home"));
});

(async () => {
  try {
    await participantSession();
    await countSongs();
    await loadOwnSong();
  } catch (e) {
    console.error(e);
    status(e.message || "Unable to connect to Supabase.", true);
  }
})();
