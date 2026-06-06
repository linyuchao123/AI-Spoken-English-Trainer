# AI英语口语陪练 (AI Spoken English Trainer)

> 一款基于 AI 的英语口语练习工具，支持多种真实场景下的对话训练、实时发音评测、语法纠错和课后量化学习报告。

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 项目简介

AI英语口语陪练是一个面向英语学习者的智能口语练习平台。用户可以在**职场面试、餐厅点餐、商务会议**三个真实场景中与AI进行实时英语对话，获得即时的发音评分、语法纠正和课后量化报告，实现口语能力的可量化提升。

### 核心功能

| 功能 | 说明 |
|------|------|
| **场景选择** | 3个真实场景（职场面试 / 餐厅点餐 / 商务会议），每个场景配有专属AI人设 |
| **难度档位** | 每个场景支持初级/中级/高级3个难度，AI对话内容随难度自适应调整 |
| **实时语音对话** | 浏览器麦克风收音，流式语音识别，端到端低延迟语音交互 |
| **发音评测打分** | 基于Azure发音评测API，输出0-100分，标注准确度/流利度/完整度 |
| **语法纠错** | 自动检测语法/用词/句式错误，展示原句+优化句+错误解释 |
| **课后量化报告** | 一键生成可视化学习报告（发音趋势图、错误分布饼图、提升建议） |
| **双模型支持** | 支持OpenAI GPT-4o和DeepSeek双模型自由切换 |

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | **Next.js 14** + TypeScript + Tailwind CSS | React 全栈框架，App Router 路由 |
| UI 组件库 | **Shadcn/ui** + Lucide Icons | 可定制 React 组件 |
| 状态管理 | **Zustand** | 轻量级全局状态管理 |
| 后端框架 | **FastAPI** + Uvicorn | Python 异步 Web 框架 |
| 认证 | **JWT** HTTP-only Cookie | 无状态身份认证 |
| 数据库 | **SQLite** | 本地轻量数据库 |
| 语音识别 (ASR) | **OpenAI Whisper API** | 英文语音转文字 |
| 大语言模型 (LLM) | **OpenAI GPT-4o / DeepSeek** | 场景化英文对话 |
| 发音评测 | **Azure Pronunciation Assessment** | 音素级发音评分 |
| 语音合成 (TTS) | **OpenAI TTS / Azure Speech TTS** | 文本转语音输出 |
| 数据可视化 | **Plotly / Recharts** | 交互式图表 |

---

## 项目结构

```
AI-Spoken-English-Trainer/
├── backend/                    # FastAPI 后端
│   ├── main.py                 # FastAPI 主入口
│   ├── api/
│   │   ├── auth.py             # 认证接口
│   │   ├── scenes.py           # 场景配置接口
│   │   └── sessions.py         # 会话管理接口
│   ├── core/
│   │   └── auth.py             # JWT 认证核心
│   └── models/
│       └── schemas.py          # Pydantic 数据模型
├── frontend/                   # Next.js 前端
│   └── src/
│       ├── app/                # App Router 页面
│       │   ├── (auth)/         # 登录/注册
│       │   └── (main)/         # 主应用（练习/历史/报告等）
│       ├── components/         # Navbar, Sidebar
│       ├── lib/api.ts          # Axios API 客户端
│       └── stores/             # Zustand 状态管理
├── config/
│   ├── settings.py             # 全局配置与API密钥管理
│   └── prompts.py              # 9套场景×难度 Prompt 模板
├── utils/
│   └── db.py                   # SQLite数据库操作
├── data/                       # 数据库文件目录
├── requirements.txt            # Python依赖
├── .env.example                # 环境变量模板
└── README.md
```

---

## 快速开始

### 1. 环境要求

- Python 3.10+ (后端)
- Node.js 18+ (前端)
- npm 或 pnpm (前端包管理器)
- 麦克风设备（用于语音输入）

### 2. 安装依赖

```bash
git clone <repository-url>
cd AI-Spoken-English-Trainer

# === 后端 ===
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# === 前端 ===
cd frontend
npm install
cd ..
```

### 3. 配置API密钥

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的API密钥
```

需要申请以下API服务：

| API服务 | 用途 | 申请地址 | 费用 |
|---------|------|---------|------|
| OpenAI API Key | GPT-4o对话 + Whisper转写 + TTS | [platform.openai.com](https://platform.openai.com) | 按量付费 |
| DeepSeek API Key | 备选对话模型 | [platform.deepseek.com](https://platform.deepseek.com) | 极低 |
| Azure Speech | 发音评测 + 备选TTS | [portal.azure.com](https://portal.azure.com) | 每月5小时免费 |

### 4. 启动应用

```bash
# 终端1：启动后端
uvicorn backend.main:app --reload --port 8000

# 终端2：启动前端
cd frontend
npm run dev
```

启动后：
- 后端 API：http://localhost:8000
- 前端页面：http://localhost:3000

---

## 使用指南

### 基本流程

1. **选择场景**：在左侧边栏选择练习场景（职场面试/餐厅点餐/商务会议）
2. **选择难度**：根据你的英语水平选择初级/中级/高级
3. **选择模型**：选择 OpenAI GPT-4o 或 DeepSeek
4. **新建会话**：点击「新建会话」按钮开始练习
5. **开始对话**：点击麦克风按钮说话，或使用文本输入框
6. **查看反馈**：每轮对话后自动显示发音评分和语法纠错
7. **生成报告**：点击「生成课后报告」查看完整学习分析

### 场景说明

- **职场面试**：模拟英文工作面试，AI扮演HR面试官
- **餐厅点餐**：模拟英文餐厅点餐，AI扮演服务员
- **商务会议**：模拟英文商务会议，AI扮演会议主持人

### 难度档位

- **初级**：基础词汇，慢速对话，耐心引导，适合A1-A2水平
- **中级**：中等词汇，自然语速，适当挑战，适合B1-B2水平
- **高级**：高级词汇，母语语速，深度讨论，适合C1+水平

---

## 开发计划

本项目为72小时竞赛开发项目，分3个PR完成：

| PR | 日期 | 内容 | 状态 |
|----|------|------|------|
| PR1 | 6.5 | 项目初始化、Next.js+FastAPI架构搭建、认证系统、数据库设计 | ✅ 已完成 |
| PR2 | 6.6 | 核心语音交互：LLM对话引擎+语法纠错+ASR转写+TTS合成 | 🔜 待开始 |
| PR3 | 6.7 | 发音评测接入、报告生成、前端数据对接与UI优化 | 🔜 待开始 |

---

## 开源库引用

| 库名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| fastapi | >=0.111.0 | Web API 框架 | MIT |
| uvicorn | >=0.30.0 | ASGI 服务器 | BSD-3 |
| PyJWT | >=2.8.0 | JWT 令牌管理 | MIT |
| openai | >=1.12.0 | OpenAI API 客户端 | Apache 2.0 |
| azure-cognitiveservices-speech | >=1.35.0 | Azure 语音服务 | MIT |
| python-dotenv | >=1.0.0 | 环境变量管理 | BSD-3 |
| plotly | >=5.18.0 | 数据可视化 | MIT |
| pandas | >=2.1.0 | 数据处理 | BSD-3 |
| pydantic | >=2.0 | 数据验证 | MIT |
| next | 14.x | React 前端框架 | MIT |
| react | 18.x | UI 库 | MIT |
| tailwindcss | 3.x | CSS 框架 | MIT |
| zustand | 4.x | 状态管理 | MIT |
| axios | 1.x | HTTP 客户端 | MIT |
| lucide-react | 0.x | 图标库 | ISC |

---

## 第三方API引用

| API服务 | 用途 |
|---------|------|
| OpenAI API | GPT-4o对话模型、Whisper语音识别、TTS语音合成 |
| DeepSeek API | 备选对话模型 |
| Azure Speech Services | 发音评测（Pronunciation Assessment）、备选TTS |

---

## 许可证

本项目采用 MIT 许可证。

---

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。
