// Materials page logic: list + search/filter + upload + delete

(function () {
  const user = requireAuth();
  if (!user) return;

  initNavbar("materials", "Materials");

  const msgEl = document.getElementById("msg");
  const uploadForm = document.getElementById("upload-form");
  const uploadBtn = document.getElementById("upload-btn");
  const listEl = document.getElementById("materials-list");
  const searchInput = document.getElementById("search-input");
  const chips = Array.from(document.querySelectorAll(".toolbar .chip"));
  const resultCount = document.getElementById("result-count");
  const fileInput = document.getElementById("file");
  const fileDrop = document.getElementById("file-drop");
  const fileName = document.getElementById("file-name");

  let allMaterials = [];
  let activeFilter = "all";

  async function loadMaterials() {
    hideMessage(msgEl);
    listEl.innerHTML = skeletonCards(3);
    if (resultCount) resultCount.textContent = "Loading…";
    try {
      allMaterials = await Api.getMaterials();
      renderFiltered();
    } catch (err) {
      showMessage(msgEl, err.message);
      listEl.innerHTML = errorStateHtml("Couldn't load materials", err.message, `data-action="retry-list"`);
      listEl.querySelectorAll('[data-action="retry-list"]').forEach((btn) =>
        btn.addEventListener("click", loadMaterials)
      );
      if (resultCount) resultCount.textContent = "";
    }
  }

  function getFiltered() {
    const q = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    return allMaterials.filter((m) => {
      const matchesFilter =
        activeFilter === "all" || (activeFilter === "summarized" ? !!m.summary : !m.summary);
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        (m.title || "").toLowerCase().includes(q) ||
        (m.filename || "").toLowerCase().includes(q)
      );
    });
  }

  function renderFiltered() {
    const items = getFiltered();
    if (resultCount) {
      resultCount.textContent = allMaterials.length
        ? `${items.length} of ${allMaterials.length} material${allMaterials.length === 1 ? "" : "s"}`
        : "";
    }

    if (!allMaterials.length) {
      listEl.innerHTML = emptyStateHtml({
        icon: "inbox",
        title: "No materials yet",
        text: "Upload your first .txt, .md or .pdf file to unlock AI summaries, flashcards and quizzes.",
        cta: "Upload a file",
        href: "#upload",
      });
      return;
    }

    if (!items.length) {
      listEl.innerHTML = `
        <div class="state">
          <span class="state-icon">${ICONS.inbox}</span>
          <h3>No matches found</h3>
          <p>Try a different search term, or clear your search and filters.</p>
          <button type="button" class="btn btn-ghost" data-action="clear-filters">Clear search &amp; filters</button>
        </div>`;
      listEl.querySelectorAll('[data-action="clear-filters"]').forEach((btn) =>
        btn.addEventListener("click", () => {
          if (searchInput) searchInput.value = "";
          activeFilter = "all";
          chips.forEach((c) => c.classList.toggle("active", c.dataset.filter === "all"));
          renderFiltered();
        })
      );
      return;
    }

    listEl.innerHTML = items.map((m, i) => materialCardHtml(m, i)).join("");
    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) =>
      btn.addEventListener("click", () => handleDelete(btn.dataset.id))
    );
  }
  function materialCardHtml(m, i) {
    const name = m.filename || m.title || "";
    const ext = (name.split(".").pop() || "").toLowerCase();
    const typeClass = ext === "pdf" ? " t-pdf" : ext === "md" ? " t-md" : ext === "txt" ? " t-txt" : "";
    return `
      <article class="material-card" style="animation-delay:${Math.min(i, 8) * 45}ms">
        <div class="mc-top">
          <span class="mc-icon${typeClass}" aria-hidden="true">${ICONS.file}</span>
          <button type="button" class="icon-btn danger-ghost" data-action="delete" data-id="${m._id}" aria-label="Delete ${escapeAttr(m.title)}" title="Delete material">
            ${ICONS.trash}
          </button>
        </div>
        <div>
          <h3 class="mc-title"><a href="material.html?id=${encodeURIComponent(m._id)}">${escapeHtml(m.title)}</a></h3>
          ${m.filename ? `<p class="mc-file" title="${escapeAttr(m.filename)}">${escapeHtml(m.filename)}</p>` : ""}
        </div>
        <div class="mc-meta">
          <span class="mc-date">${ICONS.clock}${formatDate(m.createdAt)}</span>
          ${m.summary
            ? `<span class="badge badge-success">${ICONS.check} Summarized</span>`
            : `<span class="badge">No summary</span>`}
        </div>
      </article>`;
  }

  async function handleDelete(id) {
    const ok = await confirmDialog({
      title: "Delete this material?",
      message: "The material and its AI content will be permanently removed. This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await Api.deleteMaterial(id);
      Toast.success("Material deleted");
      loadMaterials();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage(msgEl);

    const title = document.getElementById("title").value.trim();
    const file = fileInput.files[0];

    if (!file) {
      showMessage(msgEl, "Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    if (title) formData.append("title", title);
    formData.append("file", file);

    const originalHtml = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<span class="spinner"></span> Uploading…`;
    try {
      await Api.uploadMaterial(formData);
      Toast.success("Material uploaded");
      uploadForm.reset();
      if (fileName) fileName.textContent = "";
      loadMaterials();
    } catch (err) {
      showMessage(msgEl, err.message);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = originalHtml;
    }
  });

  // Search & filter chips (client-side over already-loaded materials)
  if (searchInput) searchInput.addEventListener("input", renderFiltered);
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter || "all";
      renderFiltered();
    });
  });

  // File label + drag-and-drop
  if (fileInput && fileName) {
    fileInput.addEventListener("change", () => {
      const f = fileInput.files[0];
      fileName.textContent = f ? `${f.name} · ${formatBytes(f.size)}` : "";
    });
  }
  if (fileDrop) {
    ["dragenter", "dragover"].forEach((ev) =>
      fileDrop.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDrop.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      fileDrop.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDrop.classList.remove("dragover");
      })
    );
    fileDrop.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length && fileInput) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  loadMaterials();
})();

