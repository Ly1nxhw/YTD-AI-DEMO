---
name: speckit-ai-assets-extract
description: 从仓库事实中初始化或刷新 ai-assets 资产目录。
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: ai-assets:commands/speckit.ai-assets.extract.md
---

## 用户输入

```text
$ARGUMENTS
```

如果用户输入非空，请把它当作本次提取的附加关注点，但不要偏离仓库事实。

## 执行纲要

1. 在仓库根目录运行 `.specify/extensions/ai-assets/scripts/bash/extract-ai-assets.sh --json`，获取当前仓库的扫描 JSON。
2. 基于扫描结果，再读取其中列出的正式来源文件，例如 `README*`、`AGENTS.md`、`docs/**`、`CHANGELOG*`、`CONTRIBUTING*`、顶层配置文件、工作流与模板文件。
3. 在仓库根目录创建或刷新 `ai-assets/`，生成以下文件：
   - `ai-assets/project-overview.md`
   - `ai-assets/glossary.md`
   - `ai-assets/architecture.md`
   - `ai-assets/repo-map.md`
   - `ai-assets/conventions.md`
   - `ai-assets/evolution-log.md`
   - `ai-assets/extraction-report.md`

## 写作规则

- 所有结论优先来自代码、配置、宪章、README、工作流、正式文档。
- `ai-assets/` 只能提炼和组织事实，不能替代源码、配置、契约或正式文档的 source of truth 地位。
- 不要把猜测写成事实。所有无法直接验证的内容都放在 `Inferred` 或 `Open Questions`。
- 重要结论使用置信度标签：`[high]`、`[medium]`、`[low]`。
- 尽量引用具体文件路径，方便后续规划阶段回溯。
- 如果仓库事实不足，不要强行补完，直接记录缺口。

## 每个资产的固定结构

除 `extraction-report.md` 外，每个资产文件都必须包含以下三个二级标题，且顺序固定：

```markdown
## Observed

## Inferred

## Open Questions
```

建议在条目级别使用如下格式：

```markdown
- [high] 观察或结论（来源：`README.md`、`pyproject.toml`）
```

## 各资产目标

### `project-overview.md`

- 总结项目目标、主要能力、目标用户或使用场景
- 区分仓库明确写出的内容和从结构推断出的内容

### `glossary.md`

- 收集项目专用名词、缩写、目录缩写、命令别名
- 优先提取 README、文档、代码中的稳定术语

### `architecture.md`

- 归纳系统边界、主要模块、分层关系、关键运行流
- 明确哪些内容来自代码结构，哪些内容属于推断

### `repo-map.md`

- 给出仓库目录地图、关键入口文件、关键工作流、模板落点
- 标注哪些目录是核心源码、哪些是工具或文档

### `conventions.md`

- 总结编码约定、流程约定、测试约定、隐性规则
- 仅记录已经被文档、配置、脚本或现有结构体现出来的约定

### `evolution-log.md`

- 从 `CHANGELOG*`、提交约定说明、文档历史线索中提炼演进方向
- 重点记录当前能观察到的阶段性演进，而不是杜撰完整历史

### `extraction-report.md`

- 记录本次提取扫描了哪些来源
- 记录高置信度与低置信度区域
- 记录尚未解决的缺口与建议人工补充点

## 完成标准

- `ai-assets/` 全部 7 个文件都已存在
- 6 类核心资产都包含 `Observed / Inferred / Open Questions`
- `extraction-report.md` 说明了来源范围、主要结论和未决问题
- 输出结果明确提醒：后续 `speckit.plan` 应优先消费 `glossary.md`、`repo-map.md`、`architecture.md`、`conventions.md`