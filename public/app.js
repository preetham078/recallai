const userForm = document.getElementById("user-form");
const chatForm = document.getElementById("chat-form");
const statusElement = document.getElementById("user-status");
const chatMeta = document.getElementById("chat-meta");
const messagesElement = document.getElementById("messages");
const apiStatus = document.getElementById("api-status");
const messageInput = document.getElementById("message");

let activeUser = null;

function renderMessages(messages) {
  messagesElement.innerHTML = "";

  if (!messages.length) {
    messagesElement.innerHTML =
      '<div class="empty-state">No messages yet. Start the conversation.</div>';
    return;
  }

  messages.forEach((entry) => {
    const message = document.createElement("article");
    message.className = `message ${entry.role}`;

    const role = document.createElement("h3");
    role.textContent = entry.role === "user" ? "You" : "AI";

    const content = document.createElement("p");
    content.textContent = entry.content;

    message.append(role, content);
    messagesElement.appendChild(message);
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function loadUser(name, email) {
  statusElement.textContent = "Loading user...";

  try {
    const payload = await fetchJson("/api/users", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });

    activeUser = payload.user;
    chatMeta.textContent = `Active user: ${activeUser.name} (${activeUser.email})`;
    statusElement.textContent = `User ready. Loaded ${payload.messages.length} saved messages.`;
    renderMessages(payload.messages);
  } catch (error) {
    statusElement.textContent = error.message;
  }
}

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(userForm);
  const name = formData.get("name");
  const email = formData.get("email");

  await loadUser(name, email);
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeUser) {
    statusElement.textContent = "Create or load a user first.";
    return;
  }

  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  messageInput.disabled = true;
  chatForm.querySelector("button").disabled = true;
  statusElement.textContent = "Sending message...";

  try {
    const payload = await fetchJson("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        userId: activeUser.id,
        message,
      }),
    });

    renderMessages(payload.messages);
    messageInput.value = "";
    statusElement.textContent = "Conversation saved.";
  } catch (error) {
    statusElement.textContent = error.message;
  } finally {
    messageInput.disabled = false;
    chatForm.querySelector("button").disabled = false;
    messageInput.focus();
  }
});

async function loadHealth() {
  try {
    const payload = await fetchJson("/api/health");
    apiStatus.textContent = payload.openaiConfigured
      ? "AI connected"
      : "AI key missing";
    apiStatus.classList.toggle("offline", !payload.openaiConfigured);
  } catch (_error) {
    apiStatus.textContent = "Server offline";
    apiStatus.classList.add("offline");
  }
}

renderMessages([]);
loadHealth();
