# H5 游戏管理器

> 桌面端 H5 游戏可视化管理工具 — 支持导入游戏压缩包、自动识别入口

---

## 1. 项目介绍

一个用 Python 编写、通过 WebView2 桌面窗口运行的可视化管理工具，用来统一管理 HTML5 游戏项目。支持导入 ZIP/压缩包自动解压识别、分类管理、导入导出等功能。本程序参考了飞牛上的轻游戏项目，本人突发奇想想做一个类似的，于是有了这么一个东西。

### 核心功能

| 功能 | 说明 |
|------|------|
| 游戏包导入 | 上传 .zip / .tar.gz 游戏压缩包，自动解压并识别入口文件（index.html） |
| 本地运行 | 导入的游戏本地托管，一键在浏览器中打开运行 |
| 游戏管理 | 添加/编辑/删除游戏，上传图标，设置分类、状态、精选 |
| 分类管理 | 创建分类，自定义图标和排序 |
| 用户管理 | 管理管理员账号，区分超级管理员/普通管理员 |
| 系统设置 | 应用名称、深色/浅色主题、分页设置 |
| 数据迁移 | JSON 格式批量导入导出 |
| 打包 EXE | PyInstaller 打包为单一 .exe 文件 |

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 超级管理员 |

---

## 2. 快速开始

### 环境要求

- Windows 10 或更新（自带的 Edge WebView2 即可）
- Python 3.8+

### 安装运行

```bash
cd h5-game-manager
pip install -r requirements.txt
python main.py
```

应用会以桌面窗口形式打开，无需浏览器。

### 打包为 EXE

```bash
pip install pyinstaller
python build.py build
```

生成的 `H5GameManager.exe` 在 `dist/` 目录下，可以直接分发给用户使用。

---

## 3. 使用指南

### 登录

启动后输入默认账号密码登录。

### 添加游戏（URL 模式）

1. 点击「游戏管理」→「+ 添加游戏」
2. 游戏来源选择「URL 地址」
3. 填写标题、游戏 URL、描述，选择分类
4. 可上传图标（建议 256×256 PNG）
5. 点击保存

### 添加游戏（压缩包导入）

1. 点击「游戏管理」→「+ 添加游戏」
2. 游戏来源选择「上传游戏包」
3. 点击上传区域，选择一个 `.zip` / `.tar.gz` / `.tgz` 格式的 H5 游戏压缩包
4. 系统自动解压并识别入口文件（优先 `index.html`）
5. 填写标题、分类等信息
6. 点击保存

> 游戏包中必须包含 HTML 入口文件（如 index.html、game.html），系统会递归搜索所有目录。

### 运行游戏

在游戏卡片上，鼠标悬停点击 ▶ 按钮，游戏会在系统默认浏览器中打开。本地导入的游戏通过 Flask 本地托管，无需联网。

### 编辑/删除

鼠标悬停在游戏卡片上，点铅笔编辑或垃圾桶删除。删除本地游戏包会同时清除解压文件。

---

## 4. 技术原理

### 整体架构

```
┌──────────────────────────────────────────────────┐
│ main.py                                           │
│   │                                               │
│   ├─ Thread → Flask API (127.0.0.1:随机端口)      │
│   │     ├─ /api/auth/*         JWT 认证            │
│   │     ├─ /api/games/*        游戏 CRUD + 包导入   │
│   │     ├─ /api/categories/*   分类管理             │
│   │     ├─ /api/admin/users/*  用户管理             │
│   │     ├─ /api/dashboard/*    统计数据             │
│   │     ├─ /api/public/*       系统设置             │
│   │     ├─ /uploads/*          图标文件             │
│   │     └─ /games/<slug>/*     本地游戏文件         │
│   │                                               │
│   └─ Eel → Edge WebView2 桌面窗口                  │
│         └─ web/index.html (SPA 前端)               │
└──────────────────────────────────────────────────┘
```

### 压缩包导入流程

```
用户上传 game.zip
  │
  ├─ 1. 接收 multipart/form-data (package 字段)
  ├─ 2. 判断格式: .zip → zipfile / .tar.gz → tarfile
  ├─ 3. 解压到 games/<slug>/ 目录
  ├─ 4. 递归扫描入口文件:
  │      index.html > game.html > main.html > *.html
  ├─ 5. 返回文件列表和入口路径
  ├─ 6. Flask 路由 /games/<slug>/<path> 提供文件服务
  └─ 7. 点击运行时: 打开 http://127.0.0.1:PORT/games/<slug>/index.html
```

### 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面框架 | Eel + Edge WebView2 | 系统内置，无需额外运行时 |
| 后端 | Flask | REST API + 静态文件服务 |
| 数据库 | SQLite (WAL) | 单文件零配置 |
| 认证 | JWT + bcrypt | 无状态 token + 密码哈希 |
| 前端 | 原生 JS + Bootstrap 5 CDN | 无需 npm/构建链 |
| 打包 | PyInstaller --onefile | 单 .exe 分发 |
| 解压 | zipfile + tarfile | Python 标准库，无需额外依赖 |

### 数据库表

- **users** — 管理员账号（bcrypt 密码）
- **categories** — 游戏分类（名称/标识/图标/排序）
- **games** — 游戏记录（标题/URL/图标/分类/状态/是否本地包）
- **play_records** — 游玩记录
- **settings** — 键值对配置

---

## 5. 项目结构

```
h5-game-manager/
├── main.py              # 入口：启动 Flask + Eel 桌面窗口
├── app.py               # Flask 应用工厂 (蓝图/CORS/错误处理)
├── database.py          # SQLite 建表 + 种子数据 + 迁移
├── auth.py              # JWT 认证 + 权限装饰器
├── build.py             # PyInstaller 打包脚本
├── requirements.txt     # 依赖清单
├── routes/
│   ├── games.py         # 游戏 CRUD + 压缩包导入 + 文件服务
│   ├── categories.py    # 分类 CRUD
│   ├── users.py         # 用户 CRUD
│   ├── dashboard.py     # 统计聚合
│   └── public.py        # 系统设置接口
├── web/                 # 前端 SPA
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js       # fetch 封装 + JWT 注入
│       ├── app.js       # 路由/认证/全局工具
│       └── pages/       # 6 个页面模块
├── games/               # 导入的游戏包解压目录
├── uploads/icons/       # 游戏图标存储
└── data/games.db        # SQLite 数据库 (自动创建)
```

## 6. H5小游戏源码
这个本人不能提供，毕竟涉及版权问题，请使用者自行寻找，并尊重作者。   
## 7. 效果展示   
<img width="1274" height="723" alt="屏幕截图 2026-06-23 182234" src="https://github.com/user-attachments/assets/90b98b16-32e4-4b35-a432-63f990f57e57" />
