# 实施计划：[FEATURE]

**分支**：`[###-feature-name]` | **日期**：[DATE] | **规格**：[link]  
**输入**：来自 `/specs/[###-feature-name]/spec.md` 的功能规格说明

**说明**：此模板由 `/speckit.plan` 命令填写。执行流程请参考 `.specify/templates/plan-template.md`。

## 摘要

[从功能规格中提炼：主要需求 + 基于研究得出的技术方向]

## AI Assets 输入

**必读资产**：`ai-assets/glossary.md`、`ai-assets/repo-map.md`、`ai-assets/architecture.md`、`ai-assets/conventions.md`  
**可选补充**：`ai-assets/project-overview.md`、`ai-assets/evolution-log.md`、`ai-assets/extraction-report.md`  
**使用要求**：
- 先记录本次实际读取了哪些资产
- 用术语表稳定专用名词
- 用仓库地图和架构资产校正目录结构与模块边界
- 用约定资产补充隐性规则、流程规则、测试约定
- 如资产内容与代码/配置/宪章/规格冲突，必须记录冲突并以正式事实源为准

## 技术上下文

<!--
  必须将本节替换为当前项目的真实技术上下文。
  下列结构用于引导分析，并不是最终内容本身。
-->

**语言/版本**：[例如 Python 3.11、Swift 5.9、Rust 1.75，或 NEEDS CLARIFICATION]  
**主要依赖**：[例如 FastAPI、UIKit、LLVM，或 NEEDS CLARIFICATION]  
**存储方式**：[如适用，例如 PostgreSQL、CoreData、文件系统，或 N/A]  
**测试方案**：[例如 pytest、XCTest、cargo test，或 NEEDS CLARIFICATION]  
**目标平台**：[例如 Linux 服务端、iOS 15+、WASM，或 NEEDS CLARIFICATION]  
**项目类型**：[例如 library / cli / web-service / mobile-app / compiler / desktop-app，或 NEEDS CLARIFICATION]  
**性能目标**：[领域相关指标，例如 1000 req/s、10k 行/秒、60 fps，或 NEEDS CLARIFICATION]  
**约束条件**：[领域相关约束，例如 p95 < 200ms、内存 < 100MB、离线可用，或 NEEDS CLARIFICATION]  
**规模范围**：[领域相关规模，例如 1 万用户、100 万行代码、50 个页面，或 NEEDS CLARIFICATION]

## 宪章校验

*门禁：在 Phase 0 研究前必须通过；在 Phase 1 设计完成后需要复核。*

[根据 constitution 文件填写约束、禁令、必须满足的质量门禁]

## 项目结构

### 文档产物（当前功能）

```text
specs/[###-feature]/
|- plan.md              # 本文件（/speckit.plan 输出）
|- research.md          # Phase 0 输出
|- data-model.md        # Phase 1 输出
|- quickstart.md        # Phase 1 输出
|- contracts/           # Phase 1 输出
`- tasks.md             # Phase 2 输出（由 /speckit.tasks 生成）
```

### 源码结构（仓库根目录）

<!--
  必须将下面的占位结构替换为本功能实际采用的仓库结构。
  删除未使用的选项，只保留最终采用的目录。
-->

```text
# [未使用则删除] 方案 1：单体项目（默认）
src/
|- models/
|- services/
|- cli/
`- lib/

tests/
|- contract/
|- integration/
`- unit/

# [未使用则删除] 方案 2：Web 应用（检测到 frontend + backend 时）
backend/
|- src/
|  |- models/
|  |- services/
|  `- api/
`- tests/

frontend/
|- src/
|  |- components/
|  |- pages/
|  `- services/
`- tests/

# [未使用则删除] 方案 3：移动端 + API（检测到 iOS/Android 时）
api/
`- [与 backend 类似]

ios/ or android/
`- [平台特定模块、UI 流程、平台测试]
```

**结构决策**：[说明最终采用的结构，并引用上方的真实目录布局]

## 复杂度跟踪

> **仅当宪章校验存在必须明确说明的偏离时填写**

| 偏离项 | 为什么必须这样做 | 为何拒绝更简单的替代方案 |
|--------|------------------|--------------------------|
| [例如：第 4 个子项目] | [当前需要] | [为什么现有 3 个项目不够] |
| [例如：Repository 模式] | [具体问题] | [为什么直接访问数据库不够] |
