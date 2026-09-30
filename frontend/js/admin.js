// Admin page logic: stats + user management (admins only)

(function () {
  const user = requireAuth();
  if (!user) return;

  // Non-admins get bounced back to the dashboard (backend also rejects them).
  if (user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  initNavbar("admin", "Admin");

  const msgEl = document.getElementById("msg");
  const usersList = document.getElementById("users-list");
  const statUsers = document.getElementById("stat-users");
  const statMaterials = document.getElementById("stat-materials");
  const usersCount = document.getElementById("users-count");

  async function loadStats() {
    try {
      const stats = await Api.getStats();
      statUsers.textContent = stats.totalUsers;
      statMaterials.textContent = stats.totalMaterials;
    } catch (err) {
      showMessage(msgEl, err.message);
    }
  }

  async function loadUsers() {
    usersList.innerHTML = skeletonRows(4);
    if (usersCount) usersCount.textContent = "";
    try {
      const users = await Api.getUsers();
      renderUsers(users);
    } catch (err) {
      showMessage(msgEl, err.message);
      usersList.innerHTML = errorStateHtml("Couldn't load users", err.message, `data-action="retry-users"`);
      usersList.querySelectorAll('[data-action="retry-users"]').forEach((btn) =>
        btn.addEventListener("click", loadUsers)
      );
    }
  }

  function renderUsers(users) {
    if (usersCount) {
      usersCount.textContent = `${users.length} account${users.length === 1 ? "" : "s"}`;
    }
    if (!users.length) {
      usersList.innerHTML = emptyStateHtml({
        icon: "users",
        title: "No users found",
        text: "Registered users will appear here.",
      });
      return;
    }

    usersList.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Joined</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map((u) => {
                const initial = ((u.name || "?").trim().charAt(0) || "?").toUpperCase();
                return `
            <tr>
              <td>
                <div class="user-cell">
                  <span class="avatar" aria-hidden="true">${initial}</span>
                  <span class="u-name">${escapeHtml(u.name)}</span>
                </div>
              </td>
              <td class="u-email">${escapeHtml(u.email)}</td>
              <td><span class="badge ${u.role === "admin" ? "badge-accent" : "badge-info"}">${escapeHtml(u.role)}</span></td>
              <td class="u-date">${new Date(u.createdAt).toLocaleDateString()}</td>
              <td>${
                u.role !== "admin"
                  ? `<button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-user" data-id="${u._id}" aria-label="Delete ${escapeAttr(u.name)}">${ICONS.trash} Delete</button>`
                  : ""
              }</td>
            </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

    usersList.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
      btn.addEventListener("click", () => handleDeleteUser(btn.dataset.id));
    });
  }

  async function handleDeleteUser(id) {
    const ok = await confirmDialog({
      title: "Delete this user?",
      message: "The user and ALL of their materials will be permanently removed. This cannot be undone.",
      confirmText: "Delete user",
      danger: true,
    });
    if (!ok) return;
    try {
      await Api.deleteUser(id);
      Toast.success("User deleted");
      loadUsers();
      loadStats();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  loadStats();
  loadUsers();
})();
