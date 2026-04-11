require("dotenv").config();

const path = require("path");
const express = require("express");
const OpenAI = require("openai");
const {
  initializeDatabase,
  createOrGetUser,
  saveMessage,
  getMessagesForUser,
  get,
} = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

const openai = hasOpenAIKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    openaiConfigured: hasOpenAIKey,
  });
});

app.post("/api/users", async (request, response) => {
  const { name, email } = request.body || {};

  if (!name || !email) {
    response.status(400).json({
      error: "Name and email are required.",
    });
    return;
  }

  try {
    const user = await createOrGetUser({ name, email });
    const messages = await getMessagesForUser(user.id);

    response.json({ user, messages });
  } catch (error) {
    response.status(500).json({
      error: "Unable to create or load the user.",
      details: error.message,
    });
  }
});

app.get("/api/users/:userId/messages", async (request, response) => {
  try {
    const user = await get(`SELECT id FROM users WHERE id = ?`, [
      request.params.userId,
    ]);

    if (!user) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    const messages = await getMessagesForUser(request.params.userId);
    response.json({ messages });
  } catch (error) {
    response.status(500).json({
      error: "Unable to load messages.",
      details: error.message,
    });
  }
});

app.post("/api/chat", async (request, response) => {
  const { userId, message } = request.body || {};

  if (!userId || !message) {
    response.status(400).json({
      error: "userId and message are required.",
    });
    return;
  }

  try {
    const user = await get(`SELECT id, name, email FROM users WHERE id = ?`, [
      userId,
    ]);

    if (!user) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    await saveMessage(user.id, "user", message);

    const history = await getMessagesForUser(user.id, 12);

    let assistantReply;

    if (!openai) {
      assistantReply =
        "OPENAI_API_KEY is not configured yet. I saved your message to the database, but I need an API key before I can respond intelligently.";
    } else {
      const completion = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a helpful AI assistant inside a user-profile app. Answer clearly, be concise, and personalize lightly when useful.",
              },
            ],
          },
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: `The current user is ${user.name} and their email is ${user.email}.`,
              },
            ],
          },
          ...history.map((entry) => ({
            role: entry.role,
            content: [
              {
                type: "input_text",
                text: entry.content,
              },
            ],
          })),
        ],
      });

      assistantReply = completion.output_text || "I could not generate a reply.";
    }

    await saveMessage(user.id, "assistant", assistantReply);

    response.json({
      reply: assistantReply,
      messages: await getMessagesForUser(user.id),
    });
  } catch (error) {
    response.status(500).json({
      error: "Unable to process the chat request.",
      details: error.message,
    });
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
