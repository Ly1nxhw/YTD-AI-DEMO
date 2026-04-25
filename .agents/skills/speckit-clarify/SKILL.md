---
name: "speckit-clarify"
description: "识别当前功能规格中定义不充分的部分，最多提出 5 个高价值澄清问题，并将答案回写到规格中。"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/clarify.md"
---


## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（澄清之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_clarify` 下的条目
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

目标：发现当前功能规格中的关键歧义或缺失决策点，并把澄清结果直接写回规格文件。

说明：该澄清流程默认应在 `/speckit.plan` 之前完成。如果用户明确表示跳过，你可以继续，但必须提醒后续返工风险会上升。

执行步骤：

1. 在仓库根目录运行 `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` 一次（`--json --paths-only` / `-Json -PathsOnly`），解析：
   - `FEATURE_DIR`
   - `FEATURE_SPEC`
   - 可选：`IMPL_PLAN`、`TASKS`
   - 若 JSON 解析失败，终止并提示用户重新运行 `/speckit.specify`

2. 读取当前规格文件，按以下分类执行结构化扫描，并为每类标记：Clear / Partial / Missing：

   功能范围与行为：
   - 核心用户目标与成功标准
   - 明确的范围外声明
   - 用户角色 / 人群区分

   领域与数据模型：
   - 实体、属性、关系
   - 标识与唯一性规则
   - 生命周期 / 状态流转
   - 数据量与规模假设

   交互与体验流程：
   - 关键用户旅程
   - 错误 / 空态 / 加载态
   - 无障碍或本地化要求

   非功能属性：
   - 性能
   - 可扩展性
   - 可靠性与可用性
   - 可观测性
   - 安全与隐私
   - 合规约束

   集成与外部依赖：
   - 外部服务 / API 与失败模式
   - 数据导入导出格式
   - 协议 / 版本假设

   边界与失败处理：
   - 负向场景
   - 限流 / 节流
   - 并发冲突解决

   约束与权衡：
   - 技术约束
   - 已明确的取舍与弃用方案

   术语与一致性：
   - 规范术语表
   - 应避免的同义词或废弃术语

   完成信号：
   - 验收标准是否可测试
   - 是否存在可衡量的完成定义

   其他占位项：
   - TODO / 未决项
   - “稳健”“直观”等不可量化形容词

3. 在内部生成最多 5 个优先级最高的澄清问题：
   - 每个问题必须可用短选项或不超过 5 个词的短答回答
   - 只保留会实质影响架构、数据建模、任务拆解、测试设计、体验行为或合规性的高影响问题
   - 避免重复追问低价值细节
   - 若超过 5 个未决项，按“影响 * 不确定性”排序，仅保留前 5 个

4. **串行交互提问**：
   - 每次只问 **1 个问题**
   - 对多选题：
     - 先分析所有选项
     - 给出最推荐选项与简短理由
     - 再用 Markdown 表格列出选项
     - 提示用户可以回复选项字母、`yes` / `recommended`，或给出自己的短答案
   - 对短答题：
     - 先给出建议答案与理由
     - 提示用户可回复 `yes` / `suggested` 或给出自己的短答案
   - 用户回答后：
     - 若回复 `yes` / `recommended` / `suggested`，使用建议答案
     - 否则校验其是否映射到选项，或满足不超过 5 个词
     - 若含糊，再追问一次，但仍算同一题
   - 满足以下任一条件就停止继续提问：
     - 关键歧义已解决
     - 用户明确表示结束
     - 已达到 5 个问题上限

5. **每接受一个答案就立即整合回规格**：
   - 在内存中维护规格内容，并在第一次回写时确保存在：
     - `## Clarifications`
     - `### Session YYYY-MM-DD`
   - 每个答案都追加一条记录：
     `- Q: <question> -> A: <final answer>`
   - 然后把答案写回最合适的章节：
     - 功能歧义 -> 功能需求
     - 角色或交互差异 -> 用户故事
     - 数据形态 -> 数据模型
     - 非功能约束 -> 成功标准
     - 边界或异常 -> Edge Cases / Error Handling
     - 术语冲突 -> 统一术语
   - 若新答案与旧表述冲突，必须替换旧表述，而不是简单追加
   - 每次整合后都立即保存规格文件

6. **每次回写后校验**：
   - 澄清会话中每个已接受问题恰好对应一条记录
   - 总问题数不超过 5
   - 不留与新答案冲突的旧文本
   - Markdown 结构仍有效
   - 术语使用一致

7. 将更新后的内容写回 `FEATURE_SPEC`。

8. **向用户报告结果**：
   - 已提问并已解答的问题数量
   - 更新后的规格路径
   - 被修改的章节列表
   - 覆盖总结：Resolved / Deferred / Clear / Outstanding
   - 若仍有 Outstanding 或 Deferred，建议是否进入 `/speckit.plan`
   - 建议下一条命令

行为规则：

- 若未发现值得正式澄清的关键问题，直接回复：`No critical ambiguities detected worth formal clarification.`
- 若规格文件缺失，提示用户先运行 `/speckit.specify`
- 绝不能超过 5 个问题
- 除非阻塞正确性，不要追问偏技术栈的问题
- 尊重用户的提前结束指令

优先级上下文：$ARGUMENTS

## 执行后检查

**检查扩展钩子（澄清之后）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.after_clarify` 下的条目
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
