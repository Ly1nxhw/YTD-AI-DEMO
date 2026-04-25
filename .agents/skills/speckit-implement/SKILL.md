---
name: "speckit-implement"
description: "按照 tasks.md 中定义的任务顺序执行实现工作。"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/implement.md"
---


## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（实现之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_implement` 下的条目
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

1. 在仓库根目录运行 `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`，解析 `FEATURE_DIR` 与 `AVAILABLE_DOCS`。所有路径必须使用绝对路径。若参数中包含单引号，请使用正确转义。

2. **检查清单状态**（若 `FEATURE_DIR/checklists/` 存在）：
   - 扫描该目录下所有 checklist 文件
   - 对每个文件统计：
     - 总项数：匹配 `- [ ]`、`- [X]`、`- [x]`
     - 已完成数：匹配 `- [X]`、`- [x]`
     - 未完成数：匹配 `- [ ]`
   - 生成状态表：

     ```text
     | Checklist | Total | Completed | Incomplete | Status |
     |-----------|-------|-----------|------------|--------|
     | ux.md     | 12    | 12        | 0          | PASS   |
     | test.md   | 8     | 5         | 3          | FAIL   |
     ```

   - 总体状态规则：
     - **PASS**：所有 checklist 的未完成数都为 0
     - **FAIL**：任意 checklist 存在未完成项

   - **如果存在未完成项**：
     - 展示状态表
     - 停止，并询问用户：`Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)`
     - 等待用户回答
     - 用户回答 `no` / `wait` / `stop` 时立即终止
     - 用户回答 `yes` / `proceed` / `continue` 时继续

   - **如果全部完成**：
     - 展示状态表
     - 自动继续下一步

3. 加载并分析实现上下文：
   - **必需**：`tasks.md`
   - **必需**：`plan.md`
   - **如存在**：`data-model.md`
   - **如存在**：`contracts/`
   - **如存在**：`research.md`
   - **如存在**：`quickstart.md`

4. **项目设置校验**：
   - **必需**：根据实际项目情况创建或补全忽略文件
   - 使用如下检测逻辑：
     - 若 `git rev-parse --git-dir` 成功，则创建或补全 `.gitignore`
     - 检测 Docker、ESLint、Prettier、npm、Terraform、Helm 等相关文件，并为其创建或补全对应 ignore 文件
   - 若忽略文件已存在，仅补充关键缺失项，不重写用户已有内容

5. 解析 `tasks.md`，提取：
   - 阶段划分
   - 任务依赖
   - 任务 ID、描述、文件路径、并行标记 `[P]`
   - 执行顺序

6. 按任务计划执行实现：
   - 严格按阶段推进
   - 遵守依赖关系
   - 若存在测试任务，先执行测试任务再执行对应实现任务
   - 涉及同一文件的任务必须串行执行
   - 每一阶段结束都做一次校验

7. 实施规则：
   - 先完成初始化
   - 若需要测试，先写并运行测试
   - 再实现模型、服务、CLI、接口、端点
   - 然后处理数据库、中间件、日志、外部集成
   - 最后做打磨、文档与验证

8. 进度跟踪与错误处理：
   - 每完成一个任务都报告进度
   - 非并行任务失败时立即停止
   - 并行任务中，成功项继续推进，失败项需要明确汇报
   - 输出清晰可调试的错误信息
   - **重要**：完成任务后必须把 `tasks.md` 中对应项标记为 `[X]`

9. 完成验证：
   - 确认所有必需任务已完成
   - 确认实现结果符合规格
   - 确认测试通过并满足要求
   - 确认实现遵循 plan
   - 输出最终完成报告

说明：如果 `tasks.md` 缺失或不完整，应提示用户先运行 `/speckit.tasks`。

10. **检查扩展钩子（实现之后）**：
    - 如果 `.specify/extensions.yml` 存在，读取 `hooks.after_implement`
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
