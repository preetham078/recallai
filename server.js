require("dotenv").config();

const path = require("path");
const express = require("express");
const {
  initializeDatabase,
  createAccount,
  loginAccount,
  updateAccount,
  searchAccounts,
  saveDirectMessage,
  getConversation,
  getInbox,
  getProfile,
  getAccountById,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
} = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";
let server;
const storageProvider =
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL
    ? "Supabase/Postgres"
    : "SQLite";

app.use((request, response, next) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,OPTIONS",
  );

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function parseAccountId(request) {
  const accountId = Number(request.query.accountId || request.body.accountId);
  return Number.isInteger(accountId) && accountId > 0 ? accountId : null;
}

async function requireAccount(request, response) {
  const accountId = parseAccountId(request);

  if (!accountId) {
    response.status(401).json({ error: "Sign in first." });
    return null;
  }

  const account = await getAccountById(accountId);

  if (!account) {
    response.status(401).json({ error: "Account not found. Sign in again." });
    return null;
  }

  return account;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/accounts", async (request, response) => {
  try {
    const account = await createAccount(request.body || {});
    response.status(201).json({ account });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/login", async (request, response) => {
  try {
    const account = await loginAccount(request.body || {});
    response.json({ account });
  } catch (error) {
    response.status(401).json({ error: error.message });
  }
});

app.get("/api/profile", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    response.json(await getProfile(account.id));
  } catch (error) {
    response.status(500).json({ error: "Unable to load profile." });
  }
});

app.patch("/api/profile", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    const updatedAccount = await updateAccount(account.id, request.body || {});
    response.json(await getProfile(updatedAccount.id));
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/accounts/search", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    const results = await searchAccounts(request.query.q || "", account.id);
    response.json({ accounts: results });
  } catch (error) {
    response.status(500).json({ error: "Unable to search accounts." });
  }
});

app.get("/api/inbox", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    response.json({ conversations: await getInbox(account.id) });
  } catch (error) {
    response.status(500).json({ error: "Unable to load inbox." });
  }
});

app.get("/api/friend-requests", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    response.json(await getFriendRequests(account.id));
  } catch (error) {
    response.status(500).json({ error: "Unable to load friend requests." });
  }
});

app.post("/api/friend-requests", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    const requestResult = await sendFriendRequest({
      requesterId: account.id,
      receiverUsername: request.body.receiverUsername,
    });

    response.status(201).json(requestResult);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/friend-requests/:username/accept", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    response.json(
      await acceptFriendRequest({
        receiverId: account.id,
        requesterUsername: request.params.username,
      }),
    );
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/messages/:username", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    response.json(await getConversation(account.id, request.params.username));
  } catch (error) {
    response.status(404).json({ error: error.message });
  }
});

app.post("/api/messages", async (request, response) => {
  try {
    const account = await requireAccount(request, response);

    if (!account) {
      return;
    }

    const conversation = await saveDirectMessage({
      senderId: account.id,
      receiverUsername: request.body.receiverUsername,
      content: request.body.content,
    });

    response.status(201).json(conversation);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

initializeDatabase()
  .then(() => {
    server = app.listen(port, host, () => {
      console.log(
        `Server running on http://${host}:${port} using ${storageProvider}`,
      );
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
