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

  await run(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, receiver_id),
      FOREIGN KEY(requester_id) REFERENCES accounts(id),
      FOREIGN KEY(receiver_id) REFERENCES accounts(id)
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_friend_requests_people
    ON friend_requests(requester_id, receiver_id, status)
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

async function updateAccount(accountId, { displayName, bio = "" }) {
  const cleanDisplayName = String(displayName || "").trim();
  const cleanBio = String(bio || "").trim();

  if (!cleanDisplayName) {
    throw new Error("Name is required.");
  }

  await run(
    `
      UPDATE accounts
      SET display_name = ?, bio = ?
      WHERE id = ?
    `,
    [cleanDisplayName, cleanBio, accountId],
  );

  const account = await getAccountById(accountId);
  return publicAccount(account);
}

async function getFriendshipStatus(currentUserId, otherUserId) {
  if (Number(currentUserId) === Number(otherUserId)) {
    return "self";
  }

  const request = await get(
    `
      SELECT requester_id, receiver_id, status
      FROM friend_requests
      WHERE
        (requester_id = ? AND receiver_id = ?)
        OR
        (requester_id = ? AND receiver_id = ?)
      ORDER BY id DESC
      LIMIT 1
    `,
    [currentUserId, otherUserId, otherUserId, currentUserId],
  );

  if (!request) {
    return "none";
  }

  if (request.status === "accepted") {
    return "friends";
  }

  return request.requester_id === Number(currentUserId)
    ? "outgoing_pending"
    : "incoming_pending";
}

async function requireFriends(currentUserId, otherUserId) {
  const status = await getFriendshipStatus(currentUserId, otherUserId);

  if (status !== "friends") {
    throw new Error("Friend request must be accepted before messaging.");
  }
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

  return Promise.all(
    rows.map(async (row) => ({
      ...publicAccount(row),
      friendshipStatus: await getFriendshipStatus(currentUserId, row.id),
    })),
  );
}

async function sendFriendRequest({ requesterId, receiverUsername }) {
  const requester = await getAccountById(requesterId);
  const receiver = await get(
    `SELECT * FROM accounts WHERE username = ?`,
    [normalizeUsername(receiverUsername)],
  );

  if (!requester) {
    throw new Error("Requester account not found.");
  }

  if (!receiver) {
    throw new Error("No account found with that username.");
  }

  if (requester.id === receiver.id) {
    throw new Error("Choose another account.");
  }

  const existing = await get(
    `
      SELECT * FROM friend_requests
      WHERE
        (requester_id = ? AND receiver_id = ?)
        OR
        (requester_id = ? AND receiver_id = ?)
      LIMIT 1
    `,
    [requester.id, receiver.id, receiver.id, requester.id],
  );

  if (existing?.status === "accepted") {
    throw new Error("You are already friends.");
  }

  if (existing?.status === "pending") {
    throw new Error("Friend request is already pending.");
  }

  await run(
    `
      INSERT INTO friend_requests (requester_id, receiver_id)
      VALUES (?, ?)
    `,
    [requester.id, receiver.id],
  );

  return {
    account: publicAccount(receiver),
    friendshipStatus: "outgoing_pending",
  };
}

async function acceptFriendRequest({ receiverId, requesterUsername }) {
  const receiver = await getAccountById(receiverId);
  const requester = await get(
    `SELECT * FROM accounts WHERE username = ?`,
    [normalizeUsername(requesterUsername)],
  );

  if (!receiver || !requester) {
    throw new Error("Friend request not found.");
  }

  const result = await run(
    `
      UPDATE friend_requests
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE requester_id = ? AND receiver_id = ? AND status = 'pending'
    `,
    [requester.id, receiver.id],
  );

  if (!result.changes) {
    throw new Error("Friend request not found.");
  }

  return {
    account: publicAccount(requester),
    friendshipStatus: "friends",
  };
}

async function getFriendRequests(currentUserId) {
  const rows = await all(
    `
      SELECT
        friend_requests.id,
        friend_requests.requester_id,
        friend_requests.receiver_id,
        friend_requests.status,
        friend_requests.created_at,
        requester.display_name AS requester_display_name,
        requester.username AS requester_username,
        requester.bio AS requester_bio,
        requester.created_at AS requester_created_at,
        receiver.display_name AS receiver_display_name,
        receiver.username AS receiver_username,
        receiver.bio AS receiver_bio,
        receiver.created_at AS receiver_created_at
      FROM friend_requests
      JOIN accounts requester ON requester.id = friend_requests.requester_id
      JOIN accounts receiver ON receiver.id = friend_requests.receiver_id
      WHERE
        (requester_id = ? OR receiver_id = ?)
        AND status = 'pending'
      ORDER BY friend_requests.id DESC
    `,
    [currentUserId, currentUserId],
  );

  const incoming = [];
  const outgoing = [];

  rows.forEach((row) => {
    const requester = publicAccount({
      id: row.requester_id,
      display_name: row.requester_display_name,
      username: row.requester_username,
      bio: row.requester_bio,
      created_at: row.requester_created_at,
    });
    const receiver = publicAccount({
      id: row.receiver_id,
      display_name: row.receiver_display_name,
      username: row.receiver_username,
      bio: row.receiver_bio,
      created_at: row.receiver_created_at,
    });

    if (row.receiver_id === Number(currentUserId)) {
      incoming.push({ account: requester, friendshipStatus: "incoming_pending" });
    } else {
      outgoing.push({ account: receiver, friendshipStatus: "outgoing_pending" });
    }
  });

  return { incoming, outgoing };
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

  await requireFriends(sender.id, receiver.id);

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

  await requireFriends(currentUserId, other.id);

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

async function getProfile(currentUserId) {
  const account = await getAccountById(currentUserId);

  if (!account) {
    throw new Error("Account not found.");
  }

  const stats = await get(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM friend_requests
          WHERE status = 'accepted'
            AND (requester_id = ? OR receiver_id = ?)
        ) AS friends,
        (
          SELECT COUNT(*)
          FROM (
            SELECT
              CASE
                WHEN sender_id = ? THEN receiver_id
                ELSE sender_id
              END AS other_id
            FROM direct_messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY other_id
          )
        ) AS chats,
        (
          SELECT COUNT(*)
          FROM direct_messages
          WHERE sender_id = ? OR receiver_id = ?
        ) AS messages
    `,
    [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
    ],
  );

  return {
    account: publicAccount(account),
    stats: {
      friends: stats.friends || 0,
      chats: stats.chats || 0,
      messages: stats.messages || 0,
    },
  };
}

module.exports = {
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
};
