---
name: "speckit-tasks"
description: "基于已有设计文档生成按依赖排序、可执行的 tasks.md。"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/tasks.md"
---


## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（生成任务之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_tasks` 下的条目
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

1. **初始化**：在仓库根目录运行 `.specify/scripts/bash/check-prerequisites.sh --json`，解析 `FEATURE_DIR` 与 `AVAILABLE_DOCS`。所有路径必须使用绝对路径。若参数中包含单引号，请使用正确转义。

2. **加载设计文档**：从 `FEATURE_DIR` 读取：
   - **必需**：`plan.md`（技术栈、依赖、结构）、`spec.md`（用户故事与优先级）
   - **可选**：`data-model.md`、`contracts/`、`research.md`、`quickstart.md`
   - 注意：并非所有项目都会包含全部文档，应基于现有资料生成任务

3. **执行任务生成流程**：
   - 读取 `plan.md`，提取技术栈、依赖与目录结构
   - 读取 `spec.md`，提取用户故事与优先级（P1、P2、P3...）
   - 如有 `data-model.md`：提取实体并映射到用户故事
   - 如有 `contracts/`：将接口契约映射到用户故事
   - 如有 `research.md`：提取关键决策，转化为初始化或基础任务
   - 按用户故事组织任务（详见下文“任务生成规则”）
   - 生成依赖图，明确用户故事完成顺序
   - 为每个故事生成并行执行示例
   - 校验任务完整性，确保每个用户故事都可独立测试

4. **生成 `tasks.md`**：基于 `.specify/templates/tasks-template.md` 填充：
   - 从 `plan.md` 填入正确的功能名
   - Phase 1：初始化任务
   - Phase 2：基础能力任务
   - Phase 3+：按优先级为每个用户故事生成独立阶段
   - 每个阶段包含：故事目标、独立测试方式、测试任务（如需要）、实现任务
   - 末尾补上打磨与横切任务
   - 所有任务必须严格满足清单格式
   - 每条任务都要写明精确文件路径

5. **结果汇报**：输出 `tasks.md` 路径及摘要：
   - 总任务数
   - 每个用户故事的任务数
   - 识别到的并行机会
   - 每个故事的独立测试标准
   - 建议 MVP 范围（通常为用户故事 1）
   - 格式验证结果：确认所有任务都满足清单格式

6. **检查扩展钩子（生成任务之后）**：
   - 如果 `.specify/extensions.yml` 存在，读取 `hooks.after_tasks`
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

任务生成上下文：$ARGUMENTS

生成出的 `tasks.md` 必须可以被 LLM 直接执行，不应依赖额外补充说明。

## 任务生成规则

**关键要求**：任务必须按用户故事组织，以保证每个故事都能独立实现与独立测试。

**测试是可选项**：只有在功能规格明确要求测试，或用户指定采用 TDD 时，才生成测试任务。

### 清单格式（强制）

每条任务都必须严格遵循：

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

组成说明：

1. **复选框**：必须以 `- [ ]` 开头
2. **任务 ID**：按执行顺序递增，例如 `T001`、`T002`
3. **[P] 标记**：仅当任务可并行时出现
4. **[Story] 标签**：只在用户故事阶段任务中出现，格式固定为 `[US1]`、`[US2]`...
5. **描述**：必须明确动作，并带精确文件路径

**示例**：

- 正确：`- [ ] T001 Create project structure per implementation plan`
- 正确：`- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- 正确：`- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- 正确：`- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- 错误：`- [ ] Create User model`
- 错误：`T001 [US1] Create model`
- 错误：`- [ ] [US1] Create User model`
- 错误：`- [ ] T001 [US1] Create model`

### 任务组织原则

1. **来自用户故事（spec.md）**：
   - 每个用户故事对应一个独立阶段
   - 该故事需要的模型、服务、接口、测试都归入同一阶段
   - 大多数故事应保持独立，避免无必要依赖

2. **来自契约（contracts/）**：
   - 每个接口契约都映射到其服务的用户故事
   - 若要求测试，则在该故事中先生成契约测试任务，再生成实现任务

3. **来自数据模型（data-model.md）**：
   - 把每个实体映射到最早需要它的用户故事
   - 若实体被多个故事共享，放入最早阶段或基础能力阶段

4. **来自基础设施与共享能力**：
   - 通用初始化 -> Phase 1
   - 阻塞所有故事的前置能力 -> Phase 2
   - 仅服务某一故事的准备工作 -> 归入该故事阶段

### 阶段结构

- **Phase 1**：初始化
- **Phase 2**：基础能力（阻塞所有用户故事）
- **Phase 3+**：按优先级展开各用户故事
  - 每个故事内部遵循：测试（如有）-> 模型 -> 服务 -> 接口 -> 集成
- **最终阶段**：打磨与横切关注点
