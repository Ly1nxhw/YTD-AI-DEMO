# AI Assets Extension

This bundled extension adds `speckit.ai-assets.extract` and keeps a lightweight
`ai-assets/` knowledge layer alongside the normal Spec Kit workflow.

It is designed to:

- scan the repository for verifiable facts
- synthesize project-facing AI assets from those facts
- make `speckit.plan` read those assets before planning

Generated project assets:

- `ai-assets/project-overview.md`
- `ai-assets/glossary.md`
- `ai-assets/architecture.md`
- `ai-assets/repo-map.md`
- `ai-assets/conventions.md`
- `ai-assets/evolution-log.md`
- `ai-assets/extraction-report.md`

Every generated asset must separate:

- `Observed`
- `Inferred`
- `Open Questions`

Important rule: `ai-assets/` is an interpretation layer for AI assistance. It
does not replace code, configuration, contracts, or formal project documents as
the source of truth.
