// Dashboard page logic

(async function () {
  const user = requireAuth();
  if (!user) return;

  initNavbar("dashboard", "Dashboard");

  const greetingEl = document.getElementById("greeting-time");
  const welcomeName = document.getElementById("welcome-name");
  const msgEl = document.getElementById("msg");
  const statMaterials = document.getElementById("stat-materials");
  const statSummarized = document.getElementById("stat-summarized");
  const statQuizzes = document.getElementById("stat-quizzes");
  const recentList = document.getElementById("recent-list");
  const continueEl = document.getElementById("continue-learning");
  const progressPanel = document.getElementById("progress-panel");
  const qaAdmin = document.getElementById("qa-admin");

  if (greetingEl) {
    const hour = new Date().getHours();
    greetingEl.textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }
  if (welcomeName && user.name) welcomeName.textContent = `, ${user.name}`;
  if (qaAdmin && user.role === "admin") qaAdmin.classList.remove("hidden");

  const rowSkeleton = (line1 = "w60") =>
    `<div class="sk-row"><div class="sk sk-avatar"></div><div class="sk-body"><div class="sk sk-line ${line1}"></div><div class="sk sk-line w40"></div></div></div>`;

  async function loadDashboard() {
    hideMessage(msgEl);
    if (continueEl) continueEl.innerHTML = rowSkeleton();
    if (recentList) recentList.innerHTML = rowSkeleton() + rowSkeleton("w80");
    if (progressPanel) {
      progressPanel.innerHTML = `<div class="sk sk-line w80" style="margin-bottom:12px"></div><div class="sk sk-line w60"></div>`;
    }

    try {
      const materials = await Api.getMaterials();
      renderStats(materials);
      renderContinue(materials);
      renderRecent(materials);
      renderProgress(materials);
    } catch (err) {
      showMessage(msgEl, err.message);
      const retryAttr = `data-action="retry-dashboard"`;
      if (continueEl) continueEl.innerHTML = errorStateHtml("Couldn't load", err.message, retryAttr, true);
      if (recentList) recentList.innerHTML = errorStateHtml("Couldn't load", err.message, retryAttr, true);
      if (progressPanel) progressPanel.innerHTML = errorStateHtml("Couldn't load", err.message, retryAttr, true);
      document.querySelectorAll('[data-action="retry-dashboard"]').forEach((btn) => {
        btn.addEventListener("click", loadDashboard);
      });
    }
  }

  function renderStats(materials) {
    animateCount(statMaterials, materials.length);
    animateCount(statSummarized, materials.filter((m) => m.summary).length);
    animateCount(statQuizzes, materials.filter((m) => m.quiz && m.quiz.length).length);
  }

  function animateCount(el, target) {
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !target) {
      el.textContent = String(target);
      return;
    }
    const duration = 650;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function renderContinue(materials) {
    if (!continueEl) return;
    if (!materials.length) {
      continueEl.innerHTML = emptyStateHtml({
        icon: "book",
        title: "Nothing in progress yet",
        text: "Upload your first material to start learning with AI.",
        cta: "Upload material",
        href: "materials.html#upload",
        compact: true,
      });
      return;
    }
    const m = materials[0];
    continueEl.innerHTML = `
      <div class="continue-item">
        <span class="ci-icon" aria-hidden="true">${ICONS.book}</span>
        <div class="ci-body">
          <h4>${escapeHtml(m.title)}</h4>
          <div class="meta">
            <span>${m.filename ? escapeHtml(m.filename) : "Untitled file"}</span>
            <span aria-hidden="true">·</span>
            <span>${formatDate(m.createdAt)}</span>
          </div>
          <div class="continue-tags">
            ${m.summary
              ? `<span class="badge badge-success">${ICONS.check} Summarized</span>`
              : `<span class="badge">Not summarized yet</span>`}
          </div>
        </div>
        <a class="btn btn-sm" href="material.html?id=${encodeURIComponent(m._id)}">Resume ${ICONS.arrow}</a>
      </div>`;
  }

  function renderRecent(materials) {
    if (!recentList) return;
    if (!materials.length) {
      recentList.innerHTML = emptyStateHtml({
        icon: "inbox",
        title: "No materials yet",
        text: "Your latest uploads will show up here.",
        compact: true,
      });
      return;
    }
    recentList.innerHTML = materials
      .slice(0, 5)
      .map(
        (m) => `
      <div class="material-item">
        <span class="mi-icon" aria-hidden="true">${ICONS.file}</span>
        <div class="info">
          <h4>${escapeHtml(m.title)}</h4>
          <div class="meta">
            <span>${formatDate(m.createdAt, { withTime: true })}</span>
            ${m.summary ? `<span class="badge badge-success">${ICONS.check} Summarized</span>` : ""}
          </div>
        </div>
        <div class="actions">
          <a class="btn btn-ghost btn-sm" href="material.html?id=${encodeURIComponent(m._id)}">Open</a>
        </div>
      </div>`
      )
      .join("");
  }

  function renderProgress(materials) {
    if (!progressPanel) return;
    const total = materials.length;
    const summarized = materials.filter((m) => m.summary).length;
    const pct = total ? Math.round((summarized / total) * 100) : 0;

    if (!total) {
      progressPanel.innerHTML = emptyStateHtml({
        icon: "trending",
        title: "No progress data yet",
        text: "Generate an AI summary to start tracking your progress.",
        compact: true,
      });
      return;
    }

    // Real upload activity over the last 7 days (derived from createdAt).
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ t: d.getTime(), label: d.toLocaleDateString(undefined, { weekday: "short" }).charAt(0), count: 0 });
    }
    materials.forEach((m) => {
      const key = new Date(m.createdAt);
      key.setHours(0, 0, 0, 0);
      const day = days.find((d) => d.t === key.getTime());
      if (day) day.count++;
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    const weekCount = days.reduce((s, d) => s + d.count, 0);

    progressPanel.innerHTML = `
      <div class="progress-hero">
        <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
        <div class="ph-copy">
          <strong>AI summaries generated</strong>
          <span>${summarized} of ${total} material${total === 1 ? "" : "s"} summarized with AI.</span>
        </div>
      </div>
      <div class="progress">
        <div class="progress-top"><strong>Summarized materials</strong><span>${summarized}/${total}</span></div>
        <div class="progress-track"><div class="progress-fill" data-width="${pct}"></div></div>
      </div>
      <p class="section-label">Activity · last 7 days</p>
      <div class="activity-chart">
        ${days
          .map(
            (d) =>
              `<div class="activity-col" title="${d.count} upload${d.count === 1 ? "" : "s"}"><div class="activity-bar" style="height:${Math.max(6, Math.round((d.count / max) * 100))}%"></div><span>${d.label}</span></div>`
          )
          .join("")}
      </div>
      <p class="activity-caption">${
        weekCount
          ? `${weekCount} material${weekCount === 1 ? "" : "s"} uploaded this week.`
          : "No uploads in the last 7 days."
      }</p>`;

    requestAnimationFrame(() => {
      const fill = progressPanel.querySelector(".progress-fill");
      if (fill) fill.style.width = fill.dataset.width + "%";
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  await loadDashboard();
})();

