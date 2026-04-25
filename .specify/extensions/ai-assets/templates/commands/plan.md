---
description: 使用实施计划模板生成技术设计与实施计划，并显式消费 ai-assets。
handoffs:
  - label: 生成任务清单
    agent: speckit.tasks
    prompt: 请把这份计划拆解成可执行任务
    send: true
  - label: 生成质量检查清单
    agent: speckit.checklist
    prompt: 请基于以下领域生成检查清单...
scripts:
  sh: scripts/bash/setup-plan.sh --json
  ps: scripts/powershell/setup-plan.ps1 -Json
---

## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（规划之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_plan` 下的条目
- 如果 YAML 无法解析或无效，静默跳过钩子检查并正常继续
- 过滤掉 `enabled` 明确为 `false` 的钩子；未声明 `enabled` 视为启用
- 对其余钩子，不要解释或求值 `condition`
  - 没有 `condition`，或其值为 null/空字符串时，视为可执行
  - 若存在非空 `condition`，跳过该钩子，把条件判断交给 HookExecutor
- 对每个可执行钩子，按 `optional` 输出：
  - **可选钩子**（`optional: true`）：
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **强制钩子**（`optional: false`）：
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- 如果未注册任何钩子，或 `.specify/extensions.yml` 不存在，则静默跳过

## 执行纲要

1. **初始化**：在仓库根目录运行 `{SCRIPT}`，解析返回 JSON 中的 `FEATURE_SPEC`、`IMPL_PLAN`、`SPECS_DIR`、`BRANCH`。如果参数里包含单引号（例如 `I'm Groot`），使用正确转义。

2. **加载上下文**：读取 `FEATURE_SPEC` 与 `.specify/memory/constitution.md`，并加载已经复制好的 `IMPL_PLAN` 模板。

3. **显式消费 ai-assets**：在开始规划前，优先读取以下资产文件（若存在）：
   - `ai-assets/glossary.md`
   - `ai-assets/repo-map.md`
   - `ai-assets/architecture.md`
   - `ai-assets/conventions.md`
   - 可选补充：`ai-assets/project-overview.md`、`ai-assets/evolution-log.md`、`ai-assets/extraction-report.md`
   - 读取后必须执行以下约束：
     - 用 `glossary.md` 稳定术语，不要在 plan 中随意改写项目专用名词
     - 用 `repo-map.md` 和 `architecture.md` 校正目录结构、模块边界、入口假设
     - 用 `conventions.md` 补充代码风格、流程规则、测试约定和隐性规定
     - 如果 ai-assets 与代码、配置、宪章、规格冲突，始终以后者为准，并在计划中显式记录冲突

4. **执行规划流程**：严格按照 `IMPL_PLAN` 模板结构完成：
   - 填写“技术上下文”（未知项标记为 `NEEDS CLARIFICATION`）
   - 在 `AI Assets 输入` 章节中记录本次消费了哪些资产，以及哪些结论来自资产校正
   - 根据宪章填写“宪章校验”
   - 先执行门禁判断，如存在无法接受的违规则直接报错
   - Phase 0：生成 `research.md`，解决所有 `NEEDS CLARIFICATION`
   - Phase 1：生成 `data-model.md`、`contracts/`、`quickstart.md`
   - Phase 1：运行代理上下文更新脚本
   - Phase 1 结束后再次复核“宪章校验”

5. **停止并汇报**：命令在 Phase 2 规划完成后结束，向用户报告当前分支、`IMPL_PLAN` 路径和生成产物。

6. **检查扩展钩子（规划之后）**：
   - 如果 `.specify/extensions.yml` 存在，读取 `hooks.after_plan`
   - YAML 无法解析时静默跳过
   - 过滤 `enabled: false`
   - 不要解释或求值 `condition`
   - 对每个可执行钩子，按 `optional` 输出：
     - **可选钩子**：
       ```
       ## Extension Hooks

       **Optional Hook**: {extension}
       Command: `/{command}`
       Description: {description}

       Prompt: {prompt}
       To execute: `/{command}`
       ```
     - **强制钩子**：
       ```
       ## Extension Hooks

       **Automatic Hook**: {extension}
       Executing: `/{command}`
       EXECUTE_COMMAND: {command}
       ```
   - 如果没有钩子或文件不存在，则静默跳过

## 各阶段说明

### Phase 0：梳理与研究

1. 从“技术上下文”中提取所有未知项：
   - 每个 `NEEDS CLARIFICATION` -> 一个研究任务
   - 每个依赖 -> 一个最佳实践任务
   - 每个集成点 -> 一个模式研究任务

2. **生成并派发研究任务**：

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. 将研究结论汇总到 `research.md`，格式为：
   - Decision: [选择了什么]
   - Rationale: [为什么这样选]
   - Alternatives considered: [评估过哪些方案]

**输出**：`research.md`，并且所有 `NEEDS CLARIFICATION` 都应得到解决

### Phase 1：设计与契约

**前置条件**：`research.md` 已完成

1. 根据功能规格提取实体，生成 `data-model.md`：
   - 实体名称、字段、关系
   - 来自需求的校验规则
   - 如适用，补充状态流转

2. 定义接口契约（若项目存在对外接口），输出到 `contracts/`：
   - 识别对外暴露给用户或其他系统的接口
   - 采用适合该项目类型的契约形式
   - 例如：库的公共 API、CLI 参数约定、Web 服务端点、解析器 grammar、UI 契约等
   - 若项目纯内部使用，可跳过

3. **更新代理上下文**：
   - 在 `__CONTEXT_FILE__` 中，将 `<!-- SPECKIT START -->` 与 `<!-- SPECKIT END -->` 之间的引用更新为当前 plan 文件路径

**输出**：`data-model.md`、`contracts/*`、`quickstart.md`，以及已更新的代理上下文文件

## 关键规则

- 所有文件系统操作使用绝对路径；文档引用使用项目相对路径
- 任何门禁失败或未解决澄清都必须报错，不得静默跳过
- `ai-assets/` 是 AI 辅助理解层，不是事实源本身；如与代码或正式文档冲突，必须以正式事实源为准
