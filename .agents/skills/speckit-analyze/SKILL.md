---
name: "speckit-analyze"
description: "在任务生成完成后，对 spec.md、plan.md、tasks.md 做只读的一致性与质量分析。"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/analyze.md"
---


## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，你**必须**先纳入考虑再继续。

## 执行前检查

**检查扩展钩子（分析之前）**：
- 检查项目根目录下是否存在 `.specify/extensions.yml`
- 如果存在，读取 `hooks.before_analyze` 下的条目
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

    Wait for the result of the hook command before proceeding to the Goal.
    ```
- 如果未注册任何钩子，或 `.specify/extensions.yml` 不存在，则静默跳过

## 目标

在实现之前，识别三份核心产物 `spec.md`、`plan.md`、`tasks.md` 之间的一致性问题、重复、歧义和漏项。该命令只能在 `/speckit.tasks` 成功生成完整 `tasks.md` 之后运行。

## 运行约束

**严格只读**：不要修改任何文件。只输出结构化分析报告。如需修复建议，可在最后提供可选的 remediation plan，但必须由用户显式批准后再人工执行后续命令。

**宪章优先**：项目宪章 `.specify/memory/constitution.md` 在本分析中是不可协商的最高约束。任何与宪章冲突的内容都应直接视为 CRITICAL，并要求调整 spec、plan 或 tasks，而不是弱化宪章本身。

## 执行步骤

### 1. 初始化分析上下文

在仓库根目录运行 `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` 一次，解析 `FEATURE_DIR` 与 `AVAILABLE_DOCS`，并推导：

- `SPEC = FEATURE_DIR/spec.md`
- `PLAN = FEATURE_DIR/plan.md`
- `TASKS = FEATURE_DIR/tasks.md`

若任一必需文件缺失，则终止并提示用户运行前置命令。若参数包含单引号，请使用正确转义。

### 2. 渐进式加载产物

只加载最低必要上下文：

**从 spec.md 读取：**
- 概览 / 背景
- 功能需求
- 成功标准
- 用户故事
- 边界情况（如果存在）

**从 plan.md 读取：**
- 架构与技术选择
- 数据模型引用
- 阶段划分
- 技术约束

**从 tasks.md 读取：**
- 任务 ID
- 任务描述
- 阶段分组
- 并行标记 `[P]`
- 引用的文件路径

**从 constitution 读取：**
- 加载 `.specify/memory/constitution.md` 以执行原则校验

### 3. 构建语义模型

在内部构建以下表示（不要把原文整段输出给用户）：

- **需求清单**：记录每个 FR-### 与 SC-### 的稳定键
- **用户故事 / 行动清单**：提取可执行的用户动作与验收标准
- **任务覆盖映射**：把每个任务映射到需求或用户故事
- **宪章规则集**：提取原则名称和其中的 MUST / SHOULD 约束

### 4. 侦测流程（高信号分析）

最多输出 50 条发现，超出部分做汇总。

#### A. 重复检测

- 识别语义近似或重复的需求
- 标记表述较差的一方，建议合并

#### B. 歧义检测

- 标记缺乏量化的模糊形容词，如“快速”“安全”“稳健”“直观”
- 标记未解决的占位符，如 TODO、TKTK、???、`<placeholder>`

#### C. 规格不充分

- 动词明确但对象或结果不明确的需求
- 缺少验收标准映射的用户故事
- 任务引用了规格或计划中未定义的文件 / 组件

#### D. 宪章一致性

- 任何与宪章 MUST 原则冲突的需求或方案
- 宪章要求但文档中缺失的质量门禁或章节

#### E. 覆盖缺口

- 没有任何任务覆盖的需求
- 无法映射到需求或用户故事的任务
- 对性能、安全、可用性等可构建成功标准，没有对应任务支撑

#### F. 不一致性

- 术语漂移
- plan 中出现但 spec 中缺失的数据实体，或反之
- 任务顺序矛盾
- 相互冲突的约束或技术决策

### 5. 严重级别判定

使用以下规则：

- **CRITICAL**：违反宪章 MUST、缺失核心产物、或关键需求完全没有任务覆盖
- **HIGH**：重复 / 冲突需求、关键安全或性能歧义、不可测试的验收标准
- **MEDIUM**：术语漂移、非功能任务覆盖不足、边界情况不充分
- **LOW**：样式、措辞或轻度冗余问题

### 6. 输出紧凑分析报告

输出 Markdown 报告，结构如下：

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Duplication | HIGH | spec.md:L120-134 | ... | ... |

并附带：

**Coverage Summary Table**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Constitution Alignment Issues**（如有）  
**Unmapped Tasks**（如有）

**Metrics**

- Total Requirements
- Total Tasks
- Coverage %
- Ambiguity Count
- Duplication Count
- Critical Issues Count

### 7. 给出下一步建议

在报告末尾输出简洁的 Next Actions：

- 如存在 CRITICAL 问题：建议先修复，再运行 `/speckit.implement`
- 若只有 LOW / MEDIUM：可继续，但应给出改进建议
- 提供明确命令建议，如：
  - `Run /speckit.specify with refinement`
  - `Run /speckit.plan to adjust architecture`
  - `Manually edit tasks.md to add coverage for ...`

### 8. 提供修复协助

询问用户：`Would you like me to suggest concrete remediation edits for the top N issues?`
不要自动修改任何文件。

### 9. 检查扩展钩子

分析报告输出后：
- 若 `.specify/extensions.yml` 存在，读取 `hooks.after_analyze`
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
- 如果未注册任何钩子，或 `.specify/extensions.yml` 不存在，则静默跳过

## 分析原则

### 上下文效率

- 只输出高信号、可行动发现
- 渐进式加载文档，不要无差别转储全文
- 报告最多 50 条发现，其余做统计汇总
- 在未改动文件的前提下，多次运行应得到稳定结果

### 分析准则

- **绝不修改文件**
- **绝不臆造缺失章节**
- **优先报告宪章冲突**
- **优先用具体实例，而不是泛泛规则**
- 若没有问题，也应输出通过报告与覆盖统计

## 上下文

$ARGUMENTS
