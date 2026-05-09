# Memory Chat AI

A simple AI chat app that:

- talks with the user through a browser UI
- stores users in SQLite
- stores every chat message in SQLite
- reloads history when the same user signs in again

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and add your API key:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## Best Setup For Multiple Phones

The best setup for this app is:

- GitHub Pages for the frontend UI
- One deployed Node server for the API
- Supabase Postgres for the shared database

That way every phone sees the same usernames, friend requests, and messages.

If you host only the `public/` files on a static site like GitHub Pages without a backend, the frontend falls back to each device's own `localStorage`.

To use a separately deployed backend from a static frontend, open the site with `?api=https://your-server-url`, for example:

```text
https://your-site.github.io/?api=https://your-server-url
```

If the frontend and backend are on different origins, the server accepts cross-origin API requests. You can restrict that with `ALLOWED_ORIGIN=https://your-site.github.io`.

To make the main GitHub Pages link use one backend by default, set this in [public/config.js](/Users/preethamm/recallai/public/config.js:1):

```text
window.PINGME_API_BASE = "https://your-server-url";
```

## Supabase Database

This app now supports two storage modes:

- Default local mode: SQLite in `data.sqlite`
- Shared production mode: Supabase Postgres through the same Express API

To use Supabase, add a Postgres connection string to `.env`:

```text
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

On startup, the server will automatically create the required tables in Supabase:

- `accounts`
- `friend_requests`
- `direct_messages`

You do not need to manually create those tables first.

## Data stored

- `users` table: name, email, created time
- `messages` table: user id, role, content, created time

## Notes

- If `OPENAI_API_KEY` is missing, the app still saves all user messages, but AI replies will use a fallback notice.
- The SQLite database is saved locally as `data.sqlite`.
