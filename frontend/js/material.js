// Material detail page: view content + trigger AI features

(function () {
  const user = requireAuth();
  if (!user) return;

  initNavbar("materials", "Material");

  const params = new URLSearchParams(window.location.search);
  const materialId = params.get("id");
  const msgEl = document.getElementById("msg");

  if (!materialId) {
    showMessage(msgEl, "No material selected.");
    return;
  }

  const titleEl = document.getElementById("material-title");
  const metaEl = document.getElementById("material-meta");
  const contentEl = document.getElementById("material-content");
  const badgesEl = document.getElementById("material-badges");

  let currentMaterial = null;

  async function loadMaterial() {
    try {
      currentMaterial = await Api.getMaterial(materialId);
      titleEl.textContent = currentMaterial.title;
      document.title = `${currentMaterial.title} · Learn Mate AI`;
      metaEl.textContent = `${currentMaterial.filename || "Untitled file"} · Uploaded ${formatDate(currentMaterial.createdAt, { withTime: true })}`;
      contentEl.textContent = currentMaterial.content;
      renderBadges(currentMaterial);

      if (currentMaterial.summary) renderSummary(currentMaterial.summary);
      if (currentMaterial.flashcards && currentMaterial.flashcards.length) renderFlashcards(currentMaterial.flashcards);
      if (currentMaterial.quiz && currentMaterial.quiz.length) renderQuiz(currentMaterial.quiz);
      if (currentMaterial.studyPlan) renderStudyPlan(currentMaterial.studyPlan);
    } catch (err) {
      showMessage(msgEl, err.message);
      titleEl.textContent = "Material not found";
      metaEl.textContent = "We couldn't load this material.";
      if (contentEl) contentEl.textContent = "";
      if (badgesEl) badgesEl.innerHTML = "";
    }
  }

  function renderBadges(m) {
    if (!badgesEl) return;
    const badges = [];
    if (m.summary) badges.push(`<span class="badge badge-success">${ICONS.check} Summarized</span>`);
    if (m.flashcards && m.flashcards.length) {
      badges.push(`<span class="badge badge-accent">${ICONS.layers} ${m.flashcards.length} flashcards</span>`);
    }
    if (m.quiz && m.quiz.length) {
      badges.push(`<span class="badge badge-info">${ICONS.help} ${m.quiz.length} quiz questions</span>`);
    }
    if (m.studyPlan) badges.push(`<span class="badge badge-accent">${ICONS.calendar} Study plan</span>`);
    badgesEl.innerHTML = badges.join("");
  }

  // Tabs
  const tabButtons = document.querySelectorAll(".tabs button[data-tab]");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });

  // Summary
  const summarizeBtn = document.getElementById("btn-summarize");
  const summaryResult = document.getElementById("summary-result");

  summarizeBtn.addEventListener("click", async () => {
    await withLoading(
      summarizeBtn,
      async () => {
        const { summary } = await Api.summarize(materialId);
        renderSummary(summary);
      },
      "Summary generated"
    );
  });

  function renderSummary(summary) {
    summaryResult.innerHTML = `<div class="ai-output"><pre class="content-box">${escapeHtml(summary)}</pre></div>`;
    if (currentMaterial) {
      currentMaterial.summary = summary;
      renderBadges(currentMaterial);
    }
  }

  // Flashcards
  const flashcardsBtn = document.getElementById("btn-flashcards");
  const flashcardsResult = document.getElementById("flashcards-result");

  flashcardsBtn.addEventListener("click", async () => {
    const count = parseInt(document.getElementById("flashcards-count").value, 10) || 5;
    await withLoading(
      flashcardsBtn,
      async () => {
        const { flashcards } = await Api.generateFlashcards(materialId, count);
        renderFlashcards(flashcards);
      },
      "Flashcards ready"
    );
  });

  function renderFlashcards(flashcards) {
    flashcardsResult.innerHTML =
      `<div class="flashcards-grid">` +
      flashcards
        .map(
          (f, i) => `
      <div class="flashcard" data-index="${i}" role="button" tabindex="0" aria-pressed="false">
        <div class="fc-top"><span class="badge badge-accent">Q${i + 1}</span><span class="fc-hint">Tap to flip</span></div>
        <p class="fc-q">${escapeHtml(f.question)}</p>
        <div class="fc-a">${escapeHtml(f.answer)}</div>
      </div>`
        )
        .join("") +
      `</div>`;

    flashcardsResult.querySelectorAll(".flashcard").forEach((card) => {
      const flip = () => {
        const on = card.classList.toggle("flipped");
        card.setAttribute("aria-pressed", String(on));
        const hint = card.querySelector(".fc-hint");
        if (hint) hint.textContent = on ? "Tap to hide" : "Tap to flip";
      };
      card.addEventListener("click", flip);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          flip();
        }
      });
    });

    if (currentMaterial) {
      currentMaterial.flashcards = flashcards;
      renderBadges(currentMaterial);
    }
  }
  // Quiz
  const quizBtn = document.getElementById("btn-quiz");
  const quizResult = document.getElementById("quiz-result");

  quizBtn.addEventListener("click", async () => {
    const count = parseInt(document.getElementById("quiz-count").value, 10) || 5;
    await withLoading(
      quizBtn,
      async () => {
        const { quiz } = await Api.generateQuiz(materialId, count);
        renderQuiz(quiz);
      },
      "Quiz ready"
    );
  });

  function renderQuiz(quiz) {
    quizResult.innerHTML =
      `<div class="quiz-list">` +
      quiz
        .map(
          (q, i) => `
      <div class="quiz-question" data-index="${i}" data-answer="${escapeAttr(q.answer)}">
        <p class="quiz-q"><span class="q-num">Q${i + 1}.</span><span>${escapeHtml(q.question)}</span></p>
        <div class="options">
          ${q.options
            .map(
              (opt) =>
                `<label class="quiz-option"><input type="radio" name="quiz-${i}" value="${escapeAttr(opt)}" /> <span>${escapeHtml(opt)}</span></label>`
            )
            .join("")}
        </div>
        <div class="feedback neutral" aria-live="polite"></div>
      </div>`
        )
        .join("") +
      `</div>
      <div style="margin-top:16px"><button type="button" class="btn" id="btn-check-quiz">Check answers</button></div>`;

    document.getElementById("btn-check-quiz").addEventListener("click", () => {
      quizResult.querySelectorAll(".quiz-question").forEach((q) => {
        const correctAnswer = q.dataset.answer;
        const selected = q.querySelector('input[type="radio"]:checked');
        const feedback = q.querySelector(".feedback");
        q.classList.remove("is-correct", "is-wrong");
        if (!selected) {
          feedback.textContent = "No answer selected.";
          feedback.className = "feedback neutral";
        } else if (selected.value === correctAnswer) {
          feedback.textContent = "Correct!";
          feedback.className = "feedback correct";
          q.classList.add("is-correct");
        } else {
          feedback.textContent = `Incorrect. Correct answer: ${correctAnswer}`;
          feedback.className = "feedback incorrect";
          q.classList.add("is-wrong");
        }
      });
    });

    if (currentMaterial) {
      currentMaterial.quiz = quiz;
      renderBadges(currentMaterial);
    }
  }

  // Study plan
  const studyPlanBtn = document.getElementById("btn-studyplan");
  const studyPlanResult = document.getElementById("studyplan-result");

  studyPlanBtn.addEventListener("click", async () => {
    const goal = document.getElementById("plan-goal").value.trim();
    const hoursPerDay = parseInt(document.getElementById("plan-hours").value, 10) || 2;
    const days = parseInt(document.getElementById("plan-days").value, 10) || 7;

    await withLoading(
      studyPlanBtn,
      async () => {
        const { studyPlan } = await Api.generateStudyPlan(materialId, { goal, hoursPerDay, days });
        renderStudyPlan(studyPlan);
      },
      "Study plan ready"
    );
  });

  function renderStudyPlan(studyPlan) {
    studyPlanResult.textContent = studyPlan;
    studyPlanResult.classList.remove("hidden");
    if (currentMaterial) {
      currentMaterial.studyPlan = studyPlan;
      renderBadges(currentMaterial);
    }
  }

  async function withLoading(btn, fn, successMsg) {
    hideMessage(msgEl);
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Working…`;
    try {
      await fn();
      if (successMsg) Toast.success(successMsg);
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
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

  loadMaterial();
})();

