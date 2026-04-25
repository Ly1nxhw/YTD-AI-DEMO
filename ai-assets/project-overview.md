# Project Overview

## Observed

- [high] 该仓库是一个基于 `Electron + React + TypeScript` 的本地优先桌面应用，用于跨境电商客服回复生成、知识库管理、工作区管理，以及从真实对话中学习话术 (`README.md`, `package.json`)。
- [high] 产品明确以“工作区”作为数据边界，而不是把业务数据打进安装包；每个工作区独立拥有 prompts、providers、knowledge base、memory、stats、backups 和 exports (`README.md`, `electron/main.ts`)。
- [high] 当前实现已经覆盖回复生成主链路、知识库 CRUD、工作区导入导出、工作区备份、外部文件变更检测、剪贴板监听、全局快捷键唤起，以及模型服务配置 (`README.md`, `src/App.tsx`, `electron/main.ts`, `electron/preload.ts`)。
- [high] 当前代码使用本地文件持久化核心状态，仓库中没有应用自身的后端服务、数据库客户端或 HTTP 服务器；持久化由 Electron IPC 加文件系统读写完成 (`electron/main.ts`, `src/stores/*.ts`, `package.json`)。
- [medium] 仓库同时包含两份前瞻性设计文档：一份是更大规模的“智能客服自动应答系统”方案，一份是“本地优先、文件化工作区”方案。README 与当前代码明显更贴近后者 (`docs/智能客服系统-技术方案.md`, `docs/本地优先_文件化工作区方案.md`, `README.md`, `electron/main.ts`)。

## Inferred

- [high] 当前产品更适合被理解为一个单用户、本地运行的客服工作台，而不是 SaaS 或多用户 Web 平台 (`README.md`, `docs/本地优先_文件化工作区方案.md`)。
- [high] 这个仓库一方面是可运行产品，另一方面也承载未来架构探索；其中“工作区驱动、文件化桌面应用”是已落地方向，而“后端/数据库/Web 化”仍主要停留在规划稿中 (`README.md`, `docs/智能客服系统-技术方案.md`, `electron/main.ts`)。
- [medium] 项目的核心业务价值不只是“生成一条回复”，而是通过知识库编辑、工作区初始化和对话学习，持续沉淀可复用的话术资产 (`README.md`, `src/lib/llm-adapter.ts`, `src/lib/learning-validator.ts`)。

## Open Questions

- [medium] 当前最优先的生产使用场景到底是：手工辅助回复、工作区初始化，还是对话转知识库学习，仓库中没有唯一答案。
- [medium] 应用是否仅面向内部操作人员使用，还是打算分发给外部团队/品牌，README 有暗示但没有正式发布策略说明。
- [low] 当前源码树里没有看到正在使用中的 feature plan；`.specify/` 下看到的主要是模板、工作流和扩展资产。
