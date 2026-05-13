(function () {
  const STORAGE_KEY = "taskman.tasks";
  const SHARE_PARAM = "share";
  const LANG_KEY = "taskman.lang";
  const THEME_KEY = "taskman.theme";

  const i18n = {
    zh: {
      appTitle: "GHOSH 工作台",
      searchPlaceholder: "搜索任务...",
      newTask: "新建任务",
      navDashboard: "仪表板",
      navTasks: "我的任务",
      navTeam: "团队协作",
      navSettings: "设置",
      cardTodo: "今日待办",
      cardDone: "已完成",
      taskHeader: "⚠️ 警告：现实任务！",
      modalTitle: "任务编辑",
      labelName: "名称",
      labelDate: "截止日期",
      labelStatus: "状态",
      statusDoing: "进行中",
      statusDone: "已完成",
      labelPriority: "优先级",
      priorityLow: "低",
      priorityMedium: "中",
      priorityHigh: "高",
      labelTag: "标签",
      tagWork: "工作",
      tagPersonal: "个人",
      tagStudy: "学习",
      tagOther: "其他",
      filterAll: "全部",
      btnCancel: "取消",
      btnSave: "保存",
      datePrefix: "截止：",
      shareBtn: "🔗 分享",
      exportBtn: "📥 导出",
      langBtn: "🌐 EN",
      alertNoTask: "没有可分享的任务！请先创建一些任务。",
      alertShareFail: "分享失败：数据压缩出错",
      alertShareSuccess: "✅ 分享链接已生成！\n\n📊 压缩统计:\n- 原始大小: {original} 字符\n- 压缩后: {compressed} 字符\n- 压缩率: {ratio}%\n\n🔗 链接已复制到剪贴板，可直接发送给他人！",
      alertCopyFail: "请手动复制以下分享链接:",
      alertRestore: "🎉 已从链接恢复 {count} 个任务！\n\n这些任务来自分享链接，无需数据库即可查看。",
      alertNameRequired: "任务名称不能为空",
      alertDeleteConfirm: "确认删除此任务？",
      alertClearConfirm: "确认清除所有已完成任务？",
    },
    en: {
      appTitle: "GHOSH WORKSPACE",
      searchPlaceholder: "Search tasks...",
      newTask: "NEW TASK",
      navDashboard: "Dashboard",
      navTasks: "My Tasks",
      navTeam: "Team Work",
      navSettings: "Settings",
      cardTodo: "Today's Todo",
      cardDone: "Completed",
      taskHeader: "⚠️ WARNING: REALITY TASKS!",
      modalTitle: "Task Editor",
      labelName: "Name",
      labelDate: "Due Date",
      labelStatus: "Status",
      statusDoing: "In Progress",
      statusDone: "Completed",
      labelPriority: "Priority",
      priorityLow: "Low",
      priorityMedium: "Medium",
      priorityHigh: "High",
      labelTag: "Tag",
      tagWork: "Work",
      tagPersonal: "Personal",
      tagStudy: "Study",
      tagOther: "Other",
      filterAll: "All",
      btnCancel: "Cancel",
      btnSave: "Save",
      datePrefix: "Due: ",
      shareBtn: "🔗 Share",
      exportBtn: "📥 Export",
      langBtn: "🌐 中文",
      alertNoTask: "No tasks to share! Please create some tasks first.",
      alertShareFail: "Share failed: Data compression error",
      alertShareSuccess: "✅ Share link generated!\n\n📊 Compression Stats:\n- Original size: {original} chars\n- Compressed size: {compressed} chars\n- Compression rate: {ratio}%\n\n🔗 Link copied to clipboard, send it to others!",
      alertCopyFail: "Please copy this link manually:",
      alertRestore: "🎉 Restored {count} tasks from link!\n\nThese tasks come from a shared link, no database needed.",
      alertNameRequired: "Task name cannot be empty",
      alertDeleteConfirm: "Confirm delete this task?",
      alertClearConfirm: "Confirm clear all completed tasks?",
    },
  };

  let currentLang = localStorage.getItem(LANG_KEY) || "zh";

  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    const t = i18n[lang];

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key]) el.textContent = t[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (t[key]) el.placeholder = t[key];
    });

    document.querySelectorAll("[data-i18n-option]").forEach((el) => {
      const key = el.getAttribute("data-i18n-option");
      if (t[key]) el.textContent = t[key];
    });

    const langBtn = document.getElementById("lang-btn");
    if (langBtn && t.langBtn) langBtn.textContent = t.langBtn;

    const exportBtn = document.getElementById("export-btn");
    if (exportBtn && t.exportBtn) exportBtn.textContent = t.exportBtn;
    if (shareBtn && t.shareBtn) shareBtn.textContent = t.shareBtn;

    updateTaskTexts();
  }

  function t(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || key;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const Encoding = {
    varintEncode(value) {
      const bytes = [];
      value = Math.max(0, value | 0);
      do {
        let byte = value & 0x7f;
        value >>>= 7;
        if (value > 0) byte |= 0x80;
        bytes.push(byte);
      } while (value > 0);
      return bytes;
    },

    varintDecode(bytes, offset = 0) {
      let result = 0;
      let shift = 0;
      while (offset < bytes.length) {
        const byte = bytes[offset++];
        result |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      return { value: result, offset };
    },

    zigZagEncode(n) {
      return (n << 1) ^ (n >> 31);
    },

    zigZagDecode(n) {
      return (n >>> 1) ^ -(n & 1);
    },

    stringToBytes(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) {
          bytes.push(code);
        } else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6));
          bytes.push(0x80 | (code & 0x3f));
        } else {
          bytes.push(0xe0 | (code >> 12));
          bytes.push(0x80 | ((code >> 6) & 0x3f));
          bytes.push(0x80 | (code & 0x3f));
        }
      }
      return bytes;
    },

    bytesToString(bytes) {
      let str = "";
      let i = 0;
      while (i < bytes.length) {
        if (bytes[i] < 0x80) {
          str += String.fromCharCode(bytes[i++]);
        } else if ((bytes[i] & 0xe0) === 0xc0) {
          str += String.fromCharCode(
            ((bytes[i] & 0x1f) << 6) | (bytes[i + 1] & 0x3f),
          );
          i += 2;
        } else {
          str += String.fromCharCode(
            ((bytes[i] & 0x0f) << 12) |
              ((bytes[i + 1] & 0x3f) << 6) |
              (bytes[i + 2] & 0x3f),
          );
          i += 3;
        }
      }
      return str;
    },
  };

  const Serializer = {
    encodeTasks(tasks) {
      const allBytes = [];
      allBytes.push(...Encoding.varintEncode(tasks.length));

      tasks.forEach((task) => {
        const nameBytes = Encoding.stringToBytes(task.name);
        const dateStr = task.date || "";

        allBytes.push(...Encoding.varintEncode(nameBytes.length));
        allBytes.push(...nameBytes);

        const dateNum =
          dateStr.length >= 10
            ? parseInt(dateStr.replace(/-/g, ""), 10)
            : 0;
        allBytes.push(...Encoding.varintEncode(Encoding.zigZagEncode(dateNum)));

        allBytes.push(
          ...Encoding.varintEncode(
            Encoding.zigZagEncode(task.status === "done" ? 1 : 0),
          ),
        );

        const priorityMap = { low: 0, medium: 1, high: 2 };
        const priorityVal = priorityMap[task.priority] || 1;
        allBytes.push(
          ...Encoding.varintEncode(Encoding.zigZagEncode(priorityVal)),
        );

        const tagMap = { work: 0, personal: 1, study: 2, other: 3 };
        const tagVal = tagMap[task.tag] || 0;
        allBytes.push(
          ...Encoding.varintEncode(Encoding.zigZagEncode(tagVal)),
        );
      });

      return allBytes;
    },

    decodeTasks(bytes) {
      const tasks = [];
      let offset = 0;

      const countResult = Encoding.varintDecode(bytes, offset);
      const count = countResult.value;
      offset = countResult.offset;

      for (let i = 0; i < count && offset < bytes.length; i++) {
        const nameLenResult = Encoding.varintDecode(bytes, offset);
        const nameLen = nameLenResult.value;
        offset = nameLenResult.offset;

        const nameBytes = bytes.slice(offset, offset + nameLen);
        const name = Encoding.bytesToString(nameBytes);
        offset += nameLen;

        const dateResult = Encoding.varintDecode(bytes, offset);
        const dateNum = Encoding.zigZagDecode(dateResult.value);
        offset = dateResult.offset;

        const statusResult = Encoding.varintDecode(bytes, offset);
        const statusCode = Encoding.zigZagDecode(statusResult.value);
        offset = statusResult.offset;

        let dateStr = String(dateNum);
        if (dateStr.length === 8) {
          dateStr = dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6, 8);
        }

        const priorityResult = Encoding.varintDecode(bytes, offset);
        const priorityVal = Encoding.zigZagDecode(priorityResult.value);
        offset = priorityResult.offset;
        const priorityMap = ["low", "medium", "high"];
        const priority = priorityMap[priorityVal] || "medium";

        const tagResult = Encoding.varintDecode(bytes, offset);
        const tagVal = Encoding.zigZagDecode(tagResult.value);
        offset = tagResult.offset;
        const tagMapReverse = ["work", "personal", "study", "other"];
        const tag = tagMapReverse[tagVal] || "work";

        tasks.push({
          id: generateId() + "-shared",
          name,
          date: dateStr,
          status: statusCode === 1 ? "done" : "doing",
          priority,
          tag,
        });
      }

      return tasks;
    },
  };

  const RDPSimplifier = {
    perpendicularDistance(point, lineStart, lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) {
        return Math.sqrt(
          Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2),
        );
      }
      const u =
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
        (mag * mag);
      const closestX = lineStart.x + u * dx;
      const closestY = lineStart.y + u * dy;
      return Math.sqrt(
        Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2),
      );
    },

    simplify(points, tolerance = 1) {
      if (points.length <= 2) return points;

      let maxDist = 0;
      let maxIndex = 0;
      const start = points[0];
      const end = points[points.length - 1];

      for (let i = 1; i < points.length - 1; i++) {
        const dist = this.perpendicularDistance(points[i], start, end);
        if (dist > maxDist) {
          maxDist = dist;
          maxIndex = i;
        }
      }

      if (maxDist > tolerance) {
        const left = this.simplify(points.slice(0, maxIndex + 1), tolerance);
        const right = this.simplify(points.slice(maxIndex), tolerance);
        return left.slice(0, -1).concat(right);
      } else {
        return [start, end];
      }
    },
  };

  const URLCompressor = {
    bytesToBase64URL(bytes) {
      const binary = bytes.map((b) => String.fromCharCode(b)).join("");
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    },

    base64URLToBytes(str) {
      str = str.replace(/-/g, "+").replace(/_/g, "/");
      const padding = str.length % 4;
      if (padding) {
        str += "=".repeat(4 - padding);
      }
      const binary = atob(str);
      const bytes = new Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    },

    compressToURL(tasks) {
      try {
        const encoded = Serializer.encodeTasks(tasks);
        const compressed = this.bytesToBase64URL(encoded);
        const url = new URL(window.location.href.split("?")[0]);
        url.searchParams.set(SHARE_PARAM, compressed);
        return url.toString();
      } catch (e) {
        console.error("压缩失败:", e);
        return null;
      }
    },

    decompressFromURL() {
      try {
        const params = new URLSearchParams(window.location.search);
        const data = params.get(SHARE_PARAM);
        if (!data) return null;
        const bytes = this.base64URLToBytes(data);
        return Serializer.decodeTasks(bytes);
      } catch (e) {
        console.error("解压失败:", e);
        return null;
      }
    },
  };

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
    const newBtn = document.getElementById("new-task-btn");
    const shareBtn = document.getElementById("share-btn");
    const exportBtn = document.getElementById("export-btn");
    const themeBtn = document.getElementById("theme-btn");
    const langBtn = document.getElementById("lang-btn");
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
    const inputPriority = document.getElementById("task-priority-select");
    const inputTag = document.getElementById("tag-select");
    const tagFilter = document.getElementById("tag-filter");
    const cancelBtn = document.getElementById("task-cancel-btn");

    let tasks = [];
    let editingId = null;

    function updateTaskTexts() {
      document.querySelectorAll(".task-date").forEach((el) => {
        if (el.dataset.originalDate) {
          el.textContent = t("datePrefix") + el.dataset.originalDate;
        }
      });
      document.querySelectorAll(".status-badge").forEach((el) => {
        if (el.classList.contains("status-done")) {
          el.textContent = t("statusDone");
        } else {
          el.textContent = t("statusDoing");
        }
      });
    }

    // 初始化语言
    applyLanguage(currentLang);

    // 语言切换按钮事件
    if (langBtn) {
      langBtn.addEventListener("click", function () {
        const newLang = currentLang === "zh" ? "en" : "zh";
        applyLanguage(newLang);
      });
    }

    // 主题切换
    let currentTheme = localStorage.getItem(THEME_KEY) || "light";
    if (currentTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      if (themeBtn) themeBtn.textContent = "☀️";
    }

    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        currentTheme = currentTheme === "light" ? "dark" : "light";
        localStorage.setItem(THEME_KEY, currentTheme);

        if (currentTheme === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
          themeBtn.textContent = "☀️";
        } else {
          document.documentElement.removeAttribute("data-theme");
          themeBtn.textContent = "🌙";
        }
      });
    }

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
      li.draggable = true;

      // 拖拽事件
      li.addEventListener("dragstart", handleDragStart);
      li.addEventListener("dragover", handleDragOver);
      li.addEventListener("drop", handleDrop);
      li.addEventListener("dragend", handleDragEnd);

      const info = document.createElement("div");
      info.className = "task-info";
      const spanName = document.createElement("span");
      spanName.className = "task-name";
      spanName.textContent = task.name;
      const spanDate = document.createElement("span");
      spanDate.className = "task-date";
      spanDate.dataset.originalDate = task.date;
      spanDate.textContent = t("datePrefix") + task.date;
      info.appendChild(spanName);
      info.appendChild(spanDate);

      const priority = task.priority || "medium";
      const priorityBadge = document.createElement("span");
      priorityBadge.className = `priority-badge priority-${priority}`;
      priorityBadge.title =
        priority === "high"
          ? t("priorityHigh")
          : priority === "medium"
            ? t("priorityMedium")
            : t("priorityLow");

      const tag = task.tag || "work";
      const tagBadge = document.createElement("span");
      tagBadge.className = `tag-badge tag-${tag}`;
      tagBadge.textContent =
        tag === "work"
          ? t("tagWork")
          : tag === "personal"
            ? t("tagPersonal")
            : tag === "study"
              ? t("tagStudy")
              : t("tagOther");

      const badge = document.createElement("div");
      badge.className =
        "status-badge " +
        (task.status === "done" ? "status-done" : "status-doing");
      badge.textContent =
        task.status === "done" ? t("statusDone") : t("statusDoing");
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
      delBtn.title = t("alertDeleteConfirm");
      delBtn.textContent = "🗑";
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm(t("alertDeleteConfirm"))) return;
        tasks = tasks.filter((t) => t.id !== task.id);
        saveTasks();
        renderTasks();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(info);
      li.appendChild(priorityBadge);
      li.appendChild(tagBadge);
      li.appendChild(badge);
      li.appendChild(actions);
      return li;
    }

    function renderTasks() {
      if (!taskList) return;
      taskList.innerHTML = "";
      tasks.forEach((t) => taskList.appendChild(createTaskElement(t)));
      applyFilters();
      updateCounts();
    }

    function applyFilters() {
      const searchQ = (searchInput && searchInput.value.trim().toLowerCase()) || "";
      const tagQ = (tagFilter && tagFilter.value) || "all";

      document.querySelectorAll(".task-item").forEach((li) => {
        let show = true;

        // 搜索过滤
        if (searchQ) {
          const name = li.querySelector(".task-name").textContent.toLowerCase();
          show = show && name.includes(searchQ);
        }

        // 标签过滤
        if (tagQ !== "all") {
          const task = tasks.find((t) => t.id === li.dataset.id);
          show = show && task && task.tag === tagQ;
        }

        li.style.display = show ? "" : "none";
      });
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
          inputPriority.value = t.priority || "medium";
          inputTag.value = t.tag || "work";
        }
      } else {
        editingId = null;
        inputName.value = "";
        inputDate.value = new Date(Date.now() + 7 * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);
        inputStatus.value = "doing";
        inputPriority.value = "medium";
        inputTag.value = "work";
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
        const priority = inputPriority.value;
        const tag = inputTag.value;
        if (!name) {
          alert(t("alertNameRequired"));
          inputName.focus();
          return;
        }
        if (editingId) {
          const idx = tasks.findIndex((t) => t.id === editingId);
          if (idx !== -1) {
            tasks[idx].name = name;
            tasks[idx].date = date;
            tasks[idx].status = status;
            tasks[idx].priority = priority;
            tasks[idx].tag = tag;
          }
        } else {
          const task = { id: generateId(), name, date, status, priority, tag };
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

    if (newBtn)
      newBtn.addEventListener("click", function () {
        openModal("create");
      });
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (tagFilter) tagFilter.addEventListener("change", applyFilters);
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
      taskHeaderClear.title = t("alertClearConfirm");
      taskHeaderClear.addEventListener("click", function () {
        if (!confirm(t("alertClearConfirm"))) return;
        tasks = tasks.filter((t) => t.status !== "done");
        saveTasks();
        renderTasks();
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!tasks || tasks.length === 0) {
          alert(t("alertNoTask"));
          return;
        }
        const shareURL = URLCompressor.compressToURL(tasks);
        if (!shareURL) {
          alert(t("alertShareFail"));
          return;
        }

        const originalSize = JSON.stringify(tasks).length;
        const compressedSize = shareURL.length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        const msg = t("alertShareSuccess")
          .replace("{original}", originalSize)
          .replace("{compressed}", compressedSize)
          .replace("{ratio}", ratio);

        navigator.clipboard
          .writeText(shareURL)
          .then(() => alert(msg))
          .catch(() => {
            prompt(t("alertCopyFail"), shareURL);
          });
      });
    }

    // 导出功能
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (!tasks || tasks.length === 0) {
          alert(t("alertNoTask"));
          return;
        }

        const format = confirm(
          currentLang === "zh"
            ? "点击\"确定\"导出为 JSON 格式\n点击\"取消\"导出为 CSV 格式"
            : "Click \"OK\" to export as JSON\nClick \"Cancel\" to export as CSV",
        );

        if (format) {
          exportAsJSON();
        } else {
          exportAsCSV();
        }
      });
    }

    function exportAsJSON() {
      const dataStr = JSON.stringify(tasks, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function exportAsCSV() {
      const headers = ["Name", "Date", "Status", "Priority"];
      const rows = tasks.map((task) => [
        `"${task.name.replace(/"/g, '""')}"`,
        task.date,
        task.status === "done" ? t("statusDone") : t("statusDoing"),
        task.priority || "medium",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))]
        .join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // 键盘快捷键
    document.addEventListener("keydown", function (e) {
      // Ctrl+N: 新建任务
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        if (newBtn) newBtn.click();
      }

      // Ctrl+F: 聚焦搜索框
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }

      // Escape: 关闭模态框
      if (e.key === "Escape") {
        if (modalOverlay && modalOverlay.classList.contains("active")) {
          closeModal();
        }
      }

      // Ctrl+E: 导出
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault();
        if (exportBtn) exportBtn.click();
      }

      // Ctrl+Shift+S: 分享
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        if (shareBtn) shareBtn.click();
      }

      // Ctrl+D: 切换暗色模式
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        if (themeBtn) themeBtn.click();
      }
    });

    // 拖拽排序功能
    let draggedItem = null;

    function handleDragStart(e) {
      draggedItem = this;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", this.dataset.id);
      setTimeout(() => this.style.opacity = "0.5", 0);
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const target = e.target.closest(".task-item");
      if (target && target !== draggedItem) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          target.parentNode.insertBefore(draggedItem, target);
        } else {
          target.parentNode.insertBefore(draggedItem, target.nextSibling);
        }
      }
    }

    function handleDrop(e) {
      e.preventDefault();
      const target = e.target.closest(".task-item");
      if (target && target !== draggedItem) {
        // 更新 tasks 数组顺序
        const allItems = Array.from(taskList.querySelectorAll(".task-item"));
        const newOrder = allItems.map((item) => item.dataset.id);
        tasks.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
        saveTasks();
      }
    }

    function handleDragEnd() {
      this.style.opacity = "1";
      draggedItem = null;
    }

    // 初始化: 优先从 URL 恢复分享数据，否则从 localStorage 加载
    const sharedTasks = URLCompressor.decompressFromURL();
    if (sharedTasks && sharedTasks.length > 0) {
      tasks = sharedTasks;
      alert(t("alertRestore").replace("{count}", tasks.length));
    } else {
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
    }

    renderTasks();
  });
})();
