---
name: "speckit-constitution"
description: "根据交互式输入或已有原则，创建或更新项目宪章，并同步相关模板。"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/constitution.md"
---


## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（更新宪章之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_constitution` 下的条目
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

你将更新位于 `.specify/memory/constitution.md` 的项目宪章。该文件是一个模板，包含形如 `[PROJECT_NAME]`、`[PRINCIPLE_1_NAME]` 的占位符。你的工作是：

1. 收集或推导占位符的实际值  
2. 精确替换模板内容  
3. 把变更同步到相关模板与提示中

**注意**：如果 `.specify/memory/constitution.md` 尚不存在，应先从 `.specify/templates/constitution-template.md` 复制。

按以下流程执行：

1. 读取当前宪章：
   - 找出所有 `[ALL_CAPS_IDENTIFIER]` 形式的占位符
   - **重要**：用户可能要求原则数量少于或多于模板示例；若用户明确要求数量，必须按其要求调整结构

2. 为占位符收集 / 推导值：
   - 用户在当前对话中已给出的值，直接使用
   - 未给出的值，可从仓库上下文中推导（README、docs、历史宪章等）
   - 日期规则：
     - `RATIFICATION_DATE`：原始批准日期；未知时询问或写入 TODO
     - `LAST_AMENDED_DATE`：如本次有改动，则写今天；否则保持原值
   - `CONSTITUTION_VERSION` 必须遵循语义化版本：
     - MAJOR：破坏性原则变更、删除或重定义
     - MINOR：新增原则或实质性扩展
     - PATCH：澄清、措辞微调、错别字修正
   - 若版本升级级别有歧义，先说明理由再定稿

3. 起草新宪章：
   - 用具体文本替换所有占位符
   - 除非有明确理由，不应保留方括号占位符
   - 保持标题层级不变
   - 每条原则都应包含：
     - 简洁标题
     - 明确、不可协商的规则
     - 如有必要，补充简短 rationale
   - Governance 必须说明修订方式、版本规则与合规审查要求

4. 一致性传播检查：
   - 读取 `.specify/templates/plan-template.md`，确保“宪章校验”与新原则一致
   - 读取 `.specify/templates/spec-template.md`，确保规格结构与新原则一致
   - 读取 `.specify/templates/tasks-template.md`，确保任务类型覆盖新的质量要求
   - 读取 `.specify/templates/commands/*.md`（包括当前文件），检查是否仍存在过时表述
   - 读取相关运行时文档（如 README、quickstart 等），同步更新原则引用

5. 生成 Sync Impact Report，并以 HTML 注释形式写在宪章文件顶部：
   - Version change: old -> new
   - 修改过的原则
   - 新增章节
   - 删除章节
   - 需要更新的模板（已更新 / 待更新）
   - 若仍有延后处理项，也要列出 TODO

6. 写回前校验：
   - 不得留下未解释的方括号占位符
   - 版本号与报告一致
   - 日期格式统一为 `YYYY-MM-DD`
   - 原则陈述应明确、可验证，避免含糊措辞

7. 将最终结果覆盖写回 `.specify/memory/constitution.md`。

8. 向用户汇报：
   - 新版本号与升级理由
   - 仍需人工跟进的文件
   - 建议提交信息，例如：
     `docs: amend constitution to vX.Y.Z (principle additions + governance update)`

## 格式与风格要求

- 使用模板中的原始 Markdown 标题层级
- 行宽保持可读，不必机械换行
- 章节之间保留单个空行
- 不要保留行尾空白

如果用户只更新了部分内容（例如只改一条原则），也必须完整执行版本判断与一致性校验流程。

若关键字段确实无法确认（例如批准日期），写入：
`TODO(<FIELD_NAME>): explanation`
并在 Sync Impact Report 中列出。

不要新建新的宪章模板；始终操作现有 `.specify/memory/constitution.md`。

## 执行后检查

**检查扩展钩子（更新宪章之后）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.after_constitution` 下的条目
- 如果 YAML 无法解析或无效，静默跳过钩子检查并正常继续
- 过滤掉 `enabled` 明确为 `false` 的钩子；未声明 `enabled` 视为启用
- 对其余钩子，不要解释或求值 `condition`
  - 没有 `condition`，或其值为 null/空字符串时，视为可执行
  - 若存在非空 `condition`，跳过该钩子，把条件判断交给 HookExecutor
- 对每个可执行钩子，按 `optional` 输出：
  - **可选钩子**（`optional: true`）：
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **强制钩子**（`optional: false`）：
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
- 如果未注册任何钩子，或 `.specify/extensions.yml` 不存在，则静默跳过
