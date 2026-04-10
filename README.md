# AI 客服辅助应答系统

基于 Electron + React 的桌面应用，采用智能分流 Agent 管线架构，帮助跨境电商客服快速生成多语言回复。

## 系统架构

```
客户消息 → 智能分流(Triage) → 话术匹配 → 回复生成 → 质检 → 输出
              ↓                    ↓           ↓
          AUTO/HUMAN           TF-IDF       双栏输出
          情绪/风险/复杂度     关键词匹配    外语 | 中文
```

## 功能特性

### 核心能力
- **智能分流 Agent**：Triage 层自动判断 AUTO（AI回复）/ HUMAN（升级人工），评估复杂度、情绪、风险
- **话术知识库**：Markdown 话术库解析，分类浏览、关键词搜索、增删改查
- **多语言支持**：自动检测客户消息语言，支持德语/英语/法语/西班牙语等 10+ 种语言
- **双栏输出**：外语回复 | 中文对照，中文可编辑并 Ctrl+Enter 重新翻译外语
- **质检管线**：自动检查语言匹配、敏感词、变量完整性、语气得体
- **多 LLM 提供商**：支持 OpenAI / DeepSeek / NVIDIA / Ollama 等，可配置多个并切换

### 效率工作流
- **剪贴板监听**：开启后复制客户消息自动填入输入框
- **全局快捷键**：`Ctrl+Shift+Q` 随时呼出窗口并读取剪贴板
- **窗口置顶 & 小窗模式**：与电商后台并排使用
- **透明度调节**：半透明悬浮在其他窗口上方

### 话术积累
- **智能保存话术**：未匹配场景一键保存为新话术，自动填充标题/分类/关键词
- **缺口提示**：状态栏显示话术库未覆盖的高频场景，引导补充
- **变量模板**：回复中 `{{变量}}` 自动识别，可视化填写面板

### 数据统计
- **使用统计面板**：今日处理量、匹配率、修改率、AUTO/HUMAN 比例
- **7 日趋势图**：直观查看工作量变化
- **高频意图排行**：了解最常见的客户问题类型

### 记忆系统
- **分层记忆**：CONSTITUTION（宪法）→ SOUL（风格）→ SKILLS（技能）→ 每日日志
- **上下文注入**：历史经验自动融入 Triage 和生成 Prompt

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端 | React 19 + TypeScript |
| UI | TailwindCSS + Lucide Icons |
| 构建 | Vite + electron-builder |
| 状态管理 | Zustand |
| 话术检索 | TF-IDF 关键词匹配 |
| LLM 通信 | Electron IPC Proxy + SSE 流式 |
| 记忆系统 | Markdown 文件分层存储 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（启动 Vite + Electron）
npm run dev

# 打包 Windows 可执行文件
npm run electron:build
```

## 使用说明

1. **配置 LLM**：点击右上角 ⚙️ 设置 → 添加 LLM 提供商 → 填写 API 地址/Key/模型 → 测试连接
2. **粘贴消息**：将客户外语消息粘贴到输入框（或开启底部「监听」自动捕获剪贴板）
3. **生成回复**：点击「生成回复」，系统自动分流→匹配→生成→质检
4. **审核修改**：双栏对比外语回复和中文翻译，可编辑中文后 Ctrl+Enter 重新翻译
5. **确认复制**：点击「确认并复制」→ 粘贴到电商平台
6. **积累话术**：未匹配时点击「保存为新话术」，话术库越用越全

## LLM 配置示例

| 服务商 | API 地址 | 模型 |
|--------|----------|------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| NVIDIA | `https://integrate.api.nvidia.com/v1` | `meta/llama-3.3-70b-instruct` |
| Ollama (本地) | `http://localhost:11434/v1` | `qwen2.5` |

## 项目结构

```
src/
├── agent/              # Agent 核心逻辑
│   ├── pipeline.ts     # 主管线（分流→匹配→生成→质检）
│   ├── context-builder.ts  # Triage Prompt 构建
│   ├── memory-manager.ts   # 分层记忆读写
│   ├── gap-tracker.ts      # 话术缺口追踪
│   └── stats-tracker.ts    # 使用统计
├── lib/
│   ├── llm-adapter.ts  # LLM 调用（支持多模型/流式/代理）
│   └── matcher.ts      # TF-IDF 话术匹配
├── stores/             # Zustand 状态管理
├── components/         # React UI 组件
└── types/              # TypeScript 类型定义
electron/
├── main.ts             # 主进程（IPC、剪贴板、快捷键）
└── preload.ts          # 预加载脚本
```
