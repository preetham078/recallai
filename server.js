const path = require("path");
const express = require("express");
const {
  initializeDatabase,
  createAccount,
  loginAccount,
  searchAccounts,
  saveDirectMessage,
  getConversation,
  getInbox,
  getAccountById,
} = require("./db");

const app = express();
const port = process.env.PORT || 3000;

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
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
