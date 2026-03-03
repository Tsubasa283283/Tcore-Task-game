const STORAGE_KEYS = {
  tasks: "tcore_tasks",
  stats: "tcore_stats",
};

const CATEGORY_TO_STAT = {
  筋トレ: "STR",
  英語: "INT",
  勉強: "KNOWLEDGE",
  仕事: "SOCIAL",
  思考: "WISDOM",
};

const DIFFICULTY_EXP = {
  EASY: 10,
  HARD: 25,
  EXTREME: 50,
};

const BOSSES = ["怠惰", "言い訳", "比較", "不安"];

const el = {
  form: document.getElementById("task-form"),
  title: document.getElementById("title"),
  category: document.getElementById("category"),
  difficulty: document.getElementById("difficulty"),
  dueDate: document.getElementById("dueDate"),
  submitBtn: document.getElementById("submit-btn"),
  cancelEdit: document.getElementById("cancel-edit"),
  taskList: document.getElementById("task-list"),
  statsGrid: document.getElementById("stats-grid"),
  coachLine: document.getElementById("coach-line"),
  coachImage: document.getElementById("coach-image"),
  coachPlaceholder: document.getElementById("coach-placeholder"),
  coachFrame: document.getElementById("coach-frame"),
  fallBadge: document.getElementById("fall-badge"),
  awakeningBar: document.getElementById("awakening-bar"),
  darkBar: document.getElementById("dark-bar"),
  bossBattle: document.getElementById("boss-battle"),
  bossResult: document.getElementById("boss-result"),
};

let tasks = loadTasks();
let stats = loadStats();
let editingTaskId = null;

boot();

function boot() {
  setupCoachImageFallback();
  applyDailyChecks();
  bindEvents();
  renderAll();
}

function bindEvents() {
  el.form.addEventListener("submit", onSubmitTask);
  el.cancelEdit.addEventListener("click", cancelEditMode);
  el.bossBattle.addEventListener("click", runBossBattle);
}

function onSubmitTask(event) {
  event.preventDefault();
  const title = el.title.value.trim();
  if (!title) return;

  const payload = {
    title,
    category: el.category.value,
    difficulty: el.difficulty.value,
    dueDate: el.dueDate.value || null,
  };

  if (editingTaskId) {
    updateTask(editingTaskId, payload);
  } else {
    addTask(payload);
  }

  resetForm();
  persistAll();
  renderAll();
}

function addTask(payload) {
  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    title: payload.title,
    category: payload.category,
    difficulty: payload.difficulty,
    dueDate: payload.dueDate,
    completed: false,
    createdAt: now,
    completedAt: null,
  };
  tasks.push(task);
}

function updateTask(taskId, payload) {
  tasks = tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      title: payload.title,
      category: payload.category,
      difficulty: payload.difficulty,
      dueDate: payload.dueDate,
    };
  });
}

function editTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editingTaskId = task.id;
  el.title.value = task.title;
  el.category.value = task.category;
  el.difficulty.value = task.difficulty;
  el.dueDate.value = task.dueDate || "";
  el.submitBtn.textContent = "更新";
  el.cancelEdit.hidden = false;
  el.title.focus();
}

function cancelEditMode() {
  resetForm();
}

function resetForm() {
  editingTaskId = null;
  el.form.reset();
  el.category.value = "筋トレ";
  el.difficulty.value = "EASY";
  el.submitBtn.textContent = "追加";
  el.cancelEdit.hidden = true;
}

function removeTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  if (editingTaskId === taskId) {
    resetForm();
  }
  persistAll();
  renderAll();
}

function completeTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.completed) return;

  task.completed = true;
  task.completedAt = new Date().toISOString();

  const gain = DIFFICULTY_EXP[task.difficulty] || 0;
  const statKey = CATEGORY_TO_STAT[task.category];

  stats.totalExp += gain;
  stats.categoryStats[statKey] += gain;
  stats.awakeningGauge = clamp(stats.awakeningGauge + Math.ceil(gain / 2), 0, 100);
  stats.darkGauge = clamp(stats.darkGauge - 8, 0, 100);
  stats.awakeningRate = clamp(stats.awakeningRate + Math.ceil(gain / 10), 0, 100);

  const today = dateKey(new Date());
  stats.dailyCompletions[today] = (stats.dailyCompletions[today] || 0) + 1;

  stats.consecutiveMissedDays = 0;
  stats.penaltyActive = false;

  persistAll();
  renderAll();
}

function applyDailyChecks() {
  const today = stripTime(new Date());
  const todayKey = dateKey(today);

  if (!stats.lastDailyCheck) {
    stats.lastDailyCheck = todayKey;
    stats.dailyCompletions[todayKey] = stats.dailyCompletions[todayKey] || 0;
    persistAll();
    return;
  }

  let cursor = addDays(parseDateKey(stats.lastDailyCheck), 1);

  while (cursor < today) {
    const key = dateKey(cursor);
    const count = stats.dailyCompletions[key] || 0;

    if (count > 0) {
      stats.consecutiveAchievedDays += 1;
      stats.consecutiveMissedDays = 0;
      stats.consecutiveRecoveryDays += 1;
      stats.penaltyActive = false;

      if (stats.consecutiveRecoveryDays >= 3) {
        stats.fallMode = false;
      }
    } else {
      stats.consecutiveMissedDays += 1;
      stats.consecutiveAchievedDays = 0;
      stats.consecutiveRecoveryDays = 0;
      stats.darkGauge = clamp(stats.darkGauge + 18, 0, 100);

      if (stats.consecutiveMissedDays % 3 === 0) {
        stats.awakeningRate = clamp(stats.awakeningRate - 10, 0, 100);
        stats.penaltyActive = true;
      }

      if (stats.consecutiveMissedDays >= 7 || stats.darkGauge >= 100) {
        stats.fallMode = true;
      }
    }

    cursor = addDays(cursor, 1);
  }

  stats.lastDailyCheck = todayKey;
  stats.dailyCompletions[todayKey] = stats.dailyCompletions[todayKey] || 0;
  persistAll();
}

function runBossBattle() {
  const boss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
  const rate = getMonthlyCompletionRate();
  const percent = Math.round(rate * 100);

  if (rate >= 0.6) {
    stats.awakeningRate = clamp(stats.awakeningRate + 12, 0, 100);
    stats.awakeningGauge = clamp(stats.awakeningGauge + 20, 0, 100);
    stats.darkGauge = clamp(stats.darkGauge - 15, 0, 100);
    el.coachLine.textContent = `ボス「${boss}」を撃破。積み上げが力になった。`;
    el.bossResult.textContent = `勝利: 当月達成率 ${percent}% / 覚醒率アップ。`;
  } else {
    stats.awakeningRate = clamp(stats.awakeningRate - 5, 0, 100);
    stats.darkGauge = clamp(stats.darkGauge + 12, 0, 100);
    el.coachLine.textContent = `ボス「${boss}」に敗北。言い訳は成長を止める。`;
    el.bossResult.textContent = `敗北: 当月達成率 ${percent}% / もっと積み上げろ。`;
  }

  if (stats.darkGauge >= 100) {
    stats.fallMode = true;
  }

  persistAll();
  renderAll();
}

function getMonthlyCompletionRate() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTasks = tasks.filter((task) => {
    const created = new Date(task.createdAt);
    return created.getFullYear() === currentYear && created.getMonth() === currentMonth;
  });

  if (!monthTasks.length) {
    return 0;
  }

  const completedCount = monthTasks.filter((task) => task.completed).length;
  return completedCount / monthTasks.length;
}

function renderAll() {
  renderTasks();
  renderStats();
  renderStateEffects();
}

function renderTasks() {
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (!sorted.length) {
    el.taskList.innerHTML = '<li class="empty">タスクがありません。まず1つ追加しよう。</li>';
    return;
  }

  el.taskList.innerHTML = sorted
    .map((task) => {
      const due = task.dueDate ? `期限: ${task.dueDate}` : "期限なし";
      const titleClass = task.completed ? "task-title done" : "task-title";
      const itemClass = task.completed ? "task-item done" : "task-item";
      const completeBtn = task.completed
        ? ""
        : `<button class="warn" data-action="complete" data-id="${task.id}">完了</button>`;

      return `
        <li class="${itemClass}">
          <div class="task-top">
            <strong class="${titleClass}">${escapeHtml(task.title)}</strong>
            <span>${task.completed ? "DONE" : "TODO"}</span>
          </div>
          <div class="task-meta">
            <span class="tag">${task.category}</span>
            <span class="tag">${task.difficulty}</span>
            <span>${due}</span>
          </div>
          <div class="task-actions">
            ${completeBtn}
            <button data-action="edit" data-id="${task.id}">編集</button>
            <button class="danger" data-action="delete" data-id="${task.id}">削除</button>
          </div>
        </li>
      `;
    })
    .join("");

  el.taskList.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === "complete") completeTask(id);
      if (action === "edit") editTask(id);
      if (action === "delete") removeTask(id);
    });
  });
}

function renderStats() {
  const level = Math.floor(stats.totalExp / 100) + 1;
  const today = dateKey(new Date());
  const todayDone = stats.dailyCompletions[today] || 0;

  const achievedDaysDisplay = stats.consecutiveAchievedDays + (todayDone > 0 ? 1 : 0);
  const missedDaysDisplay = todayDone > 0 ? 0 : stats.consecutiveMissedDays;
  const discipline = achievedDaysDisplay * 10;

  const entries = [
    ["レベル", String(level)],
    ["STR", String(stats.categoryStats.STR)],
    ["INT", String(stats.categoryStats.INT)],
    ["KNOWLEDGE", String(stats.categoryStats.KNOWLEDGE)],
    ["SOCIAL", String(stats.categoryStats.SOCIAL)],
    ["WISDOM", String(stats.categoryStats.WISDOM)],
    ["DISCIPLINE", String(discipline)],
    ["覚醒率", `${stats.awakeningRate}%`],
    ["連続達成日数", `${achievedDaysDisplay} 日`],
    ["連続未達成日数", `${missedDaysDisplay} 日`],
  ];

  el.statsGrid.innerHTML = entries
    .map(([name, value]) => `<dt>${name}</dt><dd>${value}</dd>`)
    .join("");

  el.awakeningBar.style.width = `${stats.awakeningGauge}%`;
  el.darkBar.style.width = `${stats.darkGauge}%`;
}

function renderStateEffects() {
  const today = dateKey(new Date());
  const todayDone = stats.dailyCompletions[today] || 0;

  if (stats.fallMode) {
    el.fallBadge.hidden = false;
    el.coachFrame.classList.add("fall");
  } else {
    el.fallBadge.hidden = true;
    el.coachFrame.classList.remove("fall");
  }

  document.body.classList.toggle("penalty", Boolean(stats.penaltyActive));

  if (stats.fallMode) {
    el.coachLine.textContent = "堕落モード。3日連続達成で復帰せよ。";
  } else if (stats.penaltyActive) {
    el.coachLine.textContent = "3日未達成。覚醒率が低下した。";
  } else if (todayDone > 0) {
    el.coachLine.textContent = "完了報告を確認。今日も前進だ。";
  } else {
    el.coachLine.textContent = "まだ今日は完了報告がない。今すぐ1件終わらせよう。";
  }
}

function setupCoachImageFallback() {
  el.coachImage.addEventListener("error", () => {
    el.coachImage.style.display = "none";
    el.coachPlaceholder.hidden = false;
  });

  el.coachImage.addEventListener("load", () => {
    el.coachImage.style.display = "block";
    el.coachPlaceholder.hidden = true;
  });
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tasks);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStats() {
  const defaults = {
    totalExp: 0,
    categoryStats: {
      STR: 0,
      INT: 0,
      KNOWLEDGE: 0,
      SOCIAL: 0,
      WISDOM: 0,
    },
    awakeningRate: 0,
    awakeningGauge: 0,
    darkGauge: 0,
    consecutiveAchievedDays: 0,
    consecutiveMissedDays: 0,
    consecutiveRecoveryDays: 0,
    penaltyActive: false,
    fallMode: false,
    lastDailyCheck: null,
    dailyCompletions: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.stats);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);

    return {
      ...defaults,
      ...parsed,
      categoryStats: {
        ...defaults.categoryStats,
        ...(parsed.categoryStats || {}),
      },
      dailyCompletions: {
        ...(parsed.dailyCompletions || {}),
      },
    };
  } catch {
    return defaults;
  }
}

function persistAll() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
}

function dateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function stripTime(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}

function addDays(dateObj, days) {
  const copy = new Date(dateObj);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
