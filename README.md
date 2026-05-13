# 🎮 TaskMan - 像素风格任务管理器

<table>
  <tr>
    <td><img src="public/桌面预览图.png" alt="桌面端预览" width="500"></td>
    <td><img src="public/移动预览图.png" alt="移动端预览" width="250"></td>
  </tr>
</table>

一个基于自定义二进制编码的无服务器任务管理工具，利用 **Varints + ZigZag** 算法将数据直接压缩进 URL，实现零依赖分享。

## ✨ 核心特性

### 🔗 **无服务器 URL 分享**

- 一键生成可分享的链接，无需数据库
- 接收方打开链接即可查看完整任务列表
- 数据完全存储在 URL 中，即发即用

### ⚡ **极致压缩算法**

| 算法                      | 用途             | 优势                       |
| ------------------------- | ---------------- | -------------------------- |
| **Varints**               | 可变长度整数编码 | 小数字仅占 1 字节          |
| **ZigZag**                | 有符号数编码     | 负数也能高效压缩           |
| **Base64URL**             | URL 安全编码     | 无特殊字符，可直接作为链接 |
| **RDP (Douglas-Peucker)** | 路径简化算法     | 保证流畅度同时减小体积     |

### 🎨 **复古像素 UI**

- 经典 Windows 95/98 视窗风格
- Press Start 2P + VT323 像素字体
- 完整的响应式适配

## 📖 使用指南

### 创建任务

1. 点击顶部 **"NEW TASK"** 按钮
2. 填写任务名称、截止日期、状态
3. 点击 **"保存"**

### 分享任务

1. 创建或编辑完任务后
2. 点击顶部 **"🔗 分享"** 按钮
3. 系统自动生成压缩链接并复制到剪贴板
4. 将链接发送给他人

### 恢复分享

1. 打开收到的分享链接
2. 页面自动检测并恢复所有任务
3. 可继续编辑或再次分享

---

## 🧠 技术架构

### 核心编码流程

```
原始任务数据 (JSON)
    ↓
Varints 编码 (变长整数)
    ↓
ZigZag 编码 (有符号数优化)
    ↓
UTF-8 序列化 (字符串→字节)
    ↓
Base64URL 编码 (URL安全)
    ↓
完整分享链接 (URL)
```

### 关键代码模块

#### 1️⃣ Varints 编解码 ([main.js:10-23](assets/main.js#L10-L23))

```javascript
// 将整数编码为 1-5 字节的变长序列
varintEncode(value) {
  // 每字节 7 位数据 + 1 位标志位
  // 小数字占用更少空间
}
```

#### 2️⃣ ZigZag 编解码 ([main.js:25-31](assets/main.js#L25-L31))

```javascript
// 将有符号数映射到无符号空间
zigZagEncode(n) {
  return (n << 1) ^ (n >> 31);
  // 0 → 0, -1 → 1, 1 → 2, -2 → 3, ...
}
```

#### 3️⃣ 任务序列化 ([main.js:33-96](assets/main.js#L33-L96))

```javascript
encodeTasks(tasks) {
  // [任务数量] [名称长度] [名称字节] [日期] [状态]
  // 紧凑的二进制格式，无冗余字段
}
```

#### 4️⃣ RDP 路径简化 ([main.js:98-134](assets/main.js#L98-L134))

```javascript
simplify(points, tolerance = 1) {
  // Douglas-Peucker 算法
  // 保留关键点，移除冗余点
}
```

#### 5️⃣ URL 压缩 ([main.js:136-248](assets/main.js#L136-L248))

```javascript
compressToURL(tasks) {
  const encoded = Serializer.encodeTasks(tasks);
  const compressed = this.bytesToBase64URL(encoded);
  return url.toString(); // 完整的分享链接
}
```

---

## 📊 性能指标

### 压缩效果对比

| 场景         | 原始大小 (JSON) | 压缩后 (URL) | 压缩率     |
| ------------ | --------------- | ------------ | ---------- |
| 5 个典型任务 | ~350 字符       | ~120 字符    | **65%** ✨ |
| 10 个任务    | ~700 字符       | ~220 字符    | **68%** ✨ |
| 20 个任务    | ~1400 字符      | ~400 字符    | **71%** ✨ |

## 🌐 浏览器兼容性

| 浏览器  | 版本要求 | 支持状态    |
| ------- | -------- | ----------- |
| Chrome  | 60+      | ✅ 完全支持 |
| Firefox | 55+      | ✅ 完全支持 |
| Safari  | 12+      | ✅ 完全支持 |
| Edge    | 79+      | ✅ 完全支持 |
| IE 11   | -        | ❌ 不支持   |

---

## 📝 开发说明

### 代码规范

- 使用 ES6+ 语法（箭头函数、解构、模板字符串）
- 函数式编程思想（纯函数、不可变数据）
- 详细的中文注释
- 统一的命名规范（camelCase）

### 架构设计

```bash
Encoding (编解码层)
  ├── varintEncode/Decode     # Varints 编解码
  ├── zigZagEncode/Decode     # ZigZag 编解码
  ├── stringToBytes           # UTF-8 编码
  └── bytesToString           # UTF-8 解码

Serializer (序列化层)
  ├── encodeTasks             # 任务→字节数组
  └── decodeTasks             # 字节数组→任务

RDPSimplifier (算法层)
  ├── perpendicularDistance   # 点到线距离
  └── simplify               # 路径简化

URLCompressor (应用层)
  ├── compressToURL          # 任务→URL
  └── decompressFromURL      # URL→任务
```

## 📄 许可证

**GPL-3.0 + 非商业使用限制 (NON-COMMERCIAL)** ⚠️

本软件采用 **GNU General Public License v3.0** 许可证，并附加 **严格的非商业使用限制条款**：

### 🔒 核心限制

- **❌ 禁止商业用途**：严禁将本软件用于任何商业目的（包括但不限于销售、盈利、商业产品集成等）
- **✅ 允许非商业用途**：个人学习、教育、研究、测试等非商业场景自由使用
- **⚖️ 商业授权**：如需商业使用，必须获得版权持有者的明确书面许可

### 详细条款

完整许可证内容请查看 [LICENSE](LICENSE) 文件，包括：

- GPLv3 完整条款（强制开源、代码共享）
- 非商业使用附加条款（§1-§6）
- 法律执行与违约责任说明

### 联系方式

如需商业授权或有疑问，请联系项目维护者。

---

## 📮 反馈与贡献

欢迎提交 Issue 和 Pull Request！

- 发现 Bug？请提 Issue
- 有新想法？欢迎讨论
- 代码改进？期待你的 PR
