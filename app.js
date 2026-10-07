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

const screens = {
  home: $("home"),
  add: $("add"),
  play: $("play"),
};

const audio = $("audio");


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