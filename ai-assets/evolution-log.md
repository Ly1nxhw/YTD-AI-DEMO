# Evolution Log

## Observed

- [high] 日期为 `2026-04-09` 的设计文档描述了一个更大的演进方向：从“人工粘贴消息 -> AI 辅助生成回复 -> 手动复制发送”的 demo，升级为具备智能分流、后端服务、数据库和平台接入的自动应答系统 (`docs/智能客服系统-技术方案.md`)。
- [high] 日期为 `2026-04-16` 的设计文档则提出了另一条近程路线：保持本地优先，不引入后端和数据库，而是把产品正式升级为“工作区驱动的文件化桌面工具” (`docs/本地优先_文件化工作区方案.md`)。
- [high] README 明确说明项目已经从“安装包内置配置”迁移到“工作区文件化存储”，并把工作区、导入导出、备份、外部变更检测、学习记录和 memory 文件都写成当前能力 (`README.md`)。
- [high] 当前代码与“本地优先工作区方案”高度一致：`electron/main.ts` 已实现工作区脚手架、ZIP 导入导出、JSON/JSONL/markdown 持久化、备份快照和外部变更检测 (`electron/main.ts`)。
- [medium] 当前代码也已经超出“纯 demo”水平：triage、generation、quality check、memory-aware context、gap tracking 和 learning validation 都已落在 `src/agent/` 与 `src/lib/` (`src/agent/pipeline.ts`, `src/agent/context-builder.ts`, `src/lib/learning-validator.ts`)。

## Inferred

- [high] 仓库已经完成了一次关键演进：从“单体 demo + 内置数据”明显转向“可迁移工作区产品”，即便 README 里仍保留一些“正在演进”的叙述 (`README.md`, `docs/本地优先_文件化工作区方案.md`, `electron/main.ts`)。
- [medium] “服务化智能客服系统”更像远期目标或另一条部署路线，而当前已实现代码优先支持低基础设施成本的本地运行模式 (`docs/智能客服系统-技术方案.md`, `docs/本地优先_文件化工作区方案.md`)。
- [medium] 学习元数据、gap tracking 和 memory context 的出现，说明产品方向正在从“单次生成”转向“持续沉淀业务知识和复用资产” (`README.md`, `src/types/index.ts`, `src/agent/context-builder.ts`)。

## Open Questions

- [medium] 后续路线到底以哪个方向为准：继续深化 Electron 本地优先应用，还是迁移到后端/Web 架构，当前仓库没有唯一结论。
- [medium] 仓库里没有 changelog 或 ADR，无法精确还原工作区迁移、学习子系统和 memory 子系统分别是在什么节点加入的。
- [low] `2026-04-09` 文档里那些带时间表和完成标记的内容，不能直接视为“已经交付”，除非有对应源码或发布证据支撑。
