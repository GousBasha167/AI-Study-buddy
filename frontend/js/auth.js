// Login / Register page logic

(function () {
  // If already logged in, skip straight to the dashboard.
  if (
    Storage.getAccessToken() &&
    (location.pathname.endsWith("index.html") ||
      location.pathname.endsWith("register.html") ||
      location.pathname === "/")
  ) {
    window.location.href = "dashboard.html";
    return;
  }

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const msgEl = document.getElementById("msg");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMessage(msgEl);
      const btn = document.getElementById("login-btn");
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Logging in…`;
      try {
        const data = await Api.login({ email, password });
        Storage.setSession(data);
        window.location.href = "dashboard.html";
      } catch (err) {
        showMessage(msgEl, err.message);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMessage(msgEl);
      const btn = document.getElementById("register-btn");
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const role = document.getElementById("role").value;

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Creating account…`;
      try {
        const data = await Api.register({ name, email, password, role });
        Storage.setSession(data);
        window.location.href = "dashboard.html";
      } catch (err) {
        showMessage(msgEl, err.message);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  }
})();
