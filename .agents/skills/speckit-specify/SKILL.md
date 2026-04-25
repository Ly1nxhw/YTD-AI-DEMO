---
name: "speckit-specify"
description: "根据自然语言需求创建或更新功能规格说明。"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/specify.md"
---


## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（生成规格之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_specify` 下的条目
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

用户在触发消息里写在 `/speckit.specify` 后面的文本，就是功能描述。即使下文出现字面量 `$ARGUMENTS`，也要视为当前对话中已提供了该描述。除非用户传入空命令，否则不要要求用户重复输入。

给定该功能描述后，按以下步骤执行：

1. **生成简短特性名**（2-4 个词）：
   - 分析描述并提取最关键的关键词
   - 生成一个能准确概括功能的 2-4 词短名
   - 尽量使用“动作-名词”格式，例如 `user-auth`、`analytics-dashboard`
   - 保留 OAuth2、API、JWT 等技术术语或缩写
   - 要求足够简洁，但又能一眼看出功能主题
   - 示例：
     - “我想增加用户认证” -> `user-auth`
     - “为 API 实现 OAuth2 集成” -> `oauth2-api-integration`
     - “创建一个分析仪表盘” -> `analytics-dashboard`
     - “修复支付超时问题” -> `fix-payment-timeout`

2. **创建分支**（可选，通过钩子完成）：

   如果在执行前检查中成功运行了 `before_specify` 钩子，它会创建或切换到 git 分支，并输出包含 `BRANCH_NAME` 与 `FEATURE_NUM` 的 JSON。记录这些值以供参考，但**不要**用它们强制决定规格目录名。

   如果用户显式提供了 `GIT_BRANCH_NAME`，则把它透传给钩子，让分支脚本直接使用该分支名，不再自动拼接前后缀。

3. **创建规格目录**：

   功能规格默认存放在 `specs/` 下，除非用户显式提供了 `SPECIFY_FEATURE_DIRECTORY`。

   **`SPECIFY_FEATURE_DIRECTORY` 的解析顺序**：
   1. 若用户显式提供 `SPECIFY_FEATURE_DIRECTORY`（环境变量、参数或配置），直接使用
   2. 否则在 `specs/` 下自动生成：
      - 读取 `.specify/init-options.json` 中的 `branch_numbering`
      - 若为 `"timestamp"`：前缀使用 `YYYYMMDD-HHMMSS`
      - 若为 `"sequential"` 或未设置：扫描 `specs/` 下已有目录，使用下一个可用的 3 位序号前缀
      - 目录名格式为 `<prefix>-<short-name>`，例如 `003-user-auth`
      - 设置 `SPECIFY_FEATURE_DIRECTORY=specs/<directory-name>`

   **创建目录与规格文件**：
   - `mkdir -p SPECIFY_FEATURE_DIRECTORY`
   - 将 `.specify/templates/spec-template.md` 复制到 `SPECIFY_FEATURE_DIRECTORY/spec.md`
   - 设置 `SPEC_FILE=SPECIFY_FEATURE_DIRECTORY/spec.md`
   - 将解析后的目录路径写入 `.specify/feature.json`：
     ```json
     {
       "feature_directory": "<resolved feature dir>"
     }
     ```
     必须写入真实目录值，例如 `specs/003-user-auth`，而不是字面量 `SPECIFY_FEATURE_DIRECTORY`

   **重要**：
   - 每次 `/speckit.specify` 只允许创建一个功能
   - 规格目录名和 git 分支名彼此独立
   - 规格目录与规格文件始终由当前命令创建，而不是由钩子创建

4. 读取 `.specify/templates/spec-template.md`，理解必填章节与结构要求。

5. 按以下执行流程生成规格：
   1. 解析参数中的用户描述
      - 如果为空：报错 `No feature description provided`
   2. 提取关键概念
      - 识别：参与者、动作、数据、约束
   3. 对不明确的部分：
      - 先基于上下文与行业常识做合理假设
      - 只有在以下情况下才使用 `[NEEDS CLARIFICATION: ...]`
        - 该选择会显著影响范围或用户体验
        - 存在多种合理解释，且影响不同
        - 没有可接受的默认值
      - **最多允许 3 个** `[NEEDS CLARIFICATION]`
      - 优先级：范围 > 安全/隐私 > 用户体验 > 技术细节
   4. 填写“用户场景与测试”
      - 如果无法推导出清晰用户流：报错 `Cannot determine user scenarios`
   5. 生成功能需求
      - 每条需求都必须可测试
      - 对未指定内容采用合理默认值，并在“假设”中记录
   6. 定义成功标准
      - 必须可衡量、与技术实现无关
      - 同时覆盖定量与定性结果
      - 不得依赖具体实现细节才能验证
   7. 如涉及数据，识别关键实体
   8. 返回：`SUCCESS (spec ready for planning)`

6. 按模板结构将规格写入 `SPEC_FILE`，用从功能描述中推导出的具体内容替换占位符，并保持章节顺序与标题层级不变。

7. **规格质量校验**：写入初稿后，按以下步骤自检：

   a. **创建质量检查清单**：在 `SPECIFY_FEATURE_DIRECTORY/checklists/requirements.md` 中生成如下清单：

      ```markdown
      # Specification Quality Checklist: [FEATURE NAME]

      **Purpose**: Validate specification completeness and quality before proceeding to planning
      **Created**: [DATE]
      **Feature**: [Link to spec.md]

      ## Content Quality

      - [ ] No implementation details (languages, frameworks, APIs)
      - [ ] Focused on user value and business needs
      - [ ] Written for non-technical stakeholders
      - [ ] All mandatory sections completed

      ## Requirement Completeness

      - [ ] No [NEEDS CLARIFICATION] markers remain
      - [ ] Requirements are testable and unambiguous
      - [ ] Success criteria are measurable
      - [ ] Success criteria are technology-agnostic (no implementation details)
      - [ ] All acceptance scenarios are defined
      - [ ] Edge cases are identified
      - [ ] Scope is clearly bounded
      - [ ] Dependencies and assumptions identified

      ## Feature Readiness

      - [ ] All functional requirements have clear acceptance criteria
      - [ ] User scenarios cover primary flows
      - [ ] Feature meets measurable outcomes defined in Success Criteria
      - [ ] No implementation details leak into specification

      ## Notes

      - Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
      ```

   b. **运行校验**：
      - 对每个检查项判定通过或失败
      - 记录失败原因，并引用相关章节

   c. **处理校验结果**：
      - 如果全部通过：将清单标记完成，并进入第 8 步
      - 如果存在失败项（不含 `[NEEDS CLARIFICATION]`）：
        1. 列出失败项与具体问题
        2. 更新规格
        3. 重新校验，最多 3 轮
        4. 若 3 轮后仍失败，把剩余问题写入 Notes，并提醒用户
      - 如果仍存在 `[NEEDS CLARIFICATION]`：
        1. 提取全部标记
        2. 若超过 3 个，只保留最关键的 3 个，其余改为合理假设
        3. 对每个问题最多提供 3 个建议答案，并按如下格式向用户展示：

           ```markdown
           ## Question [N]: [Topic]

           **Context**: [Quote relevant spec section]

           **What we need to know**: [Specific question from NEEDS CLARIFICATION marker]

           **Suggested Answers**:

           | Option | Answer | Implications |
           |--------|--------|--------------|
           | A      | [First suggested answer] | [What this means for the feature] |
           | B      | [Second suggested answer] | [What this means for the feature] |
           | C      | [Third suggested answer] | [What this means for the feature] |
           | Custom | Provide your own answer | [Explain how to provide custom input] |

           **Your choice**: _[Wait for user response]_
           ```

        4. 确保 Markdown 表格格式正确
        5. 问题按 Q1、Q2、Q3 顺序编号
        6. 一次性展示全部待回答问题
        7. 等待用户统一答复
        8. 用答复替换规格中的 `[NEEDS CLARIFICATION]`
        9. 完成后重新运行校验

   d. **更新检查清单**：每轮校验后都要更新当前通过/失败状态

8. **向用户报告完成结果**：
   - `SPECIFY_FEATURE_DIRECTORY`：功能目录路径
   - `SPEC_FILE`：规格文件路径
   - 清单校验结果摘要
   - 下一阶段建议：`/speckit.clarify` 或 `/speckit.plan`

9. **检查扩展钩子（生成规格之后）**：
   - 如果 `.specify/extensions.yml` 存在，读取 `hooks.after_specify`
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

**说明**：分支创建由 `before_specify` 钩子处理；规格目录与文件始终由核心命令创建。

## 快速准则

- 重点写清楚 **用户要什么** 以及 **为什么要做**
- 避免写 **怎么实现**（不要出现技术栈、API、代码结构）
- 面向业务与产品干系人，而不是开发者
- 不要把清单直接嵌入规格正文

### 章节要求

- **必填章节**：每次都必须完整填写
- **可选章节**：只在确有必要时保留
- 不适用的章节应删除，而不是写 “N/A”

### 面向 AI 生成时的要求

1. **做出合理假设**：基于上下文、行业常识与常见模式补全空白
2. **记录假设**：把默认推断写进“假设”章节
3. **限制澄清数量**：最多 3 个 `[NEEDS CLARIFICATION]`
4. **澄清优先级**：范围 > 安全/隐私 > 用户体验 > 技术细节
5. **像测试者一样思考**：模糊需求应该无法通过“可测试且无歧义”的检查
6. **通常不必澄清的内容**：
   - 数据保留：默认采用行业惯例
   - 性能目标：默认采用所在领域常规预期
   - 错误处理：默认采用友好提示与合理兜底
   - 认证方式：Web 项目默认 session 或 OAuth2 等合理方案
   - 集成模式：采用与项目类型匹配的常规集成方式

### 成功标准要求

成功标准必须：

1. **可衡量**：包含明确指标，如时间、比例、数量、速率
2. **与技术实现无关**：不得提到框架、语言、数据库或工具
3. **以用户为中心**：描述用户或业务结果，而不是系统内部实现
4. **可验证**：不需要了解实现细节也能判断是否达成

**好的示例**：

- “用户可在 3 分钟内完成结账”
- “系统支持 10000 名并发用户”
- “95% 的搜索在 1 秒内返回结果”
- “主任务完成率提升 40%”

**不好的示例**（过度偏向实现）：

- “API 响应时间低于 200ms”
- “数据库可处理 1000 TPS”
- “React 组件渲染高效”
- “Redis 缓存命中率高于 80%”
