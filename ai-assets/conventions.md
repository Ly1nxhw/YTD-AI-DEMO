# Conventions

## Observed

- [high] 项目使用 TypeScript，开启 `strict: true`，JSX 模式为 `react-jsx`，并使用 `@/*` 路径别名和 bundler 风格模块解析 (`tsconfig.json`, `vite.config.ts`)。
- [high] 前端状态管理统一使用 Zustand，而不是 Redux 或 Context 作为主状态边界 (`src/stores/*.ts`, `package.json`)。
- [high] 渲染层所有持久化读写都通过 `window.electronAPI` 走 IPC，文件路径和文件系统操作集中在 Electron 主进程维护 (`electron/preload.ts`, `src/stores/*.ts`, `electron/main.ts`)。
- [high] 工作区写操作优先采用原子替换：先写临时文件，再 `rename` 覆盖正式文件 (`electron/main.ts`)。
- [high] 设置类工作区文件使用 `version`、`updatedAt`、`data` 的 envelope 结构；统计用 JSONL；memory 用 markdown；knowledge base 支持 `deleted: true` 软删除 (`electron/main.ts`, `docs/本地优先_文件化工作区方案.md`, `src/stores/knowledge-store.ts`)。
- [high] 核心记忆文件 `CONSTITUTION.md` 在应用逻辑中被视为只读文件 (`electron/main.ts`, `src/agent/memory-manager.ts`)。
- [high] 设置、知识库、memory 变更前会自动创建工作区备份；自动备份有冷却时间并最多保留最近 20 份 (`electron/main.ts`, `docs/本地优先_文件化工作区方案.md`)。
- [high] 外部工作区变更由渲染层每 15 秒轮询一次，并在用户重载后显式 acknowledge 当前状态 (`src/App.tsx`, `electron/main.ts`)。
- [high] LLM 调用默认遵循 OpenAI-compatible `/chat/completions`，并带有重试/退避和 30 秒超时 (`src/lib/llm-adapter.ts`)。
- [medium] 默认 prompts 由代码控制。`settings-store.ts` 在加载时会把已存储 prompt 与 `DEFAULT_PROMPT_A` / `DEFAULT_PROMPT_B` 对齐，这意味着用户自行修改过的 prompt 可能在加载时被覆盖 (`src/stores/settings-store.ts`, `src/lib/llm-adapter.ts`)。
- [medium] `package.json` 只提供了 `dev`、`build`、`preview`、`electron:dev`、`electron:build`，没有看到 `test`、`lint` 或格式化脚本 (`package.json`)。
- [medium] `.gitignore` 排除了 `node_modules/`、`dist/`、`dist-electron/`、打包输出、日志、临时文件，以及根目录业务素材如 `客服素材.docx` 和 `客服回复.md` (`.gitignore`)。

## Inferred

- [high] 项目的工程风格明显偏向“workspace-first, local-file-first”：store 不应自己决定存储路径，业务数据应尽量保持可迁移、可备份 (`docs/本地优先_文件化工作区方案.md`, `electron/main.ts`, `src/stores/*.ts`)。
- [medium] 项目偏向通过轻量迁移/回填兼容旧数据，而不是通过破坏式升级硬切；代码里已经存在多处自动升级和旧格式兼容逻辑 (`electron/main.ts`, `src/stores/settings-store.ts`)。
- [medium] 当前质量保障更依赖运行时和人工验证，而不是自动化测试，因为仓库里没有发现测试命令或测试套件 (`package.json`, 仓库扫描 JSON)。

## Open Questions

- [medium] 仓库里没有显式的 lint/format 规范配置，除了 TypeScript 编译约束和当前已有代码风格之外，缺少更正式的静态规则。
- [medium] API Key 处理在本地优先方案文档中被标记为敏感问题，但当前实现的数据结构仍把 `apiKey` 放在工作区设置里；是否在导出/共享时剥离，还没有明确落地规则 (`src/types/index.ts`, `src/stores/settings-store.ts`, `docs/本地优先_文件化工作区方案.md`)。
- [low] 构建产物在日常开发中的提交/保留策略，除了 `.gitignore` 之外没有更细的团队约定文档。
