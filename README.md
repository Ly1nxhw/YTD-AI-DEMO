# AI 客服辅助应答系统

基于 Electron + React 的桌面应用，采用两步 LLM 调用架构，帮助跨境电商客服快速生成多语言回复。

## 功能特性

- **两步 LLM 架构**：Step 1 理解层（翻译+意图+关键词）→ 本地话术匹配 → Step 2 生成层（多语言回复+中文对照）
- **话术知识库**：解析中文话术库，支持分类浏览、关键词搜索、一键复制、增删改
- **多语言支持**：自动检测客户消息语言，支持德语/英语/法语/西班牙语等 10+ 种语言
- **双栏输出**：外语回复 | 中文对照，客服审核确认后一键复制
- **LLM 可插拔**：支持 OpenAI / DeepSeek / Ollama 等兼容 OpenAI API 的服务
- **未匹配提示**：话术库无覆盖时黄色警告，支持一键将回复保存为新话术
- **窗口置顶**：方便与亚马逊后台并排使用

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端 | React 19 + TypeScript |
| UI | TailwindCSS |
| 构建 | Vite + electron-builder |
| 状态管理 | Zustand |
| 话术检索 | TF-IDF 关键词匹配 |
| LLM 通信 | fetch + SSE 流式 |

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

1. **配置 LLM**：点击右上角 ⚙️ 设置，填写 API 地址和 Key（推荐 DeepSeek）
2. **粘贴消息**：将客户外语消息粘贴到输入框
3. **生成回复**：点击「生成回复」，系统自动分析→匹配→生成
4. **审核复制**：在双栏区域对比外语回复和中文翻译，确认后点击「确认并复制」
5. **话术管理**：左侧话术库支持浏览、搜索、新增、编辑、删除

## LLM 配置示例

| 服务商 | API 地址 | 模型 |
|--------|----------|------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama (本地) | `http://localhost:11434/v1` | `qwen2.5` |
