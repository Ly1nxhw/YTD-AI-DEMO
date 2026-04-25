# Glossary

## Observed

- [high] `Workspace`：产品的主数据边界。一个工作区包含 `workspace.json`、`prompts.json`、`providers.json`、`ui-settings.json`、`knowledge-base.json`、`memory/`、`stats/`、`backups/` 和 `exports/` (`README.md`, `electron/main.ts`)。
- [high] `Knowledge Base` / `Knowledge Entry`：以结构化 JSON 存储的可复用客服内容；条目包含 `category`、`title`、`keywords`、`content`、`scenario`，以及 `sourceType`、`qualityScore`、`reviewStatus` 等学习元数据 (`src/types/index.ts`, `README.md`)。
- [high] `Provider` / `LLM Provider`：工作区内配置的模型服务，类型可为 OpenAI-compatible、Ollama 或 custom，底层调用 `/chat/completions` (`src/types/index.ts`, `src/stores/settings-store.ts`, `src/lib/llm-adapter.ts`)。
- [high] `Step 0` / `Triage`：智能分流阶段，负责给出 `AUTO` 或 `HUMAN` 决策，同时返回翻译、识别语言、意图、关键词、匹配话术 ID 和可选策略 (`src/lib/llm-adapter.ts`, `src/agent/pipeline.ts`, `README.md`)。
- [high] `Step 1`：旧术语中的理解/匹配阶段；在当前 pipeline 代码中，这部分结果实际上已经并入 triage 输出 (`src/lib/llm-adapter.ts`, `src/agent/pipeline.ts`)。
- [high] `Step 2`：回复生成阶段，输出 `reply`、`chinese` 和 `unmatched` (`src/lib/llm-adapter.ts`, `src/types/index.ts`)。
- [high] `Step 3` / `Quality Check`：自动回复前的校验阶段，检查语言匹配、敏感措辞、疑似幻觉标识符、变量占位符状态、语气和内容是否为空 (`src/agent/quality-check.ts`, `docs/智能客服系统-技术方案.md`)。
- [high] `Pipeline Decision`：最终路由结果，取值为 `AUTO`、`HUMAN` 或 `QUALITY_FAIL` (`src/agent/pipeline.ts`, `src/types/index.ts`)。
- [high] `Memory`：工作区 `memory/` 下的 markdown 文件，如 `CONSTITUTION.md`、`SOUL.md`、`SKILLS.md`、`SCRIPTS_FEEDBACK.md`、`HEARTBEAT.md` 和 `daily/*.md`，由 context builder 读取并拼接进提示词 (`README.md`, `src/agent/memory-manager.ts`, `src/agent/context-builder.ts`)。
- [high] `Learning Session`：一次“从对话中学习话术”的处理记录，持久化到 `stats/learning-sessions.jsonl` (`README.md`, `src/types/index.ts`, `electron/main.ts`)。
- [medium] `Script`：代码和文档里用于表示“可复用客服回复模板/话术单元”的术语，最终以知识库条目形式存储，并在生成阶段被匹配和复用 (`src/lib/llm-adapter.ts`, `docs/智能客服系统-技术方案.md`)。

## Inferred

- [high] `Script`、知识库条目、回复模板在这个仓库里基本指向同一个业务对象，只是在不同层使用了不同叫法；当前并没有单独拆分成不同持久化模型 (`src/types/index.ts`, `src/lib/llm-adapter.ts`, `src/stores/knowledge-store.ts`)。
- [medium] `Daily log` 更像是供后续 LLM 上下文消费的运行记忆，而不是面向用户的正式审计日志 (`src/agent/memory-manager.ts`, `src/agent/context-builder.ts`)。
- [medium] `Workspace initializer` 指的是一个 LLM 辅助的初始化流程，根据业务画像为新工作区生成首批知识库条目 (`README.md`, `src/lib/llm-adapter.ts`)。

## Open Questions

- [medium] 仓库同时使用“知识库条目”和“话术”两套表达，但没有正式术语表说明何时优先使用哪一个。
- [low] Step 1 的用户可见命名可能正在演变，因为当前 pipeline 注释说它已并入 triage，而旧 prompt 命名仍保留 Step 1。
- [low] `reviewStatus` 与 `sourceType` 的完整生命周期含义，在当前代码里只能看到部分约束，尚未形成完整文档。
