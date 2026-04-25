# Extraction Report

## 范围

- 已在仓库根目录执行 `.specify/extensions/ai-assets/scripts/powershell/extract-ai-assets.ps1 -Json`。
- 本次提取实际读取并引用的正式来源包括：
  `README.md`
  `AGENTS.md`
  `package.json`
  `.gitignore`
  `vite.config.ts`
  `tsconfig.json`
  `tailwind.config.js`
  `electron/main.ts`
  `electron/preload.ts`
  `src/main.tsx`
  `src/App.tsx`
  `src/types/index.ts`
  `src/stores/workspace-store.ts`
  `src/stores/settings-store.ts`
  `src/stores/knowledge-store.ts`
  `src/stores/generation-store.ts`
  `src/lib/llm-adapter.ts`
  `src/lib/learning-validator.ts`
  `src/agent/pipeline.ts`
  `src/agent/context-builder.ts`
  `src/agent/quality-check.ts`
  `src/agent/memory-manager.ts`
  `docs/智能客服系统-技术方案.md`
  `docs/本地优先_文件化工作区方案.md`
  `.specify/workflows/speckit/workflow.yml`

## 高置信结论

- [high] 当前仓库实现的是一个本地优先、基于 Electron 的桌面应用，核心数据按工作区文件化存储。
- [high] 当前运行时的主要 source of truth 是 `electron/` 和 `src/`，而不是 `dist/`。
- [high] 工作区可迁移、备份、导入导出和外部变更检测是当前产品的一等能力。
- [high] 当前应用内部已经实现了 LLM pipeline，包括 triage、generation、quality check、memory context 和学习相关辅助逻辑。
- [high] 仓库同时存在未来态规划文档，不能把这些规划稿直接当成现有运行时架构事实。

## 低置信区域与限制

- [medium] 扫描脚本返回的 `entrypoints` 被 `node_modules/` 污染，因此那部分结果没有被当作架构依据使用。
- [medium] `.specify/memory/constitution.md` 目前仍是占位模板，没有被视为项目正式宪章。
- [medium] 本次没有发现正在使用中的 feature 级 Spec Kit plan/spec/tasks 文档；看到的主要是模板和工作流。
- [low] 终端直接读取部分中文文件时出现过编码噪音，因此关键中文文档已额外通过 UTF-8 方式复核后再使用。

## 需要人工补充确认的缺口

- [medium] 需要确认当前权威路线图是哪一条：继续深化本地优先 Electron 应用，还是推进后端/Web 化迁移。
- [medium] 需要明确当前发布/验证策略，因为仓库里没有发现自动化测试或 lint 脚本。
- [medium] 需要明确 API Key 在工作区导出、共享和机器本地保存之间的边界规则。

## 对 `speckit.plan` 的建议输入顺序

- 优先读取 `ai-assets/glossary.md`，先稳定术语。
- 再读取 `ai-assets/repo-map.md` 与 `ai-assets/architecture.md`，避免对目录结构和模块边界做错假设。
- 接着读取 `ai-assets/conventions.md`，再规划存储、迁移、备份和测试相关工作。
- 如 `ai-assets/` 与代码、配置、正式文档冲突，始终以后者为准。
