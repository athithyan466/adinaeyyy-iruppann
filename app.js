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
let isSpeaking = false;


function showScreen(name) {
    Object.values(screens).forEach(screen => {
        if (screen) {
            screen.classList.remove("active");
        }
    });

    if (screens[name]) {
        screens[name].classList.add("active");
    }

    if (name !== "play") {
        stopAudio();
    }

    if (name === "add") {
        loadOwnSong();
    }
}


function status(message, error = false) {
    const element = $("status");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className =
        "status" + (error ? " error" : "");
}


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


async function participantSession() {
    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();

    if (session) {
        return session;
    }

    const {
        data,
        error
    } = await supabaseClient.auth.signInAnonymously();

    if (error) {
        throw error;
    }

    return data.session;
}


async function countSongs() {
    const {
        count,
        error
    } = await supabaseClient
        .from("songs")
        .select("id", {
            count: "exact",
            head: true
        });

    if (error) {
        throw error;
    }

    const total = Number(count || 0);

    if ($("countHome")) {
        $("countHome").textContent =
            `${total} / ${MAX}`;
    }

    if ($("countAdd")) {
        $("countAdd").textContent =
            `${total} / ${MAX}`;
    }

    return total;
}


function loadVoices() {
    if (!("speechSynthesis" in window)) {
        voices = [];
        return voices;
    }

    voices = speechSynthesis.getVoices();

    return voices;
}


if ("speechSynthesis" in window) {
    loadVoices();

    speechSynthesis.onvoiceschanged =
        loadVoices;
}


function indianVoice() {
    const availableVoices =
        loadVoices();

    return (
        availableVoices.find(
            voice =>
                (voice.lang || "")
                    .toLowerCase() === "en-in"
        ) ||

        availableVoices.find(
            voice =>
                /india|ravi|heera/i.test(
                    voice.name || ""
                ) &&
                (voice.lang || "")
                    .toLowerCase()
                    .startsWith("en")
        ) ||

        availableVoices.find(
            voice =>
                (voice.lang || "")
                    .toLowerCase()
                    .startsWith("en")
        ) ||

        availableVoices[0] ||
        null
    );
}


function waitForVoices() {
    return new Promise(resolve => {

        const available =
            loadVoices();

        if (available.length) {
            resolve();
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

            resolve();
        };

        if ("speechSynthesis" in window) {
            speechSynthesis.addEventListener(
                "voiceschanged",
                finish
            );
        }

        setTimeout(finish, 1000);
    });
}


async function announce(name) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    if (!name) {
        return;
    }

    await waitForVoices();

    speechSynthesis.cancel();
    speechSynthesis.resume();

    const voice =
        indianVoice();

    const utterance =
        new SpeechSynthesisUtterance(
            `HERE COMES ${name}`
        );

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

    isSpeaking = true;

    return new Promise(resolve => {

        utterance.onend = () => {
            isSpeaking = false;
            resolve();
        };

        utterance.onerror = () => {
            isSpeaking = false;
            resolve();
        };

        speechSynthesis.speak(
            utterance
        );
    });
}


function stopAudio() {

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    isSpeaking = false;

    if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
    }

    currentUrl = null;

    if ($("playPauseBtn")) {
        $("playPauseBtn").textContent =
            "▶";
    }
}


async function playOwnSong(song) {

    if (!song) {
        return;
    }

    try {

        stopAudio();

        currentSong = song;

        if ($("announcement")) {
            $("announcement").textContent =
                `HERE COMES ${song.name}`;
        }

        if ($("trackName")) {
            $("trackName").textContent =
                song.song_name;
        }

        if ($("progress")) {
            $("progress").value = 0;
        }

        if ($("currentTime")) {
            $("currentTime").textContent =
                "0:00";
        }

        if ($("duration")) {
            $("duration").textContent =
                "0:00";
        }

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

        if (!data || !data.signedUrl) {
            throw new Error(
                "Unable to create song URL."
            );
        }

        currentUrl =
            data.signedUrl;

        audio.src = currentUrl;
        audio.load();

        await announce(song.name);

        await audio.play();

        if ($("playPauseBtn")) {
            $("playPauseBtn").textContent =
                "❚❚";
        }

    } catch (error) {

        console.error(error);

        if ($("announcement")) {
            $("announcement").textContent =
                "PLAYBACK ERROR";
        }

        if ($("trackName")) {
            $("trackName").textContent =
                error.message ||
                "Unable to play your song";
        }
    }
}


async function loadOwnSong() {

    try {

        const session =
            await participantSession();

        const {
            data,
            error
        } = await supabaseClient
            .from("songs")
            .select(
                "id,name,song_name,file_path,created_at"
            )
            .eq(
                "owner_id",
                session.user.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        const button =
            $("mySongBtn");

        if (!button) {
            return;
        }

        if (data) {

            button.hidden = false;

            button.onclick = () => {
                showScreen("play");
                playOwnSong(data);
            };

        } else {

            button.hidden = true;
        }

        await countSongs();

    } catch (error) {
        console.error(error);
    }
}


async function addSong() {

    const name =
        $("nameInput").value.trim();

    const title =
        $("songInput").value.trim();

    const file =
        $("fileInput").files[0];

    if (!name || !title || !file) {

        status(
            "Please enter your name, song name and audio file.",
            true
        );

        return;
    }

    if (!file.type.startsWith("audio/")) {

        status(
            "Please select an audio file.",
            true
        );

        return;
    }

    if (
        file.size >
        25 * 1024 * 1024
    ) {

        status(
            "Maximum audio file size is 25 MB.",
            true
        );

        return;
    }

    const button =
        $("saveBtn");

    try {

        button.disabled = true;

        status("Uploading...");

        const total =
            await countSongs();

        if (total >= MAX) {

            throw new Error(
                "The 60-song limit has been reached."
            );
        }

        const session =
            await participantSession();

        const extension =
            (
                file.name
                    .split(".")
                    .pop() ||
                "audio"
            )
                .replace(
                    /[^a-z0-9]/gi,
                    ""
                )
                .toLowerCase() ||
            "audio";

        const path =
            `${session.user.id}/${crypto.randomUUID()}.${extension}`;

        const upload =
            await supabaseClient.storage
                .from(BUCKET)
                .upload(
                    path,
                    file,
                    {
                        contentType:
                            file.type,
                        upsert: false
                    }
                );

        if (upload.error) {
            throw upload.error;
        }

        const insert =
            await supabaseClient
                .from("songs")
                .insert({
                    owner_id:
                        session.user.id,
                    name: name,
                    song_name: title,
                    file_path: path
                })
                .select(
                    "id,name,song_name,file_path,created_at"
                )
                .single();

        if (insert.error) {

            await supabaseClient.storage
                .from(BUCKET)
                .remove([path]);

            throw insert.error;
        }

        localStorage.setItem(
            "mySongId",
            String(insert.data.id)
        );

        $("nameInput").value = "";
        $("songInput").value = "";
        $("fileInput").value = "";

        status(
            "Song added successfully."
        );

        await countSongs();
        await loadOwnSong();

    } catch (error) {

        console.error(error);

        status(
            error.message ||
            "Upload failed.",
            true
        );

    } finally {

        button.disabled = false;
    }
}


$("addBtn")?.addEventListener(
    "click",
    async () => {

        showScreen("add");

        await loadOwnSong();
    }
);


$("saveBtn")?.addEventListener(
    "click",
    addSong
);


$("playPauseBtn")?.addEventListener(
    "click",
    async () => {

        if (!audio.src ||
            !currentSong) {
            return;
        }

        if (isSpeaking) {
            return;
        }

        if (audio.paused) {

            try {

                await audio.play();

                $("playPauseBtn")
                    .textContent =
                    "❚❚";

            } catch (error) {

                console.error(error);
            }

        } else {

            audio.pause();

            $("playPauseBtn")
                .textContent =
                "▶";
        }
    }
);


$("progress")?.addEventListener(
    "input",
    event => {

        if (!audio.duration) {
            return;
        }

        audio.currentTime =
            (
                Number(
                    event.target.value
                ) / 100
            ) *
            audio.duration;
    }
);


audio.ontimeupdate = () => {

    if (!audio.duration) {
        return;
    }

    if ($("progress")) {
        $("progress").value =
            (
                audio.currentTime /
                audio.duration
            ) * 100;
    }

    if ($("currentTime")) {
        $("currentTime").textContent =
            formatTime(
                audio.currentTime
            );
    }

    if ($("duration")) {
        $("duration").textContent =
            formatTime(
                audio.duration
            );
    }
};


audio.onplay = () => {

    if ($("playPauseBtn")) {
        $("playPauseBtn").textContent =
            "❚❚";
    }
};


audio.onpause = () => {

    if ($("playPauseBtn") &&
        !isSpeaking) {

        $("playPauseBtn").textContent =
            "▶";
    }
};


audio.onended = () => {

    if ($("playPauseBtn")) {
        $("playPauseBtn").textContent =
            "▶";
    }
};


document
    .querySelectorAll("[data-back]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                stopAudio();
                showScreen("home");
            }
        );
    });


(async () => {

    try {

        await participantSession();
        await countSongs();
        await loadOwnSong();

    } catch (error) {

        console.error(error);

        status(
            error.message ||
            "Unable to connect to Supabase.",
            true
        );
    }

})();