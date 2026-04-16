# AI 客服助手

基于 `Electron + React + TypeScript` 的本地优先桌面应用，用于跨境电商客服回复生成、话术沉淀、工作区管理和知识库迭代。

## 当前定位

- 本地优先：LLM 配置、Prompt、知识库、记忆文件、统计数据都归属于工作区。
- 工作区隔离：不同品牌、店铺、产品线可分别维护，支持新建、切换、导入、导出、备份、恢复。
- AI 辅助：支持客服回复生成、工作区初始化、从对话学习话术。
- 可打包交付：打包后的程序不再内置业务话术库和 LLM 配置，首次使用从工作区开始。

## 核心功能

- 工作区管理
  - 首次启动选择或创建工作区
  - 导入 / 导出工作区 ZIP
  - 工作区备份、恢复、外部改动检测
- LLM 配置
  - 支持 OpenAI-compatible 服务
  - 支持多 Provider 切换
  - 支持 Step 1 / Step 2 模型覆写
- 回复生成
  - 剪贴板监听
  - 全局快捷键唤起
  - 意图分析、话术匹配、回复生成、质检
- 知识库
  - 结构化知识库存储
  - 分类、搜索、增删改
  - 工作区初始化生成首批通用话术
- 从对话学习话术
  - 从客服对话中抽取候选话术
  - 自动质量校验与风险提示
  - 与现有知识库做相似度比对
  - 支持新建 / 更新已有 / 忽略
  - 持久化学习记录到工作区

## 目录结构

```text
electron/
  main.ts                Electron 主进程，负责 IPC、工作区文件读写、导入导出、备份恢复
  preload.ts             渲染进程桥接

src/
  components/            主要界面组件
  stores/                Zustand 状态管理
  lib/                   LLM、学习校验、知识合并等基础能力
  agent/                 回复生成与记忆注入逻辑
  types/                 类型定义

docs/
  智能客服系统-技术方案.md
  本地优先_文件化工作区方案.md
```

## 开发命令

```bash
npm install
npm run dev
npm run electron:build
```

说明：

- `npm run dev`：启动前端开发环境。
- `npm run electron:build`：构建前端、Electron 主进程和预加载脚本，并打包 Windows 安装产物。

## 工作区数据说明

每个工作区会包含以下核心文件：

- `workspace.json`
- `prompts.json`
- `providers.json`
- `ui-settings.json`
- `knowledge-base.json`
- `memory/`
- `stats/`
  - `sessions.jsonl`
  - `learning-sessions.jsonl`
- `backups/`
- `exports/`

这些文件一起构成一个可迁移、可备份、可导入导出的工作区。

## 仓库约定

- `docs/` 下保留项目方案文档。
- 根目录业务素材、临时导出文件、打包产物不提交到 Git。
- 如需维护示例素材，建议统一放到单独的 `examples/` 或 `fixtures/` 目录，并明确用途。
