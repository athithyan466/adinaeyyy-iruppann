# Adineyy iruppen

A lightweight local music website.

## Run
Open `index.html` in a modern browser.

## Add songs
Click `ADD A SONG`, enter the person's name and favorite song name, then choose the audio file.

The browser stores the songs locally using IndexedDB. Maximum: 60 songs.

## Play
Click `PLAY SONGS`. Songs are shuffled. Before each song, the browser says:

HERE COMES <NAME>

Then the song starts.

## Important
Because this is a local/static website, the saved songs live in that browser on that device. If you clear the browser's site data, the locally stored songs can be removed.

For publishing a fixed collection, keep your audio files and this website together, or a later version can be made with a server/database for shared uploads.
