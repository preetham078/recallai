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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
}

async function createOrGetUser({ name, email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  const existingUser = await get(
    `SELECT id, name, email, created_at FROM users WHERE email = ?`,
    [normalizedEmail],
  );

  if (existingUser) {
    if (existingUser.name !== normalizedName) {
      await run(`UPDATE users SET name = ? WHERE id = ?`, [
        normalizedName,
        existingUser.id,
      ]);
    }

    return {
      ...existingUser,
      name: normalizedName,
    };
  }

  const result = await run(
    `INSERT INTO users (name, email) VALUES (?, ?)`,
    [normalizedName, normalizedEmail],
  );

  return get(`SELECT id, name, email, created_at FROM users WHERE id = ?`, [
    result.id,
  ]);
}

function saveMessage(userId, role, content) {
  return run(
    `INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)`,
    [userId, role, content.trim()],
  );
}

function getMessagesForUser(userId, limit = 50) {
  return all(
    `
      SELECT id, role, content, created_at
      FROM messages
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `,
    [userId, limit],
  ).then((rows) => rows.reverse());
}

module.exports = {
  initializeDatabase,
  createOrGetUser,
  saveMessage,
  getMessagesForUser,
  get,
};
