const { createClient } = window.supabase;

const supabaseClient = createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

const BUCKET = "songs";

const $ = id => document.getElementById(id);

const refreshBtn = $("refreshBtn");
const songsList = $("songsList");
const adminAudio = $("adminAudio");
const playAllBtn = $("playAllBtn");

let songs = [];
let queue = [];
let queueIndex = 0;

let shuffleOn = true;
let repeatOn = false;

let currentSong = null;
let currentUrl = null;


function status(el, message, error = false) {

    if (!el) return;

    el.textContent = message;

    el.className =
        "admin-status" +
        (error ? " error" : "");
}


function playerStatus(message, error = false) {

    const el = $("adminPlayerStatus");

    if (!el) return;

    el.textContent = message;

    el.style.color =
        error ? "#ff6666" : "#888";
}


function fmt(sec) {

    if (!Number.isFinite(sec)) {
        return "0:00";
    }

    return `${Math.floor(sec / 60)}:${String(
        Math.floor(sec % 60)
    ).padStart(2, "0")}`;
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function dateText(value) {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


async function loadSongs() {

    try {

        status(
            $("adminStatus"),
            "Loading songs..."
        );

        const {
            data,
            error
        } = await supabaseClient
            .from("songs")
            .select(
                "id,owner_id,name,song_name,file_path,created_at"
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        songs = data || [];

        $("adminCount").textContent =
            `${songs.length} / 60`;

        buildQueue();

        renderLibrary();

        status(
            $("adminStatus"),
            ""
        );

        if (!songs.length) {

            $("adminNowTitle").textContent =
                "NO SONGS";

            $("adminNowPerson").textContent =
                "Add songs to start playing";

            $("adminTrackTitle").textContent =
                "NO SONGS";

            $("adminAnnouncement").textContent =
                "READY";
        }

    } catch (error) {

        console.error(error);

        status(
            $("adminStatus"),
            error.message ||
            "Unable to load songs.",
            true
        );
    }
}


function buildQueue() {

    if (!songs.length) {

        queue = [];
        queueIndex = 0;

        return;
    }

    if (shuffleOn) {

        queue = [...songs];

        for (
            let i = queue.length - 1;
            i > 0;
            i--
        ) {

            const j =
                Math.floor(
                    Math.random() * (i + 1)
                );

            [
                queue[i],
                queue[j]
            ] = [
                queue[j],
                queue[i]
            ];
        }

    } else {

        queue = [...songs];
    }

    if (currentSong) {

        const index =
            queue.findIndex(
                song =>
                    song.id === currentSong.id
            );

        queueIndex =
            index >= 0 ? index : 0;

    } else {

        queueIndex = 0;
    }
}


async function getSignedUrl(song) {

    const {
        data,
        error
    } = await supabaseClient.storage
        .from(BUCKET)
        .createSignedUrl(
            song.file_path,
            3600
        );

    if (error) {
        throw error;
    }

    if (!data?.signedUrl) {
        throw new Error(
            "Unable to create song URL."
        );
    }

    return data.signedUrl;
}


function getVoice() {

    if (!("speechSynthesis" in window)) {
        return null;
    }

    const voices =
        speechSynthesis.getVoices();

    return (
        voices.find(
            voice =>
                (voice.lang || "")
                    .toLowerCase() === "en-in"
        ) ||

        voices.find(
            voice =>
                /india|ravi|heera/i.test(
                    voice.name || ""
                ) &&
                (voice.lang || "")
                    .toLowerCase()
                    .startsWith("en")
        ) ||

        voices.find(
            voice =>
                (voice.lang || "")
                    .toLowerCase()
                    .startsWith("en")
        ) ||

        voices[0] ||
        null
    );
}


function announce(name) {

    if (!("speechSynthesis" in window)) {
        return Promise.resolve();
    }

    speechSynthesis.cancel();
    speechSynthesis.resume();

    const text =
        `HERE COMES ${name}`;

    const utterance =
        new SpeechSynthesisUtterance(text);

    const voice = getVoice();

    if (voice) {
        utterance.voice = voice;
        utterance.lang =
            voice.lang || "en-IN";
    } else {
        utterance.lang = "en-IN";
    }

    utterance.rate = 0.72;
    utterance.pitch = 0.7;
    utterance.volume = 1;

    return new Promise(resolve => {

        utterance.onend = resolve;
        utterance.onerror = resolve;

        speechSynthesis.speak(
            utterance
        );
    });
}


async function playSong(
    song,
    announceIt = true
) {

    try {

        if (!song) {
            return;
        }

        stop();

        currentSong = song;

        const index =
            queue.findIndex(
                item =>
                    item.id === song.id
            );

        if (index >= 0) {
            queueIndex = index;
        }

        $("adminNowTitle").textContent =
            song.song_name;

        $("adminNowPerson").textContent =
            song.name;

        $("adminTrackTitle").textContent =
            song.song_name;

        $("adminAnnouncement").textContent =
            `HERE COMES ${song.name}`;

        playerStatus(
            `Preparing ${song.song_name}...`
        );

        currentUrl =
            await getSignedUrl(song);

        adminAudio.src =
            currentUrl;

        adminAudio.load();

        if (announceIt) {
            await announce(song.name);
        }

        await adminAudio.play();

        $("adminPlayBtn").textContent =
            "❚❚";

        playerStatus(
            `Playing ${song.song_name} — ${song.name}`
        );

    } catch (error) {

        console.error(error);

        playerStatus(
            error.message ||
            "Unable to play song.",
            true
        );
    }
}


function stop() {

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    adminAudio.pause();

    adminAudio.removeAttribute("src");

    adminAudio.load();

    currentUrl = null;

    $("adminPlayBtn").textContent =
        "▶";
}


async function togglePlay() {

    if (!currentSong) {

        if (queue.length) {
            await playSong(
                queue[queueIndex]
            );
        }

        return;
    }

    if (adminAudio.paused) {

        try {

            await adminAudio.play();

            $("adminPlayBtn").textContent =
                "❚❚";

        } catch (error) {

            console.error(error);

            playerStatus(
                "Unable to resume song.",
                true
            );
        }

    } else {

        adminAudio.pause();

        $("adminPlayBtn").textContent =
            "▶";
    }
}


async function nextSong() {

    if (!songs.length) {
        return;
    }

    if (!queue.length) {
        buildQueue();
    }

    if (
        queueIndex >=
        queue.length - 1
    ) {

        if (repeatOn) {

            queueIndex = 0;

        } else {

            buildQueue();

            queueIndex = 0;
        }

    } else {

        queueIndex++;
    }

    await playSong(
        queue[queueIndex]
    );
}


async function previousSong() {

    if (!songs.length) {
        return;
    }

    if (!queue.length) {
        buildQueue();
    }

    if (queueIndex <= 0) {

        queueIndex =
            queue.length - 1;

    } else {

        queueIndex--;
    }

    await playSong(
        queue[queueIndex]
    );
}


function toggleShuffle() {

    shuffleOn =
        !shuffleOn;

    $("shuffleState").textContent =
        shuffleOn
            ? "SHUFFLE ON"
            : "SHUFFLE OFF";

    $("shuffleBtn").classList.toggle(
        "active",
        shuffleOn
    );

    buildQueue();
}


function toggleRepeat() {

    repeatOn =
        !repeatOn;

    $("repeatBtn").classList.toggle(
        "active",
        repeatOn
    );
}


async function playAllSongs() {

    if (!songs.length) {

        playerStatus(
            "No songs available.",
            true
        );

        return;
    }

    shuffleOn = true;

    $("shuffleState").textContent =
        "SHUFFLE ON";

    $("shuffleBtn").classList.add(
        "active"
    );

    currentSong = null;

    buildQueue();

    queueIndex = 0;

    await playSong(
        queue[queueIndex]
    );
}


function renderLibrary() {

    songsList.innerHTML = "";

    if (!songs.length) {

        songsList.innerHTML =
            `
            <div class="admin-empty">
                NO SONGS YET
            </div>
            `;

        return;
    }

    songs.forEach(
        (song, index) => {

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "admin-song-card";

            card.innerHTML =
                `
                <div class="admin-song-number">
                    ${String(index + 1).padStart(2, "0")}
                </div>

                <div class="admin-song-copy">

                    <div class="admin-song-person">
                        ${escapeHtml(song.name)}
                    </div>

                    <div class="admin-song-name">
                        ${escapeHtml(song.song_name)}
                    </div>

                    <div class="admin-song-date">
                        ${escapeHtml(
                            dateText(song.created_at)
                        )}
                    </div>

                </div>

                <div class="admin-card-actions">

                    <button
                        class="admin-card-play"
                        type="button"
                    >
                        PLAY
                    </button>

                    <button
                        class="admin-card-delete"
                        type="button"
                    >
                        DELETE
                    </button>

                </div>
                `;

            card.querySelector(
                ".admin-card-play"
            ).onclick = () => {

                if (
                    !queue.length ||
                    !shuffleOn
                ) {
                    buildQueue();
                }

                playSong(song);
            };

            card.querySelector(
                ".admin-card-delete"
            ).onclick = () => {

                deleteSong(song);
            };

            songsList.appendChild(card);
        }
    );
}


async function deleteSong(song) {

    const confirmed =
        confirm(
            `Delete "${song.song_name}" submitted by ${song.name}?`
        );

    if (!confirmed) {
        return;
    }

    try {

        status(
            $("adminStatus"),
            "Deleting..."
        );

        if (
            currentSong?.id ===
            song.id
        ) {
            stop();
            currentSong = null;
        }

        const {
            error: storageError
        } = await supabaseClient.storage
            .from(BUCKET)
            .remove([
                song.file_path
            ]);

        if (storageError) {
            console.warn(
                storageError
            );
        }

        const {
            error
        } = await supabaseClient
            .from("songs")
            .delete()
            .eq(
                "id",
                song.id
            );

        if (error) {
            throw error;
        }

        await loadSongs();

        status(
            $("adminStatus"),
            "Song deleted."
        );

    } catch (error) {

        console.error(error);

        status(
            $("adminStatus"),
            error.message ||
            "Delete failed.",
            true
        );
    }
}


refreshBtn.onclick =
    loadSongs;


$("adminPlayBtn").onclick =
    togglePlay;


$("nextBtn").onclick =
    nextSong;


$("prevBtn").onclick =
    previousSong;


$("shuffleBtn").onclick =
    toggleShuffle;


$("repeatBtn").onclick =
    toggleRepeat;


playAllBtn.onclick =
    playAllSongs;


$("adminProgress").oninput =
    event => {

        if (!adminAudio.duration) {
            return;
        }

        adminAudio.currentTime =
            (
                Number(event.target.value) /
                100
            ) *
            adminAudio.duration;
    };


adminAudio.ontimeupdate =
    () => {

        if (!adminAudio.duration) {
            return;
        }

        $("adminProgress").value =
            (
                adminAudio.currentTime /
                adminAudio.duration
            ) *
            100;

        $("adminCurrentTime").textContent =
            fmt(
                adminAudio.currentTime
            );

        $("adminDuration").textContent =
            fmt(
                adminAudio.duration
            );
    };


adminAudio.onplay =
    () => {

        $("adminPlayBtn").textContent =
            "❚❚";
    };


adminAudio.onpause =
    () => {

        $("adminPlayBtn").textContent =
            "▶";
    };


adminAudio.onended =
    async () => {

        $("adminPlayBtn").textContent =
            "▶";

        if (
            repeatOn &&
            currentSong
        ) {

            await playSong(
                currentSong
            );

        } else {

            await nextSong();
        }
    };


if ("speechSynthesis" in window) {

    speechSynthesis.onvoiceschanged =
        () => {
            speechSynthesis.getVoices();
        };
}


(async function init() {

    await loadSongs();

})();