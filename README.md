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

## Data stored

- `users` table: name, email, created time
- `messages` table: user id, role, content, created time

## Notes

- If `OPENAI_API_KEY` is missing, the app still saves all user messages, but AI replies will use a fallback notice.
- The SQLite database is saved locally as `data.sqlite`.
