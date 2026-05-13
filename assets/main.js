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
          dateStr.length >= 10 ? parseInt(dateStr.replace(/-/g, ""), 10) : 0;
        allBytes.push(...Encoding.varintEncode(Encoding.zigZagEncode(dateNum)));

        let statusCode = 0; // 0 代表 pending
        if (task.status === "doing") statusCode = 1;
        if (task.status === "done") statusCode = 2;

        allBytes.push(
          ...Encoding.varintEncode(Encoding.zigZagEncode(statusCode)),
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
          dateStr =
            dateStr.slice(0, 4) +
            "-" +
            dateStr.slice(4, 6) +
            "-" +
            dateStr.slice(6, 8);
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
          Math.pow(point.x - lineStart.x, 2) +
            Math.pow(point.y - lineStart.y, 2),
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
    /**
     * 将字节数组转换为 URL 安全的 Base64 编码字符串
     * @param {number[]} bytes - 待编码的字节数组
     * @returns {string} URL 安全的 Base64 编码结果
     *
     * 转换步骤：
     * 1. 将每个字节转换为对应的 ASCII 字符，拼接成二进制字符串
     * 2. 使用 btoa() 进行标准 Base64 编码
     * 3. 将标准 Base64 的特殊字符替换为 URL 安全字符：
     *    - '+' → '-'
     *    - '/' → '_'
     * 4. 移除末尾的填充字符 '='（可选，减少 URL 长度）
     *
     * 注：此方法生成的 Base64URL 可直接作为 URL 参数传递，无需额外编码
     */
    bytesToBase64URL(bytes) {
      const binary = bytes.map((b) => String.fromCharCode(b)).join("");
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    },

    /**
     * 将 URL 安全的 Base64 编码字符串转换回字节数组
     * @param {string} str - URL 安全的 Base64 编码字符串
     * @returns {number[]} 解码后的字节数组
     *
     * 解码步骤：
     * 1. 将 URL 安全字符还原为标准 Base64 字符：
     *    - '-' → '+'
     *    - '_' → '/'
     * 2. 补充缺失的填充字符 '='，确保长度为 4 的倍数
     * 3. 使用 atob() 解码标准 Base64 字符串为二进制字符串
     * 4. 将二进制字符串的每个字符转换为对应的字节值（ASCII 码）
     *
     * 注：此方法是 bytesToBase64URL() 的逆向操作，用于解析分享链接中的任务数据
     */
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

    /**
     * 将任务数组压缩并生成可分享的 URL
     * @param {Array<Object>} tasks - 待分享的任务数组
     * @returns {string|null} 包含任务数据的分享 URL，失败返回 null
     *
     * 压缩流程：
     * 1. 使用 Serializer.encodeTasks() 将任务数组序列化为字节数组
     * 2. 使用 bytesToBase64URL() 将字节数组转换为 URL 安全的 Base64 字符串
     * 3. 创建当前页面的 URL 对象，移除原有查询参数
     * 4. 将压缩后的数据作为 share 参数添加到 URL 中
     * 5. 返回完整的分享 URL
     *
     * 错误处理：
     * - 若压缩过程中发生异常，输出错误日志并返回 null
     *
     * 使用示例：
     * const shareLink = URLCompressor.compressToURL(tasks);
     * // 返回: "https://example.com/taskman?share=abc123..."
     */
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

    /**
     * 从当前页面 URL 的 share 参数中解压任务数据
     * @returns {Array<Object>|null} 解析出的任务数组，失败或无数据返回 null
     *
     * 解压流程：
     * 1. 解析当前页面 URL 的查询参数
     * 2. 获取 share 参数的值（压缩后的任务数据）
     * 3. 若 share 参数为空，返回 null
     * 4. 使用 base64URLToBytes() 将 Base64URL 字符串解码为字节数组
     * 5. 使用 Serializer.decodeTasks() 将字节数组反序列化为任务数组
     *
     * 错误处理：
     * - 若 URL 中不存在 share 参数，返回 null
     * - 若解压过程中发生异常（如数据损坏、格式错误），输出错误日志并返回 null
     *
     * 使用示例：
     * const tasks = URLCompressor.decompressFromURL();
     * // 若 URL 为 "?share=abc123..."，返回任务数组；否则返回 null
     *
     * 注：此方法是 compressToURL() 的逆向操作，用于初始化时恢复分享的任务数据
     */
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
          if (currentFilter === "pending")
            statusMatch = task.status === "pending" || !task.status;
          else if (currentFilter === "doing")
            statusMatch = task.status === "doing";
          else if (currentFilter === "done")
            statusMatch = task.status === "done";
        }

        // 搜索关键词匹配
        let searchMatch = true;
        if (q) {
          const name = li.querySelector(".task-name").textContent.toLowerCase();
          searchMatch = name.includes(q);
        }

        // 同时满足状态和搜索条件才显示
        li.style.display = statusMatch && searchMatch ? "" : "none";
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
          `✅ 分享链接已生成！已保存到剪贴板中。\n\n` +
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
