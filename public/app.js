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
const profileBio = document.getElementById("profile-bio");
const profileJoined = document.getElementById("profile-joined");
const profileFriends = document.getElementById("profile-friends");
const profileChats = document.getElementById("profile-chats");
const profileMessages = document.getElementById("profile-messages");
const editProfileButton = document.getElementById("edit-profile-button");
const shareProfileButton = document.getElementById("share-profile-button");
const profileForm = document.getElementById("profile-form");
const profileDisplayNameInput = document.getElementById(
  "profile-display-name-input",
);
const profileBioInput = document.getElementById("profile-bio-input");
const cancelProfileEditButton = document.getElementById(
  "cancel-profile-edit-button",
);
const mobileProfileUsername = document.getElementById("mobile-profile-username");
const logoutButton = document.getElementById("logout-button");
const backButton = document.getElementById("back-button");
const navHome = document.getElementById("nav-home");
const navSearch = document.getElementById("nav-search");
const navCreate = document.getElementById("nav-create");
const navMessages = document.getElementById("nav-messages");
const navProfile = document.getElementById("nav-profile");
const topSearchButton = document.getElementById("top-search-button");
const openProfileButton = document.getElementById("open-profile-button");
const closeProfileButton = document.getElementById("close-profile-button");
const floatingCompose = document.getElementById("floating-compose");
const peopleTabs = document.querySelectorAll("[data-people-tab]");
const searchInput = document.getElementById("search-input");
const peopleList = document.getElementById("people-list");
const requestsList = document.getElementById("requests-list");
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
let activePeopleTab = "chats";

const isStaticSite = window.location.hostname.endsWith("github.io");
const localDataKey = "pingmeStaticData";
const apiBaseKey = "pingmeApiBase";
const apiParam = new URLSearchParams(window.location.search).get("api");
const configuredApiBase =
  typeof window.PINGME_API_BASE === "string" ? window.PINGME_API_BASE : "";

function normalizeApiBase(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) {
    return "";
  }

  return cleanValue.replace(/\/+$/, "");
}

const remoteApiBase = (() => {
  const fromQuery = normalizeApiBase(apiParam);

  if (fromQuery) {
    localStorage.setItem(apiBaseKey, fromQuery);
    return fromQuery;
  }

  const fromConfig = normalizeApiBase(configuredApiBase);

  if (fromConfig) {
    localStorage.setItem(apiBaseKey, fromConfig);
    return fromConfig;
  }

  return normalizeApiBase(localStorage.getItem(apiBaseKey));
})();

function loadLocalData() {
  const fallback = {
    nextAccountId: 1,
    nextMessageId: 1,
    accounts: [],
    friendRequests: [],
    messages: [],
  };

  try {
    return {
      ...fallback,
      ...(JSON.parse(localStorage.getItem(localDataKey)) || {}),
    };
  } catch (_error) {
    return fallback;
  }
}

function saveLocalData(data) {
  localStorage.setItem(localDataKey, JSON.stringify(data));
}

function initials(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function formatJoinedDate(value) {
  const date = new Date(String(value || "").replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return "Joined recently";
  }

  return `Joined ${date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })}`;
}

function copyText(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "-1000px";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();

  if (!copied) {
    throw new Error("Copy failed.");
  }

  return Promise.resolve();
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
  if (isStaticSite && !remoteApiBase) {
    return handleLocalRequest(url, options);
  }

  const requestUrl = remoteApiBase
    ? `${remoteApiBase}${url.startsWith("/") ? url : `/${url}`}`
    : url;
  const response = await fetch(requestUrl, {
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

function getLocalBody(options) {
  return options.body ? JSON.parse(options.body) : {};
}

function publicLocalAccount(account) {
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    displayName: account.displayName,
    username: account.username,
    bio: account.bio,
    createdAt: account.createdAt,
  };
}

function normalizeLocalUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function getLocalAccount(data, accountId) {
  return data.accounts.find((account) => account.id === Number(accountId));
}

function getLocalConversation(data, accountId, username) {
  const current = getLocalAccount(data, accountId);
  const other = data.accounts.find(
    (account) => account.username === normalizeLocalUsername(username),
  );

  if (!current) {
    throw new Error("Sign in first.");
  }

  if (!other) {
    throw new Error("No account found with that username.");
  }

  requireLocalFriends(data, current.id, other.id);

  const messages = data.messages
    .filter(
      (message) =>
        (message.senderId === current.id && message.receiverId === other.id) ||
        (message.senderId === other.id && message.receiverId === current.id),
    )
    .map((message) => {
      const sender = getLocalAccount(data, message.senderId);
      const receiver = getLocalAccount(data, message.receiverId);

      return {
        id: message.id,
        fromMe: message.senderId === current.id,
        senderUsername: sender.username,
        receiverUsername: receiver.username,
        content: message.content,
        createdAt: message.createdAt,
      };
    });

  return {
    other: publicLocalAccount(other),
    messages,
  };
}

function getLocalFriendshipStatus(data, currentUserId, otherUserId) {
  if (Number(currentUserId) === Number(otherUserId)) {
    return "self";
  }

  const request = data.friendRequests.find(
    (entry) =>
      (entry.requesterId === Number(currentUserId) &&
        entry.receiverId === Number(otherUserId)) ||
      (entry.requesterId === Number(otherUserId) &&
        entry.receiverId === Number(currentUserId)),
  );

  if (!request) {
    return "none";
  }

  if (request.status === "accepted") {
    return "friends";
  }

  return request.requesterId === Number(currentUserId)
    ? "outgoing_pending"
    : "incoming_pending";
}

function requireLocalFriends(data, currentUserId, otherUserId) {
  if (getLocalFriendshipStatus(data, currentUserId, otherUserId) !== "friends") {
    throw new Error("Friend request must be accepted before messaging.");
  }
}

function getLocalInbox(data, accountId) {
  const current = getLocalAccount(data, accountId);

  if (!current) {
    throw new Error("Sign in first.");
  }

  const conversations = new Map();

  data.messages
    .filter(
      (message) =>
        message.senderId === current.id || message.receiverId === current.id,
    )
    .forEach((message) => {
      const otherId =
        message.senderId === current.id ? message.receiverId : message.senderId;
      const other = getLocalAccount(data, otherId);

      if (other) {
        conversations.set(other.id, {
          account: publicLocalAccount(other),
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
        });
      }
    });

  return [...conversations.values()].sort((left, right) =>
    right.lastMessageAt.localeCompare(left.lastMessageAt),
  );
}

function handleLocalRequest(url, options = {}) {
  const requestUrl = new URL(url, window.location.origin);
  const method = options.method || "GET";
  const data = loadLocalData();

  if (method === "POST" && requestUrl.pathname === "/api/accounts") {
    const body = getLocalBody(options);
    const displayName = String(body.displayName || "").trim();
    const username = normalizeLocalUsername(body.username);
    const password = String(body.password || "");
    const bio = String(body.bio || "").trim();

    if (!displayName || !username || !password) {
      throw new Error("Name, username, and password are required.");
    }

    if (!/^[a-z0-9._]{3,20}$/.test(username)) {
      throw new Error(
        "Username must be 3-20 characters and use letters, numbers, dots, or underscores.",
      );
    }

    if (password.length < 4) {
      throw new Error("Password must be at least 4 characters.");
    }

    if (data.accounts.some((account) => account.username === username)) {
      throw new Error("That username is already taken.");
    }

    const account = {
      id: data.nextAccountId,
      displayName,
      username,
      password,
      bio,
      createdAt: new Date().toISOString(),
    };

    data.nextAccountId += 1;
    data.accounts.push(account);
    saveLocalData(data);

    return { account: publicLocalAccount(account) };
  }

  if (method === "POST" && requestUrl.pathname === "/api/login") {
    const body = getLocalBody(options);
    const username = normalizeLocalUsername(body.username);
    const password = String(body.password || "");
    const account = data.accounts.find(
      (entry) => entry.username === username && entry.password === password,
    );

    if (!account) {
      throw new Error("Username or password is incorrect.");
    }

    return { account: publicLocalAccount(account) };
  }

  if (method === "GET" && requestUrl.pathname === "/api/profile") {
    const accountId = Number(requestUrl.searchParams.get("accountId"));
    const account = getLocalAccount(data, accountId);

    if (!account) {
      throw new Error("Account not found. Sign in again.");
    }

    const friendIds = new Set();
    data.friendRequests
      .filter(
        (entry) =>
          entry.status === "accepted" &&
          (entry.requesterId === accountId || entry.receiverId === accountId),
      )
      .forEach((entry) => {
        friendIds.add(
          entry.requesterId === accountId ? entry.receiverId : entry.requesterId,
        );
      });

    const chatIds = new Set();
    const messageCount = data.messages.filter((message) => {
      const isMine =
        message.senderId === accountId || message.receiverId === accountId;

      if (isMine) {
        chatIds.add(
          message.senderId === accountId ? message.receiverId : message.senderId,
        );
      }

      return isMine;
    }).length;

    return {
      account: publicLocalAccount(account),
      stats: {
        friends: friendIds.size,
        chats: chatIds.size,
        messages: messageCount,
      },
    };
  }

  if (method === "PATCH" && requestUrl.pathname === "/api/profile") {
    const body = getLocalBody(options);
    const account = getLocalAccount(data, body.accountId);
    const displayName = String(body.displayName || "").trim();
    const bio = String(body.bio || "").trim();

    if (!account) {
      throw new Error("Account not found. Sign in again.");
    }

    if (!displayName) {
      throw new Error("Name is required.");
    }

    account.displayName = displayName;
    account.bio = bio;
    saveLocalData(data);

    return handleLocalRequest(`/api/profile?accountId=${account.id}`);
  }

  if (method === "GET" && requestUrl.pathname === "/api/accounts/search") {
    const accountId = Number(requestUrl.searchParams.get("accountId"));
    const query = normalizeLocalUsername(requestUrl.searchParams.get("q"));

    return {
      accounts: data.accounts
        .filter(
          (account) =>
            account.id !== accountId && account.username.includes(query),
        )
        .sort((left, right) => left.username.localeCompare(right.username))
        .slice(0, 12)
        .map((account) => ({
          ...publicLocalAccount(account),
          friendshipStatus: getLocalFriendshipStatus(
            data,
            accountId,
            account.id,
          ),
        })),
    };
  }

  if (method === "GET" && requestUrl.pathname === "/api/friend-requests") {
    const accountId = Number(requestUrl.searchParams.get("accountId"));
    const incoming = [];
    const outgoing = [];

    data.friendRequests
      .filter(
        (entry) =>
          entry.status === "pending" &&
          (entry.requesterId === accountId || entry.receiverId === accountId),
      )
      .forEach((entry) => {
        if (entry.receiverId === accountId) {
          incoming.push({
            account: publicLocalAccount(getLocalAccount(data, entry.requesterId)),
            friendshipStatus: "incoming_pending",
          });
        } else {
          outgoing.push({
            account: publicLocalAccount(getLocalAccount(data, entry.receiverId)),
            friendshipStatus: "outgoing_pending",
          });
        }
      });

    return { incoming, outgoing };
  }

  if (method === "POST" && requestUrl.pathname === "/api/friend-requests") {
    const body = getLocalBody(options);
    const requester = getLocalAccount(data, body.accountId);
    const receiver = data.accounts.find(
      (account) =>
        account.username === normalizeLocalUsername(body.receiverUsername),
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

    const status = getLocalFriendshipStatus(data, requester.id, receiver.id);

    if (status === "friends") {
      throw new Error("You are already friends.");
    }

    if (status === "incoming_pending" || status === "outgoing_pending") {
      throw new Error("Friend request is already pending.");
    }

    data.friendRequests.push({
      requesterId: requester.id,
      receiverId: receiver.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    saveLocalData(data);

    return {
      account: publicLocalAccount(receiver),
      friendshipStatus: "outgoing_pending",
    };
  }

  if (
    method === "POST" &&
    requestUrl.pathname.startsWith("/api/friend-requests/") &&
    requestUrl.pathname.endsWith("/accept")
  ) {
    const body = getLocalBody(options);
    const username = decodeURIComponent(
      requestUrl.pathname
        .replace("/api/friend-requests/", "")
        .replace("/accept", ""),
    );
    const receiver = getLocalAccount(data, body.accountId);
    const requester = data.accounts.find(
      (account) => account.username === normalizeLocalUsername(username),
    );
    const request = data.friendRequests.find(
      (entry) =>
        entry.requesterId === requester?.id &&
        entry.receiverId === receiver?.id &&
        entry.status === "pending",
    );

    if (!request) {
      throw new Error("Friend request not found.");
    }

    request.status = "accepted";
    request.updatedAt = new Date().toISOString();
    saveLocalData(data);

    return {
      account: publicLocalAccount(requester),
      friendshipStatus: "friends",
    };
  }

  if (method === "GET" && requestUrl.pathname === "/api/inbox") {
    return {
      conversations: getLocalInbox(
        data,
        Number(requestUrl.searchParams.get("accountId")),
      ),
    };
  }

  if (method === "GET" && requestUrl.pathname.startsWith("/api/messages/")) {
    const username = decodeURIComponent(
      requestUrl.pathname.replace("/api/messages/", ""),
    );

    return getLocalConversation(
      data,
      Number(requestUrl.searchParams.get("accountId")),
      username,
    );
  }

  if (method === "POST" && requestUrl.pathname === "/api/messages") {
    const body = getLocalBody(options);
    const sender = getLocalAccount(data, body.accountId);
    const receiver = data.accounts.find(
      (account) =>
        account.username === normalizeLocalUsername(body.receiverUsername),
    );
    const content = String(body.content || "").trim();

    if (!sender) {
      throw new Error("Sender account not found.");
    }

    if (!receiver) {
      throw new Error("No account found with that username.");
    }

    if (sender.id === receiver.id) {
      throw new Error("Choose another account to message.");
    }

    requireLocalFriends(data, sender.id, receiver.id);

    if (!content) {
      throw new Error("Message cannot be empty.");
    }

    data.messages.push({
      id: data.nextMessageId,
      senderId: sender.id,
      receiverId: receiver.id,
      content,
      createdAt: new Date().toISOString(),
    });
    data.nextMessageId += 1;
    saveLocalData(data);

    return getLocalConversation(data, sender.id, receiver.username);
  }

  throw new Error("This action is not available on the static site.");
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

  if (!showProfile) {
    setPeopleTab(activePeopleTab);
  }
}

function setPeopleTab(tab) {
  activePeopleTab = tab;
  document.body.classList.toggle("people-tab-chats", tab === "chats");
  document.body.classList.toggle("people-tab-requests", tab === "requests");
  document.body.classList.toggle("people-tab-add", tab === "add");
  peopleTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.peopleTab === tab);
  });
  navHome.classList.remove("active");
  navMessages.classList.toggle("active", tab === "chats");
  navSearch.classList.toggle("active", tab === "add");
  navCreate.classList.toggle("active", tab === "add");

  if (tab === "add") {
    searchAccounts(searchInput.value);
  }

  if (tab === "requests") {
    loadFriendRequests();
  }

  if (tab === "chats") {
    loadInbox();
  }
}

function showSignedIn(account) {
  activeAccount = account;
  document.body.classList.add("signed-in");
  document.body.classList.remove("chat-open");
  setMobileSlide("messages");
  authPanel.classList.add("hidden");
  profilePanel.classList.remove("hidden");
  profilePanel.setAttribute("aria-hidden", "false");
  peoplePanel.classList.remove("hidden");
  renderProfile({ account });
  loadProfile();
  loadFriendRequests();
  loadInbox();
  searchAccounts("");
}

function showSignedOut() {
  activeAccount = null;
  activeChat = null;
  document.body.classList.remove("signed-in", "chat-open");
  setMobileSlide("messages");
  setPeopleTab("chats");
  clearInterval(pollTimer);
  authPanel.classList.remove("hidden");
  profilePanel.classList.add("hidden");
  profilePanel.setAttribute("aria-hidden", "true");
  peoplePanel.classList.add("hidden");
  profileForm.classList.add("hidden");
  requestsList.innerHTML = "";
  renderMessages([]);
  setChatHeader(null);
  clearSession();
}

function accountParams() {
  return new URLSearchParams({ accountId: activeAccount.id });
}

function renderProfile({ account, stats = {} }) {
  activeAccount = account;
  saveSession(account);
  profileAvatar.textContent = initials(account.displayName);
  profileName.textContent = account.displayName;
  profileUsername.textContent = `@${account.username}`;
  profileBio.textContent = account.bio || "No bio yet.";
  profileJoined.textContent = formatJoinedDate(account.createdAt);
  profileFriends.textContent = stats.friends || 0;
  profileChats.textContent = stats.chats || 0;
  profileMessages.textContent = stats.messages || 0;
  mobileProfileUsername.textContent = `@${account.username}`;
  profileDisplayNameInput.value = account.displayName;
  profileBioInput.value = account.bio || "";
}

async function loadProfile() {
  if (!activeAccount) {
    return;
  }

  try {
    const payload = await fetchJson(`/api/profile?${accountParams()}`);
    renderProfile(payload);
  } catch (error) {
    setStatus(error.message);
  }
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
    const friendshipStatus = entry.friendshipStatus || account.friendshipStatus;
    const button = document.createElement("div");
    button.className = "person-button";

    const avatar = document.createElement("span");
    avatar.className = "avatar small";
    avatar.textContent = initials(account.displayName);

    const content = document.createElement("span");
    content.className = "person-copy";

    const name = document.createElement("strong");
    name.textContent = account.displayName;

    const detail = document.createElement("span");
    detail.textContent = entry.detail || entry.lastMessage || `@${account.username}`;

    content.append(name, detail);
    button.append(avatar, content);

    if (entry.lastMessage || friendshipStatus === "friends") {
      button.addEventListener("click", () => openConversation(account.username));
      button.tabIndex = 0;
      button.setAttribute("role", "button");
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openConversation(account.username);
        }
      });
      const action = document.createElement("span");
      action.className = "person-status";
      action.textContent = "Message";
      button.appendChild(action);
    } else if (friendshipStatus === "incoming_pending") {
      const action = document.createElement("button");
      action.className = "person-action";
      action.type = "button";
      action.textContent = "Accept";
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        acceptFriendRequest(account.username);
      });
      button.appendChild(action);
    } else if (friendshipStatus === "outgoing_pending") {
      const action = document.createElement("span");
      action.className = "person-status";
      action.textContent = "Pending";
      button.appendChild(action);
    } else {
      const action = document.createElement("button");
      action.className = "person-action";
      action.type = "button";
      action.textContent = "Add friend";
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        sendFriendRequest(account.username);
      });
      button.appendChild(action);
    }

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

async function sendFriendRequest(username) {
  try {
    await fetchJson("/api/friend-requests", {
      method: "POST",
      body: JSON.stringify({
        accountId: activeAccount.id,
        receiverUsername: username,
      }),
    });
    setStatus("Friend request sent.");
    loadFriendRequests();
    loadProfile();
    searchAccounts(searchInput.value);
  } catch (error) {
    setStatus(error.message);
  }
}

async function acceptFriendRequest(username) {
  try {
    await fetchJson(`/api/friend-requests/${encodeURIComponent(username)}/accept`, {
      method: "POST",
      body: JSON.stringify({
        accountId: activeAccount.id,
      }),
    });
    setStatus("Friend request accepted. You can message now.");
    loadFriendRequests();
    loadInbox();
    loadProfile();
    searchAccounts(searchInput.value);
  } catch (error) {
    setStatus(error.message);
  }
}

async function loadFriendRequests() {
  if (!activeAccount) {
    return;
  }

  try {
    const payload = await fetchJson(`/api/friend-requests?${accountParams()}`);
    const requests = [
      ...payload.incoming,
      ...payload.outgoing.map((entry) => ({
        ...entry,
        detail: `Pending with @${entry.account.username}`,
      })),
    ];
    renderAccountList(requestsList, requests, "No friend requests.");
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
    loadProfile();
  } catch (error) {
    setStatus(error.message);
  }
}

function openProfileEditor() {
  if (!activeAccount) {
    return;
  }

  profileDisplayNameInput.value = activeAccount.displayName;
  profileBioInput.value = activeAccount.bio || "";
  profileForm.classList.remove("hidden");
  profileDisplayNameInput.focus();
}

async function shareProfile() {
  if (!activeAccount) {
    return;
  }

  const profileUrl = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(
    activeAccount.username,
  )}`;
  const text = `Ping me on WhatsChat: @${activeAccount.username}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${activeAccount.displayName} on WhatsChat`,
        text,
        url: profileUrl,
      });
      setStatus("Profile shared.");
      return;
    }

    await copyText(`${text} ${profileUrl}`);
    setStatus("Profile link copied.");
  } catch (error) {
    if (error.name !== "AbortError") {
      setStatus("Unable to share profile.");
    }
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
    loadFriendRequests();
    searchAccounts(searchInput.value);
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
    loadFriendRequests();
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
editProfileButton.addEventListener("click", openProfileEditor);
shareProfileButton.addEventListener("click", shareProfile);
cancelProfileEditButton.addEventListener("click", () => {
  profileForm.classList.add("hidden");
});
peopleTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setMobileSlide("messages");
    setPeopleTab(button.dataset.peopleTab);
  });
});
navHome.addEventListener("click", () => {
  setMobileSlide("messages");
  setPeopleTab("chats");
});
navSearch.addEventListener("click", () => {
  setMobileSlide("messages");
  setPeopleTab("add");
  searchInput.focus();
});
navCreate.addEventListener("click", () => {
  setMobileSlide("messages");
  setPeopleTab("add");
  searchInput.focus();
});
navMessages.addEventListener("click", () => {
  setMobileSlide("messages");
  setPeopleTab("chats");
});
navProfile.addEventListener("click", () => setMobileSlide("profile"));
topSearchButton.addEventListener("click", () => {
  setMobileSlide("messages");
  setPeopleTab("add");
  searchInput.focus();
});
openProfileButton.addEventListener("click", () => setMobileSlide("profile"));
closeProfileButton.addEventListener("click", () => setMobileSlide("messages"));
floatingCompose.addEventListener("click", () => {
  setMobileSlide("messages");
  setPeopleTab("add");
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

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(profileForm);
  const body = Object.fromEntries(formData.entries());
  profileForm
    .querySelectorAll("button, input, textarea")
    .forEach((element) => {
      element.disabled = true;
    });

  try {
    const payload = await fetchJson("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({
        accountId: activeAccount.id,
        ...body,
      }),
    });
    renderProfile(payload);
    profileForm.classList.add("hidden");
    setStatus("Profile updated.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    profileForm
      .querySelectorAll("button, input, textarea")
      .forEach((element) => {
        element.disabled = false;
      });
  }
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
    loadProfile();
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

if (isStaticSite && !remoteApiBase) {
  setStatus(
    "This build is using phone-only storage. Add ?api=https://your-server-url to share accounts and messages across devices.",
  );
}
