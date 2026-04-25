# Repo Map

## Observed

- [high] 顶层主要源码/文档目录是 `electron/`、`src/`、`docs/`、`.specify/` 和 `.agents/` (`rg --files`, 仓库扫描 JSON)。
- [high] 应用入口文件主要包括 `package.json`、`vite.config.ts`、`electron/main.ts`、`electron/preload.ts`、`src/main.tsx` 和 `src/App.tsx` (`package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`)。
- [high] `electron/` 是桌面宿主层：
  `electron/main.ts` 负责工作区文件、IPC、备份、导入导出、剪贴板/快捷键和 LLM 代理。
  `electron/preload.ts` 负责向渲染层暴露 `window.electronAPI`。
- [high] `src/components/` 存放主要 UI 面板，如 `MainPanel.tsx`、`SettingsPanel.tsx`、`StatsPanel.tsx`、`ConversationLearner.tsx` 和 `WorkspaceInitializer.tsx` (`src/components/*`)。
- [high] `src/stores/` 是 Zustand 状态边界：
  `workspace-store.ts`、`settings-store.ts`、`knowledge-store.ts` 和 `generation-store.ts` (`src/stores/*`)。
- [high] `src/lib/` 存放可复用业务辅助逻辑，包括 LLM 调用、markdown 解析、变量填充、学习校验、TF-IDF 和知识合并 (`src/lib/*`)。
- [high] `src/agent/` 存放更偏流程编排的逻辑与记忆/统计辅助，如 `pipeline.ts`、`context-builder.ts`、`quality-check.ts`、`memory-manager.ts`、`gap-tracker.ts` 和 `stats-tracker.ts` (`src/agent/*`)。
- [high] `docs/` 保存项目级方案/设计文档，而不是运行时代码 (`docs/智能客服系统-技术方案.md`, `docs/本地优先_文件化工作区方案.md`)。
- [high] `.specify/` 保存 Spec Kit 工作流、模板、memory，以及打包进仓库的 `ai-assets` 扩展脚本和模板 (`.specify/workflows/speckit/workflow.yml`, `.specify/extensions/ai-assets/*`)。
- [medium] `dist/` 和 `dist-electron/` 是构建产物，且被 `.gitignore` 忽略 (`.gitignore`)。
- [medium] `node_modules/` 在本地存在，并污染了扫描脚本的 `entrypoints` 输出，因此不能把那部分结果当作项目源码依据 (`.gitignore`, 仓库扫描 JSON)。
- [low] 本次提取没有找到模板之外的实际 feature plan/spec/tasks 文件；唯一命中的 `plan.md` 是 `.specify/extensions/ai-assets/templates/commands/plan.md`。

## Inferred

- [high] 当前行为的事实来源应优先看 `electron/main.ts` 与 `src/` 树，而不是 `dist/` 目录中的打包输出 (`electron/main.ts`, `src/*`, `.gitignore`)。
- [medium] `.specify/` 是规划/规范化工作流基础设施，不是运行时应用本身。
- [medium] `docs/智能客服系统-技术方案.md` 更像未来系统蓝图，而 `docs/本地优先_文件化工作区方案.md` 与当前仓库结构和文件布局更一致。

## Open Questions

- [medium] 如果后续 feature 工作要按 Spec Kit 流程落盘，仓库里实际的 spec/plan/tasks 应该放在哪个目录？当前没有现成样例。
- [low] 当前仓库没有显式的 `tests/` 或独立 `scripts/` 目录。
- [low] 工作区里保留 `dist/` 构建产物可能只是本地构建状态，也可能是手工打包流程的一部分；从仓库策略看，它们并不是源码真相。
