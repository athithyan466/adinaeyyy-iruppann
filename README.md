# Adineyy iruppen — Final

## Playback permissions

### Participant
A participant can upload a song and play only the song belonging to their own anonymous Supabase account.

### Admin
The admin uses `/admin` and can:
- see every submission
- play any individual song
- use the Admin Music Player to play the entire collection
- shuffle all songs
- previous / next
- repeat
- delete submissions

## Important Supabase setup

1. Authentication -> Sign In / Providers -> enable Anonymous Sign-Ins.
2. Create the `songs` storage bucket.
3. Create the `songs` table with an `owner_id` column.
4. Create your admin Auth user:
   Email: `admin@adineyyiruppen.local`
   Password: `Admin@12345`
5. Copy the admin user's UUID.
6. Open `supabase/permissions.sql`.
7. Replace every `YOUR_ADMIN_USER_UUID` with the real admin UUID.
8. Run that SQL in Supabase SQL Editor.
9. Put your Supabase URL and publishable/anon key in `config.js`.

## Local testing

Public:
http://127.0.0.1:5500/index.html

Admin:
http://127.0.0.1:5500/admin.html

For Netlify, use:
https://YOUR-SITE.netlify.app/admin

The username shown on the admin page is:
admin

The password shown on the admin page is:
Admin@12345

Supabase still uses the internal admin email to create the authenticated admin session.
