(function () {
  const STORAGE_KEY = "taskman.tasks";

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  document.addEventListener("DOMContentLoaded", function () {
    // loading fade-out
    const loading = document.querySelector(".loading-container");
    if (loading) {
      setTimeout(() => {
        loading.style.transition = "opacity 400ms ease";
        loading.style.opacity = "0";
        setTimeout(() => loading.remove(), 450);
      }, 700);
    }

    const taskList = document.querySelector(".task-list");
    const newBtn = document.querySelector(".btn-pixel");
    const searchInput = document.querySelector(".search-input");
    const navItems = document.querySelectorAll("nav.app-nav li");
    const btnClose = document.querySelector(".btn-close");
    const windowBody = document.querySelector(".window-body");
    const taskHeaderClear = document.querySelector(
      ".task-header span:last-child",
    );

    const modalOverlay = document.getElementById("task-modal-overlay");
    const modalForm = document.getElementById("task-form");
    const inputName = document.getElementById("task-name-input");
    const inputDate = document.getElementById("task-date-input");
    const inputStatus = document.getElementById("task-status-select");
    const cancelBtn = document.getElementById("task-cancel-btn");

    let tasks = [];
    let editingId = null;

    function saveTasks() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    function loadTasks() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      try {
        tasks = JSON.parse(raw) || [];
        return true;
      } catch (e) {
        tasks = [];
        return false;
      }
    }

    function updateCounts() {
      const doing = tasks.filter((t) => t.status !== "done").length;
      const done = tasks.filter((t) => t.status === "done").length;
      const nums = document.querySelectorAll(".cards-area .data-card .num");
      if (nums[0]) nums[0].textContent = String(doing).padStart(2, "0");
      if (nums[1]) nums[1].textContent = String(done).padStart(2, "0");
    }

    function createTaskElement(task) {
      const li = document.createElement("li");
      li.className = "task-item";
      li.dataset.id = task.id;

      const info = document.createElement("div");
      info.className = "task-info";
      const spanName = document.createElement("span");
      spanName.className = "task-name";
      spanName.textContent = task.name;
      const spanDate = document.createElement("span");
      spanDate.className = "task-date";
      spanDate.textContent = "截止: " + task.date;
      info.appendChild(spanName);
      info.appendChild(spanDate);

      const badge = document.createElement("div");
      badge.className =
        "status-badge " +
        (task.status === "done" ? "status-done" : "status-doing");
      badge.textContent = task.status === "done" ? "已完成" : "进行中";
      badge.style.cursor = "pointer";
      badge.addEventListener("click", function (e) {
        e.stopPropagation();
        task.status = task.status === "done" ? "doing" : "done";
        saveTasks();
        renderTasks();
      });

      const actions = document.createElement("div");
      actions.className = "task-actions";
      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.title = "编辑任务";
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openModal("edit", task.id);
      });
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.title = "删除任务";
      delBtn.textContent = "🗑";
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("确认删除此任务？")) return;
        tasks = tasks.filter((t) => t.id !== task.id);
        saveTasks();
        renderTasks();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(info);
      li.appendChild(badge);
      li.appendChild(actions);
      return li;
    }

    function renderTasks() {
      if (!taskList) return;
      taskList.innerHTML = "";
      tasks.forEach((t) => taskList.appendChild(createTaskElement(t)));
      applySearchFilter();
      updateCounts();
    }

    function openModal(mode, id) {
      if (!modalOverlay) return;
      modalOverlay.classList.add("active");
      if (mode === "edit") {
        editingId = id;
        const t = tasks.find((x) => x.id === id);
        if (t) {
          inputName.value = t.name;
          inputDate.value = t.date;
          inputStatus.value = t.status;
        }
      } else {
        editingId = null;
        inputName.value = "";
        inputDate.value = new Date(Date.now() + 7 * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);
        inputStatus.value = "doing";
      }
      inputName.focus();
    }

    function closeModal() {
      if (!modalOverlay) return;
      modalOverlay.classList.remove("active");
      editingId = null;
    }

    if (modalForm) {
      modalForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const name = inputName.value.trim();
        const date = inputDate.value;
        const status = inputStatus.value;
        if (!name) {
          alert("任务名称不能为空");
          inputName.focus();
          return;
        }
        if (editingId) {
          const idx = tasks.findIndex((t) => t.id === editingId);
          if (idx !== -1) {
            tasks[idx].name = name;
            tasks[idx].date = date;
            tasks[idx].status = status;
          }
        } else {
          const task = { id: generateId(), name, date, status };
          tasks.unshift(task);
        }
        saveTasks();
        renderTasks();
        closeModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    function applySearchFilter() {
      const q = searchInput && searchInput.value.trim().toLowerCase();
      if (!q) {
        document
          .querySelectorAll(".task-item")
          .forEach((li) => (li.style.display = ""));
        return;
      }
      document.querySelectorAll(".task-item").forEach((li) => {
        const name = li.querySelector(".task-name").textContent.toLowerCase();
        li.style.display = name.includes(q) ? "" : "none";
      });
    }

    if (newBtn)
      newBtn.addEventListener("click", function () {
        openModal("create");
      });
    if (searchInput) searchInput.addEventListener("input", applySearchFilter);
    if (navItems && navItems.length)
      navItems.forEach((li) =>
        li.addEventListener("click", function () {
          navItems.forEach((n) => n.classList.remove("active"));
          this.classList.add("active");
        }),
      );
    if (btnClose && windowBody)
      btnClose.addEventListener("click", function () {
        const hidden = windowBody.style.display === "none";
        windowBody.style.display = hidden ? "" : "none";
        btnClose.textContent = hidden ? "↗" : "↘";
      });
    if (taskHeaderClear) {
      taskHeaderClear.style.cursor = "pointer";
      taskHeaderClear.title = "清除已完成任务";
      taskHeaderClear.addEventListener("click", function () {
        if (!confirm("确认清除所有已完成任务？")) return;
        tasks = tasks.filter((t) => t.status !== "done");
        saveTasks();
        renderTasks();
      });
    }

    // 初始化: 从 localStorage 加载，否则抓取页面静态任务并持久化
    const hasSaved = loadTasks();
    if (!hasSaved) {
      const existing = Array.from(document.querySelectorAll(".task-item"));
      tasks = existing.map((li, idx) => {
        const nameEl = li.querySelector(".task-name");
        const dateEl = li.querySelector(".task-date");
        const badgeEl = li.querySelector(".status-badge");
        const name = nameEl ? nameEl.textContent : "任务";
        const date = dateEl
          ? dateEl.textContent.replace(/^截止:\s*/, "")
          : new Date().toISOString().slice(0, 10);
        const status =
          badgeEl && badgeEl.classList.contains("status-done")
            ? "done"
            : "doing";
        return { id: generateId() + "-" + idx, name, date, status };
      });
      saveTasks();
    }

    renderTasks();
  });
})();
