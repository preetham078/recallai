const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const showSignup = document.getElementById("show-signup");
const showLogin = document.getElementById("show-login");
const authPanel = document.getElementById("auth-panel");
const profilePanel = document.getElementById("profile-panel");
const peoplePanel = document.getElementById("people-panel");
const profileAvatar = document.getElementById("profile-avatar");
const profileName = document.getElementById("profile-name");
const profileUsername = document.getElementById("profile-username");
const mobileProfileUsername = document.getElementById("mobile-profile-username");
const logoutButton = document.getElementById("logout-button");
const backButton = document.getElementById("back-button");
const navHome = document.getElementById("nav-home");
const navSearch = document.getElementById("nav-search");
const navCreate = document.getElementById("nav-create");
const navMessages = document.getElementById("nav-messages");
const navProfile = document.getElementById("nav-profile");
const openProfileButton = document.getElementById("open-profile-button");
const closeProfileButton = document.getElementById("close-profile-button");
const floatingCompose = document.getElementById("floating-compose");
const searchInput = document.getElementById("search-input");
const peopleList = document.getElementById("people-list");
const inboxList = document.getElementById("inbox-list");
const chatAvatar = document.getElementById("chat-avatar");
const chatTitle = document.getElementById("chat-title");
const chatSubtitle = document.getElementById("chat-subtitle");
const messagesElement = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const statusElement = document.getElementById("status");

let activeAccount = null;
let activeChat = null;
let pollTimer = null;

function initials(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function setStatus(message) {
  statusElement.textContent = message || "";
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  signupForm.classList.toggle("hidden", !isSignup);
  loginForm.classList.toggle("hidden", isSignup);
  showSignup.classList.toggle("active", isSignup);
  showLogin.classList.toggle("active", !isSignup);
  setStatus("");
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

function saveSession(account) {
  localStorage.setItem("pingmeAccount", JSON.stringify(account));
}

function clearSession() {
  localStorage.removeItem("pingmeAccount");
}

function setMobileSlide(slide) {
  const showProfile = slide === "profile";
  document.body.classList.toggle("profile-slide", showProfile);
  document.body.classList.toggle("messages-slide", !showProfile);
  navProfile.classList.toggle("active", showProfile);
  navMessages.classList.toggle("active", !showProfile);
}

function showSignedIn(account) {
  activeAccount = account;
  document.body.classList.add("signed-in");
  document.body.classList.remove("chat-open");
  setMobileSlide("messages");
  authPanel.classList.add("hidden");
  profilePanel.classList.remove("hidden");
  peoplePanel.classList.remove("hidden");
  profileAvatar.textContent = initials(account.displayName);
  profileName.textContent = account.displayName;
  profileUsername.textContent = `@${account.username}`;
  mobileProfileUsername.textContent = account.username;
  loadInbox();
  searchAccounts("");
}

function showSignedOut() {
  activeAccount = null;
  activeChat = null;
  document.body.classList.remove("signed-in", "chat-open");
  setMobileSlide("messages");
  clearInterval(pollTimer);
  authPanel.classList.remove("hidden");
  profilePanel.classList.add("hidden");
  peoplePanel.classList.add("hidden");
  renderMessages([]);
  setChatHeader(null);
  clearSession();
}

function accountParams() {
  return new URLSearchParams({ accountId: activeAccount.id });
}

async function handleAuth(endpoint, form) {
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());
  setStatus("Working...");

  try {
    const payload = await fetchJson(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    saveSession(payload.account);
    showSignedIn(payload.account);
    form.reset();
    setStatus("Account ready.");
  } catch (error) {
    setStatus(error.message);
  }
}

function renderAccountList(container, accounts, emptyText) {
  container.innerHTML = "";

  if (!accounts.length) {
    const empty = document.createElement("div");
    empty.className = "list-empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  accounts.forEach((entry) => {
    const account = entry.account || entry;
    const button = document.createElement("button");
    button.className = "person-button";
    button.type = "button";
    button.addEventListener("click", () => openConversation(account.username));

    const avatar = document.createElement("span");
    avatar.className = "avatar small";
    avatar.textContent = initials(account.displayName);

    const content = document.createElement("span");
    content.className = "person-copy";

    const name = document.createElement("strong");
    name.textContent = account.displayName;

    const detail = document.createElement("span");
    detail.textContent = entry.lastMessage || `@${account.username}`;

    content.append(name, detail);
    button.append(avatar, content);
    container.appendChild(button);
  });
}

async function searchAccounts(query) {
  if (!activeAccount) {
    return;
  }

  try {
    const payload = await fetchJson(
      `/api/accounts/search?${accountParams()}&q=${encodeURIComponent(query)}`,
    );
    renderAccountList(peopleList, payload.accounts, "No matching usernames yet.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function loadInbox() {
  if (!activeAccount) {
    return;
  }

  try {
    const payload = await fetchJson(`/api/inbox?${accountParams()}`);
    renderAccountList(inboxList, payload.conversations, "No chats yet.");
  } catch (error) {
    setStatus(error.message);
  }
}

function setChatHeader(account) {
  if (!account) {
    document.body.classList.remove("chat-open");
    chatAvatar.textContent = "?";
    chatAvatar.classList.add("muted");
    chatTitle.textContent = "Choose someone to message";
    chatSubtitle.textContent =
      "Create an account, search a username, then start texting.";
    messageInput.disabled = true;
    sendButton.disabled = true;
    return;
  }

  chatAvatar.textContent = initials(account.displayName);
  document.body.classList.add("chat-open");
  chatAvatar.classList.remove("muted");
  chatTitle.textContent = account.displayName;
  chatSubtitle.textContent = `@${account.username}`;
  messageInput.disabled = false;
  sendButton.disabled = false;
  messageInput.focus();
}

function renderMessages(messages) {
  messagesElement.innerHTML = "";

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = activeChat
      ? "No messages yet. Say hi."
      : "Your messages will appear here.";
    messagesElement.appendChild(empty);
    return;
  }

  messages.forEach((entry) => {
    const bubble = document.createElement("article");
    bubble.className = `bubble ${entry.fromMe ? "mine" : "theirs"}`;

    const text = document.createElement("p");
    text.textContent = entry.content;

    const meta = document.createElement("span");
    meta.textContent = entry.fromMe ? "You" : `@${entry.senderUsername}`;

    bubble.append(text, meta);
    messagesElement.appendChild(bubble);
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

async function openConversation(username) {
  if (!activeAccount) {
    setStatus("Create or log in to an account first.");
    return;
  }

  try {
    const payload = await fetchJson(
      `/api/messages/${encodeURIComponent(username)}?${accountParams()}`,
    );
    activeChat = payload.other;
    setChatHeader(payload.other);
    renderMessages(payload.messages);
    setStatus("");

    clearInterval(pollTimer);
    pollTimer = setInterval(() => refreshConversation(), 2500);
  } catch (error) {
    setStatus(error.message);
  }
}

async function refreshConversation() {
  if (!activeChat || !activeAccount) {
    return;
  }

  try {
    const payload = await fetchJson(
      `/api/messages/${encodeURIComponent(activeChat.username)}?${accountParams()}`,
    );
    renderMessages(payload.messages);
    loadInbox();
  } catch (_error) {
    clearInterval(pollTimer);
  }
}

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleAuth("/api/accounts", signupForm);
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleAuth("/api/login", loginForm);
});

showSignup.addEventListener("click", () => setAuthMode("signup"));
showLogin.addEventListener("click", () => setAuthMode("login"));
logoutButton.addEventListener("click", showSignedOut);
navHome.addEventListener("click", () => setMobileSlide("messages"));
navSearch.addEventListener("click", () => {
  setMobileSlide("messages");
  searchInput.focus();
});
navCreate.addEventListener("click", () => setMobileSlide("messages"));
navMessages.addEventListener("click", () => setMobileSlide("messages"));
navProfile.addEventListener("click", () => setMobileSlide("profile"));
openProfileButton.addEventListener("click", () => setMobileSlide("profile"));
closeProfileButton.addEventListener("click", () => setMobileSlide("messages"));
floatingCompose.addEventListener("click", () => {
  setMobileSlide("messages");
  searchInput.focus();
});
backButton.addEventListener("click", () => {
  activeChat = null;
  clearInterval(pollTimer);
  renderMessages([]);
  setChatHeader(null);
  loadInbox();
});

searchInput.addEventListener("input", () => {
  searchAccounts(searchInput.value);
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeChat) {
    setStatus("Choose a person to message.");
    return;
  }

  const content = messageInput.value.trim();

  if (!content) {
    return;
  }

  messageInput.disabled = true;
  sendButton.disabled = true;

  try {
    const payload = await fetchJson("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        accountId: activeAccount.id,
        receiverUsername: activeChat.username,
        content,
      }),
    });
    messageInput.value = "";
    renderMessages(payload.messages);
    loadInbox();
    setStatus("");
  } catch (error) {
    setStatus(error.message);
  } finally {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
});

const savedAccount = localStorage.getItem("pingmeAccount");

if (savedAccount) {
  try {
    showSignedIn(JSON.parse(savedAccount));
  } catch (_error) {
    showSignedOut();
  }
} else {
  showSignedOut();
}
