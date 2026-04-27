const crypto = require("crypto");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "data.sqlite");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        id: this.lastID,
        changes: this.changes,
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES accounts(id),
      FOREIGN KEY(receiver_id) REFERENCES accounts(id)
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_direct_messages_pair
    ON direct_messages(sender_id, receiver_id, id)
  `);
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function publicAccount(account) {
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    displayName: account.display_name,
    username: account.username,
    bio: account.bio,
    createdAt: account.created_at,
  };
}

async function createAccount({ displayName, username, password, bio = "" }) {
  const cleanDisplayName = String(displayName || "").trim();
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = String(password || "");
  const cleanBio = String(bio || "").trim();

  if (!cleanDisplayName || !cleanUsername || !cleanPassword) {
    throw new Error("Name, username, and password are required.");
  }

  if (!/^[a-z0-9._]{3,20}$/.test(cleanUsername)) {
    throw new Error(
      "Username must be 3-20 characters and use letters, numbers, dots, or underscores.",
    );
  }

  if (cleanPassword.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  try {
    const result = await run(
      `
        INSERT INTO accounts (display_name, username, password_hash, bio)
        VALUES (?, ?, ?, ?)
      `,
      [cleanDisplayName, cleanUsername, hashPassword(cleanPassword), cleanBio],
    );

    const account = await getAccountById(result.id);
    return publicAccount(account);
  } catch (error) {
    if (error.message.includes("UNIQUE")) {
      throw new Error("That username is already taken.");
    }

    throw error;
  }
}

async function loginAccount({ username, password }) {
  const account = await get(
    `SELECT * FROM accounts WHERE username = ?`,
    [normalizeUsername(username)],
  );

  if (!account || account.password_hash !== hashPassword(password)) {
    throw new Error("Username or password is incorrect.");
  }

  return publicAccount(account);
}

function getAccountById(accountId) {
  return get(`SELECT * FROM accounts WHERE id = ?`, [accountId]);
}

async function searchAccounts(query, currentUserId) {
  const cleanQuery = `%${normalizeUsername(query)}%`;

  const rows = await all(
    `
      SELECT id, display_name, username, bio, created_at
      FROM accounts
      WHERE id != ? AND username LIKE ?
      ORDER BY username ASC
      LIMIT 12
    `,
    [currentUserId, cleanQuery],
  );

  return rows.map(publicAccount);
}

async function saveDirectMessage({ senderId, receiverUsername, content }) {
  const cleanContent = String(content || "").trim();

  if (!cleanContent) {
    throw new Error("Message cannot be empty.");
  }

  const sender = await getAccountById(senderId);
  const receiver = await get(
    `SELECT * FROM accounts WHERE username = ?`,
    [normalizeUsername(receiverUsername)],
  );

  if (!sender) {
    throw new Error("Sender account not found.");
  }

  if (!receiver) {
    throw new Error("No account found with that username.");
  }

  if (sender.id === receiver.id) {
    throw new Error("Choose another account to message.");
  }

  await run(
    `
      INSERT INTO direct_messages (sender_id, receiver_id, content)
      VALUES (?, ?, ?)
    `,
    [sender.id, receiver.id, cleanContent],
  );

  return getConversation(sender.id, receiver.username);
}

async function getConversation(currentUserId, otherUsername) {
  const other = await get(
    `SELECT id, display_name, username, bio, created_at FROM accounts WHERE username = ?`,
    [normalizeUsername(otherUsername)],
  );

  if (!other) {
    throw new Error("No account found with that username.");
  }

  const messages = await all(
    `
      SELECT
        direct_messages.id,
        direct_messages.sender_id,
        direct_messages.receiver_id,
        direct_messages.content,
        direct_messages.created_at,
        sender.username AS sender_username,
        receiver.username AS receiver_username
      FROM direct_messages
      JOIN accounts sender ON sender.id = direct_messages.sender_id
      JOIN accounts receiver ON receiver.id = direct_messages.receiver_id
      WHERE
        (sender_id = ? AND receiver_id = ?)
        OR
        (sender_id = ? AND receiver_id = ?)
      ORDER BY direct_messages.id ASC
    `,
    [currentUserId, other.id, other.id, currentUserId],
  );

  return {
    other: publicAccount(other),
    messages: messages.map((message) => ({
      id: message.id,
      fromMe: message.sender_id === Number(currentUserId),
      senderUsername: message.sender_username,
      receiverUsername: message.receiver_username,
      content: message.content,
      createdAt: message.created_at,
    })),
  };
}

async function getInbox(currentUserId) {
  const rows = await all(
    `
      SELECT
        account.id,
        account.display_name,
        account.username,
        account.bio,
        account.created_at,
        latest.content AS last_message,
        latest.created_at AS last_message_at
      FROM (
        SELECT
          CASE
            WHEN sender_id = ? THEN receiver_id
            ELSE sender_id
          END AS other_id,
          MAX(id) AS message_id
        FROM direct_messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY other_id
      ) inbox
      JOIN direct_messages latest ON latest.id = inbox.message_id
      JOIN accounts account ON account.id = inbox.other_id
      ORDER BY latest.id DESC
    `,
    [currentUserId, currentUserId, currentUserId],
  );

  return rows.map((row) => ({
    account: publicAccount(row),
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
  }));
}

module.exports = {
  initializeDatabase,
  createAccount,
  loginAccount,
  searchAccounts,
  saveDirectMessage,
  getConversation,
  getInbox,
  getAccountById,
};
