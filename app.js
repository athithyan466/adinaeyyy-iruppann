<<<<<<< HEAD
const MAX = 200;
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
=======
const DB_NAME = "adineyy-iruppen-db";
const STORE = "songs";
const MAX = 60;

let db = null;
let songs = [];
let queue = [];
let queueIndex = 0;

let currentUrl = null;
let shuffled = true;
let repeat = false;
let isSpeaking = false;

let voices = [];

const $ = (id) => document.getElementById(id);
>>>>>>> 905e3f72096e4dae7c3aecf46cdd8eaad4e48cf1

const screens = {
  home: $("home"),
  add: $("add"),
<<<<<<< HEAD
  play: $("play")
=======
  play: $("play"),
>>>>>>> 905e3f72096e4dae7c3aecf46cdd8eaad4e48cf1
};

const audio = $("audio");

<<<<<<< HEAD
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
=======

/* =========================================================
   DATABASE
========================================================= */

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


function getAllSongs() {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


function addSong(song) {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .add(song);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


function deleteSong(id) {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


/* =========================================================
   SCREEN
========================================================= */

function showScreen(name) {
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("active");
  });

  screens[name].classList.add("active");
}


/* =========================================================
   COUNT
========================================================= */

function updateCounts(count) {
  if ($("countHome")) {
    $("countHome").textContent = `${count} / 60`;
  }

  if ($("countAdd")) {
    $("countAdd").textContent = `${count} / 60`;
  }

  if ($("playCount")) {
    $("playCount").textContent = `${count} / 60`;
  }
}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);

  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${secs}`;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return map[character];
    }
  );
}


/* =========================================================
   REFRESH SONG LIST
========================================================= */

async function refreshSongs() {
  songs = await getAllSongs();

  updateCounts(songs.length);

  const list = $("savedList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  songs.forEach((song) => {
    const row = document.createElement("div");

    row.className = "saved-item";

    row.innerHTML = `
      <span>
        ${escapeHtml(song.name)}
        —
        ${escapeHtml(song.title)}
      </span>
    `;

    const removeButton =
      document.createElement("button");

    removeButton.textContent = "Remove";

    removeButton.onclick = async () => {
      await deleteSong(song.id);

      await refreshSongs();
    };

    row.appendChild(removeButton);

    list.appendChild(row);
  });
}


/* =========================================================
   VOICE LOADING
========================================================= */

function loadVoices() {
  if (!("speechSynthesis" in window)) {
    return [];
  }

  voices = speechSynthesis.getVoices();

  return voices;
}


if ("speechSynthesis" in window) {
  loadVoices();

  speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}


/* =========================================================
   FIND INDIAN ENGLISH VOICE
========================================================= */

function findBestVoice() {
  const available =
    loadVoices();

  if (!available.length) {
    return null;
  }


  /* Exact Indian English */

  const indianVoices =
    available.filter((voice) => {
      return (
        voice.lang &&
        voice.lang.toLowerCase() === "en-in"
      );
    });


  /* Prefer Microsoft Indian voices */

  const microsoftIndian =
    indianVoices.find((voice) => {
      return (
        voice.name
          .toLowerCase()
          .includes("ravi") ||
        voice.name
          .toLowerCase()
          .includes("heera") ||
        voice.name
          .toLowerCase()
          .includes("india")
      );
    });

  if (microsoftIndian) {
    return microsoftIndian;
  }


  if (indianVoices.length > 0) {
    return indianVoices[0];
  }


  /* Any English Indian-style voice */

  const englishIndia =
    available.find((voice) => {
      return (
        voice.lang &&
        voice.lang
          .toLowerCase()
          .startsWith("en-in")
      );
    });

  if (englishIndia) {
    return englishIndia;
  }


  /* Microsoft English fallback */

  const microsoftEnglish =
    available.find((voice) => {
      return (
        voice.name
          .toLowerCase()
          .includes("microsoft") &&
        voice.lang
          .toLowerCase()
          .startsWith("en")
      );
    });

  if (microsoftEnglish) {
    return microsoftEnglish;
  }


  /* Google English fallback */

  const googleEnglish =
    available.find((voice) => {
      return (
        voice.name
          .toLowerCase()
          .includes("google") &&
        voice.lang
          .toLowerCase()
          .startsWith("en")
      );
    });

  if (googleEnglish) {
    return googleEnglish;
  }


  /* Any English voice */

  const english =
    available.find((voice) => {
      return voice.lang
        .toLowerCase()
        .startsWith("en");
    });

  if (english) {
    return english;
  }


  return available[0];
}


/* =========================================================
   WAIT FOR VOICES
========================================================= */

function waitForVoices() {
  return new Promise((resolve) => {
    const existing =
      loadVoices();

    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;

      if ("speechSynthesis" in window) {
        speechSynthesis.removeEventListener(
          "voiceschanged",
          finish
        );
      }

      resolve(loadVoices());
    };

    if ("speechSynthesis" in window) {
      speechSynthesis.addEventListener(
        "voiceschanged",
        finish
      );
    }

    setTimeout(finish, 1200);
  });
}


/* =========================================================
   ANNOUNCE NAME
========================================================= */

function announceName(name) {
  return new Promise(async (resolve) => {

    if (!("speechSynthesis" in window)) {
      console.log(
        "Speech synthesis is not supported."
      );

      resolve();
      return;
    }


    if (!name || !name.trim()) {
      resolve();
      return;
    }


    await waitForVoices();


    speechSynthesis.cancel();

    speechSynthesis.resume();


    const voice =
      findBestVoice();


    const cleanName =
      name.trim();


    const announcement =
      `HERE COMES ${cleanName}`;


    const utterance =
      new SpeechSynthesisUtterance(
        announcement
      );


    if (voice) {
      utterance.voice = voice;

      utterance.lang =
        voice.lang || "en-IN";
    } else {
      utterance.lang = "en-IN";
    }


    /*
      Stronger and clearer announcement
    */

    utterance.rate = 0.72;

    utterance.pitch = 0.70;

    utterance.volume = 1.0;


    isSpeaking = true;


    utterance.onstart = () => {
      console.log(
        "ANNOUNCING:",
        announcement
      );

      console.log(
        "VOICE:",
        voice
          ? `${voice.name} (${voice.lang})`
          : "Browser default"
      );
    };


    utterance.onend = () => {
      isSpeaking = false;

      resolve();
    };


    utterance.onerror = (event) => {
      console.error(
        "Speech error:",
        event
      );

      isSpeaking = false;

      resolve();
    };


    /*
      Important:
      resume() makes Chrome/Edge continue
      the speech engine if it is paused.
    */

    speechSynthesis.resume();


    speechSynthesis.speak(
      utterance
    );
  });
}


/* =========================================================
   HOME → ADD
========================================================= */

$("addBtn").onclick = async () => {
  await refreshSongs();

  showScreen("add");
};


/* =========================================================
   HOME → PLAY
========================================================= */

$("playBtn").onclick = () => {

  /*
    IMPORTANT:
    Do not use await before starting playback.
    The browser keeps the button interaction alive.
  */

  if (!songs.length) {

    showScreen("play");

    $("announcement").textContent =
      "NO SONGS";

    $("trackName").textContent =
      "Add a song first";

    return;
  }


  showScreen("play");


  queue = [...songs];


  startPlaylist();
};


/* =========================================================
   BACK
========================================================= */

document
  .querySelectorAll("[data-back]")
  .forEach((button) => {

    button.onclick = () => {

      speechSynthesis.cancel();

      isSpeaking = false;

      audio.pause();

      if (currentUrl) {
        URL.revokeObjectURL(
          currentUrl
        );

        currentUrl = null;
      }

      showScreen("home");
    };
  });


/* =========================================================
   ADD SONG
========================================================= */

$("saveBtn").onclick = async () => {

  const name =
    $("nameInput").value.trim();

  const title =
    $("songInput").value.trim();

  const file =
    $("fileInput").files[0];


  if (!name) {
    alert("Enter the person's name.");

    return;
  }


  if (!title) {
    alert("Enter the favorite song name.");

    return;
  }


  if (!file) {
    alert("Choose a song file.");

    return;
  }


  if (songs.length >= MAX) {
    alert("60 songs maximum.");

    return;
  }


  if (!file.type.startsWith("audio/")) {
    alert(
      "Please choose an audio file."
    );

    return;
  }


  await addSong({
    name: name,
    title: title,
    file: file,
    type: file.type,
  });


  $("nameInput").value = "";

  $("songInput").value = "";

  $("fileInput").value = "";


  await refreshSongs();
};


/* =========================================================
   SHUFFLE QUEUE
========================================================= */

function shuffleQueue() {

  queue = [...songs];


  if (!shuffled) {
    queueIndex = 0;

    return;
  }


  for (
    let i = queue.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      queue[i],
      queue[j],
    ] = [
      queue[j],
      queue[i],
    ];
  }


  queueIndex = 0;
}


/* =========================================================
   START PLAYLIST
========================================================= */

function startPlaylist() {

  if (!songs.length) {
    return;
  }


  shuffleQueue();


  /*
    This is intentionally NOT awaited.
    The announcement begins immediately.
  */

  playCurrentSong(true);
}


/* =========================================================
   PLAY CURRENT SONG
========================================================= */

async function playCurrentSong(
  announce = true
) {

  const song =
    queue[queueIndex];


  if (!song) {
    return;
  }


  speechSynthesis.cancel();


  if (currentUrl) {
    URL.revokeObjectURL(
      currentUrl
    );
  }


  currentUrl =
    URL.createObjectURL(
      song.file
    );


  audio.src = currentUrl;


  $("trackName").textContent =
    song.title;


  $("announcement").textContent =
    `HERE COMES ${song.name.toUpperCase()}`;


  $("progress").value = 0;

  $("currentTime").textContent =
    "0:00";

  $("duration").textContent =
    "0:00";


  $("playPauseBtn").textContent =
    "▶";


  /*
    MOST IMPORTANT PART
  */

  if (announce) {

    await announceName(
      song.name
    );
  }


  /*
    Song starts ONLY after
    the announcement finishes.
  */

  try {

    await audio.play();

    $("playPauseBtn").textContent =
      "Ⅱ";

  } catch (error) {

    console.error(
      "Audio playback error:",
      error
    );
  }
}


/* =========================================================
   NEXT
========================================================= */

async function nextSong() {

  if (!queue.length) {
    return;
  }


  speechSynthesis.cancel();


  if (repeat) {

    await playCurrentSong(
      true
    );

    return;
  }


  queueIndex =
    (queueIndex + 1) %
    queue.length;


  await playCurrentSong(
    true
  );
}


/* =========================================================
   PREVIOUS
========================================================= */

async function previousSong() {

  if (!queue.length) {
    return;
  }


  speechSynthesis.cancel();


  queueIndex =
    (queueIndex - 1 + queue.length) %
    queue.length;


  await playCurrentSong(
    true
  );
}


/* =========================================================
   PLAY / PAUSE
========================================================= */

$("playPauseBtn").onclick =
  async () => {

    if (isSpeaking) {
      return;
    }


    if (audio.paused) {

      try {

        await audio.play();

        $("playPauseBtn").textContent =
          "Ⅱ";

      } catch (error) {

        console.error(error);
      }

    } else {

      audio.pause();

      $("playPauseBtn").textContent =
        "▶";
    }
  };


/* =========================================================
   NEXT / PREVIOUS BUTTONS
========================================================= */

$("nextBtn").onclick =
  nextSong;

$("prevBtn").onclick =
  previousSong;


/* =========================================================
   SHUFFLE
========================================================= */

$("shuffleBtn").onclick =
  () => {

    shuffled = !shuffled;


    $("shuffleBtn").style.opacity =
      shuffled
        ? "1"
        : "0.45";


    if (!songs.length) {
      return;
    }


    shuffleQueue();


    playCurrentSong(true);
  };


/* =========================================================
   REPEAT
========================================================= */

$("repeatBtn").onclick =
  () => {

    repeat = !repeat;


    $("repeatBtn").style.opacity =
      repeat
        ? "1"
        : "0.45";
  };


/* =========================================================
   SONG ENDED
========================================================= */

audio.addEventListener(
  "ended",
  () => {

    nextSong();
  }
);


/* =========================================================
   TIME UPDATE
========================================================= */

audio.addEventListener(
  "timeupdate",
  () => {

    if (!audio.duration) {
      return;
    }


    $("progress").value =
      (audio.currentTime /
        audio.duration) *
      100;


    $("currentTime").textContent =
      formatTime(
        audio.currentTime
      );


    $("duration").textContent =
      formatTime(
        audio.duration
      );
  }
);


/* =========================================================
   PROGRESS
========================================================= */

$("progress").oninput = () => {

  if (!audio.duration) {
    return;
  }


  audio.currentTime =
    (+$("progress").value / 100) *
    audio.duration;
};


/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {

  await openDB();

  /*
    Load songs BEFORE the user presses
    PLAY SONGS.
  */

  await refreshSongs();


  /*
    Load browser voices early.
  */

  if ("speechSynthesis" in window) {

    loadVoices();

    setTimeout(() => {
      loadVoices();
    }, 500);

    setTimeout(() => {
      loadVoices();
    }, 1500);
  }
}


initialize();
>>>>>>> 905e3f72096e4dae7c3aecf46cdd8eaad4e48cf1
