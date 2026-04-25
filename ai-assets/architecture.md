# Architecture

## Observed

- [high] 当前运行边界是 Electron 桌面应用：渲染进程来自 `src/main.tsx` / `src/App.tsx`，主进程在 `electron/main.ts`，两者通过 `electron/preload.ts` 暴露的 bridge 通信 (`src/main.tsx`, `src/App.tsx`, `electron/main.ts`, `electron/preload.ts`)。
- [high] 渲染层是 React 19 应用，状态由 Zustand 管理，主要 store 包括 workspace、settings、knowledge-base 和 generation (`package.json`, `src/stores/workspace-store.ts`, `src/stores/settings-store.ts`, `src/stores/knowledge-store.ts`, `src/stores/generation-store.ts`)。
- [high] 主进程负责持久化和系统能力：工作区脚手架、原子写入、备份、导入导出、全局快捷键、剪贴板监听、LLM 代理请求，以及外部文件变更检测 (`electron/main.ts`)。
- [high] 工作区持久化基于文件系统：设置类文件使用 `version + updatedAt + data` 包装结构，统计使用 JSONL，记忆使用 markdown，知识库存为 JSON (`electron/main.ts`, `docs/本地优先_文件化工作区方案.md`)。
- [high] 回复处理链路在当前实现中跑在前端应用进程内：triage/match -> generation -> quality check -> 记录 daily log (`src/agent/pipeline.ts`, `src/lib/llm-adapter.ts`, `src/agent/quality-check.ts`, `src/agent/memory-manager.ts`)。
- [high] Triage 提示词上下文会动态拼装工作区记忆文件；`context-builder.ts` 会读取 constitution、soul、skills、scripts feedback 和 daily logs 再注入系统提示词 (`src/agent/context-builder.ts`, `src/agent/memory-manager.ts`)。
- [high] LLM 调用统一走 OpenAI-compatible `/chat/completions`，支持重试、超时、可选流式输出，并可通过 Electron IPC 代理绕过浏览器 CORS (`src/lib/llm-adapter.ts`, `electron/main.ts`)。
- [medium] 构建层使用 Vite 和 `vite-plugin-electron`，分别产出渲染端 `dist/` 和 Electron 端 `dist-electron/` (`vite.config.ts`, `package.json`)。
- [medium] 仓库中还存在一份未来态服务架构文档，包含 React/Tailwind 前端、Node.js 后端、PostgreSQL、Redis、Qdrant、队列和平台接入，但这些子系统并未出现在当前运行时代码中 (`docs/智能客服系统-技术方案.md`)。

## Inferred

- [high] Electron 主进程事实上承担了本地“仓储层/服务层”的角色；渲染层通过 `window.electronAPI` 把它当作本地 API 使用 (`electron/preload.ts`, `src/stores/*.ts`)。
- [high] 当前架构明显优先追求低基础设施复杂度：本地文件存储、工作区可迁移、可借助云盘同步，并且不依赖后端服务 (`README.md`, `docs/本地优先_文件化工作区方案.md`, `electron/main.ts`)。
- [medium] 当前代码大致可以分层为：
  UI 组件 -> Zustand stores -> agent/lib 业务辅助 -> Electron IPC bridge -> 文件系统与 OS 能力 (`src/components`, `src/stores`, `src/agent`, `src/lib`, `electron/*`)。
- [medium] “服务化智能客服系统”文档更适合视作路线图或备选目标架构，而不是当前模块边界的事实来源 (`docs/智能客服系统-技术方案.md`, `electron/main.ts`)。

## Open Questions

- [medium] 当前源码没有展示真正的外部平台发送环节；产品到底是继续“复制后人工发送”，还是计划转向自动发送，仓库里没有定论。
- [medium] 当前代码没有明确的架构决策记录，说明 pipeline 逻辑未来应继续留在渲染层还是迁移到本地/远端服务边界之后。
- [low] memory 子系统已经暗示未来可能需要摘要/蒸馏流程，但当前仓库里没有看到具体调度器或压缩器实现。
