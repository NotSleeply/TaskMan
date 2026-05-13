(function () {
  const STORAGE_KEY = "taskman.tasks";
  const SHARE_PARAM = "share";

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

        let statusCode = 0; // 0 代表 pending
        if (task.status === "doing") statusCode = 1;
        if (task.status === "done") statusCode = 2;

        allBytes.push(
          ...Encoding.varintEncode(
            Encoding.zigZagEncode(statusCode),
          ),
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
        let decodedStatus = "pending";
        if (statusCode === 1) decodedStatus = "doing";
        if (statusCode === 2) decodedStatus = "done";
        tasks.push({
          id: generateId() + "-shared",
          name,
          date: dateStr,
          status: decodedStatus,
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
    let currentFilter = "all"; // 当前筛选状态：all/pending/doing/done

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

      if (task.status === "done") {
        badge.className = "status-badge status-done";
        badge.textContent = "已完成";
      } else if (task.status === "doing") {
        badge.className = "status-badge status-doing";
        badge.textContent = "进行中";
      } else {
        badge.className = "status-badge status-pending";
        badge.textContent = "待办";
      }

      badge.style.cursor = "pointer";
      badge.addEventListener("click", function (e) {
        e.stopPropagation();
        if (task.status === "pending" || !task.status) {
          task.status = "doing";
        } else if (task.status === "doing") {
          task.status = "done";
        } else {
          task.status = "pending";
        }
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
        inputStatus.value = "pending";
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

      document.querySelectorAll(".task-item").forEach((li) => {
        const taskId = li.dataset.id;
        const task = tasks.find((t) => t.id === taskId);

        // 状态筛选
        let statusMatch = true;
        if (currentFilter !== "all" && task) {
          if (currentFilter === "pending") statusMatch = task.status === "pending" || !task.status;
          else if (currentFilter === "doing") statusMatch = task.status === "doing";
          else if (currentFilter === "done") statusMatch = task.status === "done";
        }

        // 搜索关键词匹配
        let searchMatch = true;
        if (q) {
          const name = li.querySelector(".task-name").textContent.toLowerCase();
          searchMatch = name.includes(q);
        }

        // 同时满足状态和搜索条件才显示
        li.style.display = (statusMatch && searchMatch) ? "" : "none";
      });
    }

    if (newBtn)
      newBtn.addEventListener("click", function () {
        openModal("create");
      });
    if (searchInput) searchInput.addEventListener("input", applySearchFilter);
    if (navItems && navItems.length)
      navItems.forEach((li, index) =>
        li.addEventListener("click", function () {
          navItems.forEach((n) => n.classList.remove("active"));
          this.classList.add("active");

          // 根据点击的导航项设置筛选状态
          const filterMap = ["all", "pending", "doing", "done"];
          currentFilter = filterMap[index] || "all";

          // 重新应用筛选
          applySearchFilter();
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

    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!tasks || tasks.length === 0) {
          alert("没有可分享的任务！请先创建一些任务。");
          return;
        }
        const shareURL = URLCompressor.compressToURL(tasks);
        if (!shareURL) {
          alert("分享失败：数据压缩出错");
          return;
        }

        const originalSize = JSON.stringify(tasks).length;
        const compressedSize = shareURL.length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        const msg =
          `✅ 分享链接已生成！\n\n` +
          `📊 压缩统计:\n` +
          `- 原始大小: ${originalSize} 字符\n` +
          `- 压缩后: ${compressedSize} 字符\n` +
          `- 压缩率: ${ratio}%\n\n` +
          `🔗 链接已复制到剪贴板，可直接发送给他人！`;

        navigator.clipboard
          .writeText(shareURL)
          .then(() => alert(msg))
          .catch(() => {
            prompt("请手动复制以下分享链接:", shareURL);
          });
      });
    }

    // 初始化: 优先从 URL 恢复分享数据，否则从 localStorage 加载
    const sharedTasks = URLCompressor.decompressFromURL();
    if (sharedTasks && sharedTasks.length > 0) {
      tasks = sharedTasks;
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
