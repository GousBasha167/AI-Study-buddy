// Shared API helper for Learn Mate AI (AI Study Buddy) frontend
// Talks to the existing Express backend (default: http://localhost:5000)

const API_BASE_URL = "http://localhost:5000/api";

const Storage = {
  getAccessToken: () => localStorage.getItem("accessToken"),
  getRefreshToken: () => localStorage.getItem("refreshToken"),
  getUser: () => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },
  setSession: ({ accessToken, refreshToken, user }) => {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  },
};

// Core request function. `options.body` may be a plain object (JSON) or a FormData instance.
async function apiRequest(path, options = {}) {
  const { method = "GET", body, isForm = false, skipAuth = false, _retry = false } = options;

  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  const token = Storage.getAccessToken();
  if (!skipAuth && token) headers["Authorization"] = `Bearer ${token}`;

  const fetchOptions = { method, headers };
  if (body !== undefined) {
    fetchOptions.body = isForm ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);
  } catch (err) {
    throw new Error("Cannot reach the server. Is the backend running on port 5000?");
  }

  // Access token expired -> try refresh once, then retry the original request
  if (res.status === 401 && !skipAuth && !_retry && Storage.getRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiRequest(path, { ...options, _retry: true });
    }
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuth) {
      Storage.clear();
      if (!location.pathname.endsWith("index.html") && location.pathname !== "/") {
        window.location.href = "index.html";
      }
    }
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

async function tryRefreshToken() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "x-refresh-token": Storage.getRefreshToken() },
    });
    if (!res.ok) return false;
    const data = await res.json();
    Storage.setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

const Api = {
  // Auth
  register: (payload) => apiRequest("/auth/register", { method: "POST", body: payload, skipAuth: true }),
  login: (payload) => apiRequest("/auth/login", { method: "POST", body: payload, skipAuth: true }),
  logout: () => apiRequest("/auth/logout", { method: "POST", skipAuth: true }),

  // Materials
  getMaterials: () => apiRequest("/materials"),
  getMaterial: (id) => apiRequest(`/materials/${id}`),
  uploadMaterial: (formData) => apiRequest("/materials/upload", { method: "POST", body: formData, isForm: true }),
  deleteMaterial: (id) => apiRequest(`/materials/${id}`, { method: "DELETE" }),
  summarize: (id) => apiRequest(`/materials/${id}/summarize`, { method: "POST", body: {} }),
  generateFlashcards: (id, count) => apiRequest(`/materials/${id}/flashcards`, { method: "POST", body: { count } }),
  generateQuiz: (id, count) => apiRequest(`/materials/${id}/quiz`, { method: "POST", body: { count } }),
  generateStudyPlan: (id, payload) => apiRequest(`/materials/${id}/study-plan`, { method: "POST", body: payload }),

  // Admin
  getUsers: () => apiRequest("/admin/users"),
  deleteUser: (id) => apiRequest(`/admin/users/${id}`, { method: "DELETE" }),
  getStats: () => apiRequest("/admin/stats"),
};

// Redirects to login if not authenticated. Call at the top of protected pages.
function requireAuth() {
  if (!Storage.getAccessToken()) {
    window.location.href = "index.html";
    return null;
  }
  return Storage.getUser();
}

// Populates the shared app shell (sidebar + topbar) with user info + role-based links.
function initNavbar(activePage, pageTitle) {
  const user = Storage.getUser();
  mountAppShell(activePage, pageTitle || "Dashboard");
  initThemeToggle();

  const navUser = document.getElementById("nav-user");
  const navRole = document.getElementById("nav-role");
  const navAvatar = document.getElementById("nav-avatar");
  const adminLink = document.getElementById("nav-admin-link");
  const logoutBtn = document.getElementById("nav-logout");

  if (navUser && user) navUser.textContent = user.name || "Signed in";
  if (navRole && user) navRole.textContent = user.role || "";
  if (navAvatar && user) navAvatar.textContent = (user.name || "?").trim().charAt(0) || "?";

  if (adminLink) {
    if (user && user.role === "admin") {
      adminLink.classList.remove("hidden");
    } else {
      adminLink.classList.add("hidden");
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await Api.logout();
      } catch (err) {
        // ignore network errors on logout
      }
      Storage.clear();
      window.location.href = "index.html";
    });
  }

  document.querySelectorAll(".side-nav a[data-page]").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === activePage);
  });

  // Mobile drawer
  const menuBtn = document.getElementById("menu-toggle");
  const closeBtn = document.getElementById("drawer-close");
  const scrim = document.getElementById("sidebar-scrim");
  const setDrawer = (open) => {
    document.body.classList.toggle("drawer-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
  };
  if (menuBtn) {
    menuBtn.addEventListener("click", () => setDrawer(!document.body.classList.contains("drawer-open")));
    if (closeBtn) closeBtn.addEventListener("click", () => setDrawer(false));
    if (scrim) scrim.addEventListener("click", () => setDrawer(false));
    document.querySelectorAll(".side-nav a").forEach((a) => a.addEventListener("click", () => setDrawer(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setDrawer(false);
    });
  }
}

function showMessage(el, message, type = "error") {
  if (!el) return;
  el.textContent = "";
  el.className = `msg ${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = type === "success" ? ICONS.check : type === "info" ? ICONS.info : ICONS.alert;
  const text = document.createElement("span");
  text.textContent = message;
  el.appendChild(icon);
  el.appendChild(text);
  el.classList.remove("hidden");
}

function hideMessage(el) {
  if (!el) return;
  el.classList.add("hidden");
}
// Shared inline icon set (stroke style) for JS-rendered markup.
const _svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  file: _svg(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>`),
  sparkles: _svg(`<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z"/>`),
  check: _svg(`<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>`),
  alert: _svg(`<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/>`),
  info: _svg(`<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>`),
  arrow: _svg(`<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>`),
  trash: _svg(`<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>`),
  clock: _svg(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
  inbox: _svg(`<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z"/>`),
  upload: _svg(`<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M20 16v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2"/>`),
  book: _svg(`<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2V4z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7V4z"/>`),
  trending: _svg(`<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>`),
  users: _svg(`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`),
  layers: _svg(`<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>`),
  help: _svg(`<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a3 3 0 0 1 5.8 1c0-2-3-2.5-3-4"/><path d="M12 17h.01"/>`),
  calendar: _svg(`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>`),
  shield: _svg(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>`),
  zap: _svg(`<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>`),
};

// Toast notifications — modern replacement for native alerts on action feedback.
const Toast = (() => {
  let viewport = null;
  function ensureViewport() {
    if (!viewport) {
      viewport = document.createElement("div");
      viewport.className = "toast-viewport";
      document.body.appendChild(viewport);
    }
    return viewport;
  }
  function show(message, type = "info", duration = 4000) {
    const v = ensureViewport();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    const icon = type === "success" ? ICONS.check : type === "error" ? ICONS.alert : ICONS.info;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text"></span><button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>`;
    toast.querySelector(".toast-text").textContent = message;
    v.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("in"));
    let timer = setTimeout(dismiss, duration);
    function dismiss() {
      clearTimeout(timer);
      if (!toast.isConnected) return;
      toast.classList.remove("in");
      toast.classList.add("out");
      setTimeout(() => toast.remove(), 260);
    }
    toast.querySelector(".toast-close").addEventListener("click", dismiss);
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => { timer = setTimeout(dismiss, 1600); });
    while (v.children.length > 4) v.firstElementChild.remove();
    return dismiss;
  }
  return {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error", 5200),
    info: (m) => show(m, "info"),
  };
})();
// Escape user/server strings before interpolating them into HTML.
function uiEscape(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Promise-based confirm dialog (modern replacement for native confirm()).
function confirmDialog(options = {}) {
  const {
    title = "Are you sure?",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false,
  } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-desc">
        <div class="modal-icon${danger ? " danger" : ""}">${danger ? ICONS.alert : ICONS.info}</div>
        <h3 id="cd-title"></h3>
        <p id="cd-desc"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel"></button>
          <button type="button" class="btn ${danger ? "btn-danger" : ""}" data-act="ok"></button>
        </div>
      </div>`;
    overlay.querySelector("#cd-title").textContent = title;
    overlay.querySelector("#cd-desc").textContent = message;
    const cancelBtn = overlay.querySelector('[data-act="cancel"]');
    const okBtn = overlay.querySelector('[data-act="ok"]');
    cancelBtn.textContent = cancelText;
    okBtn.textContent = confirmText;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("in"));
    const previouslyFocused = document.activeElement;
    okBtn.focus();

    function close(value) {
      overlay.classList.remove("in");
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
      resolve(value);
    }
    function onKey(e) {
      if (e.key === "Escape") close(false);
      if (e.key === "Tab") {
        const focusables = [cancelBtn, okBtn];
        const i = focusables.indexOf(document.activeElement);
        e.preventDefault();
        focusables[(i + (e.shiftKey ? focusables.length - 1 : 1)) % focusables.length].focus();
      }
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) return close(false);
      const act = e.target.closest("[data-act]");
      if (act) close(act.dataset.act === "ok");
    });
    document.addEventListener("keydown", onKey);
  });
}
// Injects the reusable app shell (skip link, sidebar, scrim, topbar, footer).
function mountAppShell(activePage, title) {
  if (document.body.dataset.shellReady) return;
  document.body.dataset.shellReady = "1";
  document.body.classList.add("has-shell");

  const moonIcon = `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
  const sunIcon = `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

  const html = `
  <a class="skip-link" href="#main">Skip to main content</a>
  <aside class="sidebar" id="sidebar" aria-label="Sidebar">
    <div class="sidebar-head">
      <a class="brand" href="dashboard.html">
        <span class="brand-mark" aria-hidden="true">${ICONS.sparkles}</span>
        <span class="brand-copy"><strong>Learn Mate AI</strong><small>AI Study Buddy</small></span>
      </a>
      <button type="button" class="icon-btn drawer-close" id="drawer-close" aria-label="Close menu">${_svg(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`)}</button>
    </div>
    <nav class="side-nav" aria-label="Primary">
      <p class="nav-label">Menu</p>
      <a class="nav-link" href="dashboard.html" data-page="dashboard">${_svg(`<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>`)}<span>Dashboard</span></a>
      <a class="nav-link" href="materials.html" data-page="materials">${ICONS.file}<span>Materials</span></a>
      <a class="nav-link hidden" href="admin.html" data-page="admin" id="nav-admin-link">${ICONS.shield}<span>Admin</span></a>
    </nav>
    <div class="sidebar-foot">
      <div class="user-chip">
        <span class="avatar" id="nav-avatar" aria-hidden="true">·</span>
        <span class="user-meta">
          <span class="user-name" id="nav-user">Signed in</span>
          <span class="user-role" id="nav-role"></span>
        </span>
      </div>
      <div class="side-actions">
        <button type="button" class="icon-btn" id="theme-toggle" aria-label="Switch theme">${moonIcon}${sunIcon}</button>
        <a class="icon-btn" href="#" id="nav-logout" aria-label="Log out" title="Log out">${_svg(`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>`)}</a>
      </div>
    </div>
  </aside>
  <div class="scrim" id="sidebar-scrim"></div>
  <header class="topbar">
    <button type="button" class="icon-btn menu-btn" id="menu-toggle" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${_svg(`<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>`)}</button>
    <p class="topbar-title">${uiEscape(title)}</p>
    <div class="topbar-actions">
      <a class="btn btn-sm" href="materials.html#upload" aria-label="Upload new material">${ICONS.upload}<span class="btn-label">New material</span></a>
    </div>
  </header>`;

  document.body.insertAdjacentHTML("afterbegin", html);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer class="app-footer">© 2026 Learn Mate AI · AI Study Buddy</footer>`
  );
}
// ---- Reusable loading / empty / error state helpers ----
function skeletonCards(count = 6) {
  const card = `<div class="sk-card"><div style="display:flex;gap:12px;align-items:center"><div class="sk sk-icon"></div><div style="flex:1"><div class="sk sk-line w60" style="margin-bottom:8px"></div><div class="sk sk-line w40"></div></div></div><div class="sk sk-line w80"></div><div class="sk sk-line w60"></div></div>`;
  return Array.from({ length: count }, () => card).join("");
}

function skeletonRows(count = 3) {
  const row = `<div class="sk-row"><div class="sk sk-avatar"></div><div class="sk-body"><div class="sk sk-line w60"></div><div class="sk sk-line w40"></div></div></div>`;
  return Array.from({ length: count }, () => row).join("");
}

function emptyStateHtml({ icon = "inbox", title = "Nothing here yet", text = "", cta = "", href = "", compact = false } = {}) {
  return `
    <div class="state${compact ? " compact" : ""}">
      <span class="state-icon">${ICONS[icon] || ICONS.inbox}</span>
      <h3>${uiEscape(title)}</h3>
      ${text ? `<p>${uiEscape(text)}</p>` : ""}
      ${cta && href ? `<a class="btn" href="${href}">${uiEscape(cta)}</a>` : ""}
    </div>`;
}

function errorStateHtml(title = "Something went wrong", text = "", retryAttr = "", compact = false) {
  return `
    <div class="state error${compact ? " compact" : ""}">
      <span class="state-icon">${ICONS.alert}</span>
      <h3>${uiEscape(title)}</h3>
      ${text ? `<p>${uiEscape(text)}</p>` : ""}
      ${retryAttr ? `<button type="button" class="btn btn-ghost" ${retryAttr}>Try again</button>` : ""}
    </div>`;
}

// ---- Date & file-size helpers ----
function formatDate(ts, opts = {}) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return opts.withTime
    ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatBytes(bytes) {
  if (typeof bytes !== "number" || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Theme toggle (dark / light) ----
function getPreferredTheme() {
  try {
    return localStorage.getItem("theme") === "light" ? "light" : "dark";
  } catch (err) {
    return "dark";
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch (err) {
    /* ignore storage failures */
  }
  document.querySelectorAll("#theme-toggle").forEach((btn) => {
    btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
  });
}

function initThemeToggle() {
  applyTheme(getPreferredTheme());
  const btn = document.getElementById("theme-toggle");
  if (!btn || btn.dataset.ready) return;
  btn.dataset.ready = "1";
  btn.addEventListener("click", () => applyTheme(getPreferredTheme() === "dark" ? "light" : "dark"));
}
initThemeToggle();

// ---- Password visibility toggles (delegated, works on auth pages) ----
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-toggle-password]");
  if (!btn) return;
  const input = document.getElementById(btn.dataset.togglePassword);
  if (!input) return;
  const revealing = input.type === "password";
  input.type = revealing ? "text" : "password";
  btn.classList.toggle("revealed", revealing);
  btn.setAttribute("aria-label", revealing ? "Hide password" : "Show password");
});





