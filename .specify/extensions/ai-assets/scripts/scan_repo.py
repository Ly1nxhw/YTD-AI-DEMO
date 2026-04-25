#!/usr/bin/env python3
"""Lightweight repository scanner for the bundled ai-assets extension."""

from __future__ import annotations

import json
import sys
from pathlib import Path


DOC_EXTENSIONS = {".md", ".mdx", ".rst", ".txt", ".adoc"}
CONFIG_NAMES = {
    ".editorconfig",
    ".gitignore",
    ".prettierrc",
    ".prettierrc.json",
    ".python-version",
    "Dockerfile",
    "Makefile",
    "Taskfile.yml",
    "Taskfile.yaml",
    "docker-compose.yml",
    "docker-compose.yaml",
    "go.mod",
    "package.json",
    "pnpm-workspace.yaml",
    "pyproject.toml",
    "requirements.txt",
    "setup.cfg",
    "setup.py",
    "tsconfig.json",
}
CONFIG_SUFFIXES = {".json", ".json5", ".toml", ".yaml", ".yml", ".ini", ".cfg"}
ENTRYPOINT_NAMES = {
    "__main__.py",
    "app.py",
    "cli.py",
    "index.js",
    "index.ts",
    "index.tsx",
    "main.go",
    "main.py",
    "main.rs",
    "manage.py",
    "Program.cs",
    "server.js",
    "server.ts",
}
SCRIPT_SUFFIXES = {".sh", ".ps1", ".py", ".js", ".ts", ".rb", ".pl"}
SOURCE_ROOT_NAMES = {
    "api",
    "app",
    "apps",
    "backend",
    "client",
    "cmd",
    "frontend",
    "lib",
    "packages",
    "server",
    "services",
    "src",
    "web",
}
MAX_DOC_FILES = 60
MAX_ENTRYPOINTS = 40
MAX_SCRIPTS = 60
MAX_TEMPLATES = 60
MAX_WORKFLOWS = 60


def rel_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def iter_files(base: Path, max_depth: int) -> list[Path]:
    files: list[Path] = []
    if not base.is_dir():
        return files

    for path in base.rglob("*"):
        if not path.is_file():
            continue
        try:
            rel = path.relative_to(base)
        except ValueError:
            continue
        if len(rel.parts) <= max_depth:
            files.append(path)
    return sorted(files)


def classify_docs(root: Path) -> dict[str, list[str]]:
    buckets = {
        "readme": [],
        "agents": [],
        "docs": [],
        "changelog": [],
        "contributing": [],
        "other_docs": [],
    }

    for path in sorted(root.iterdir()):
        if not path.is_file():
            continue
        upper_name = path.name.upper()
        if upper_name.startswith("README"):
            buckets["readme"].append(rel_posix(path, root))
        elif upper_name == "AGENTS.MD":
            buckets["agents"].append(rel_posix(path, root))
        elif upper_name.startswith("CHANGELOG"):
            buckets["changelog"].append(rel_posix(path, root))
        elif upper_name.startswith("CONTRIBUTING"):
            buckets["contributing"].append(rel_posix(path, root))
        elif path.suffix.lower() in DOC_EXTENSIONS:
            buckets["other_docs"].append(rel_posix(path, root))

    docs_dir = root / "docs"
    for path in iter_files(docs_dir, max_depth=4)[:MAX_DOC_FILES]:
        if path.suffix.lower() in DOC_EXTENSIONS:
            buckets["docs"].append(rel_posix(path, root))

    return buckets


def collect_config_files(root: Path) -> list[str]:
    results: list[str] = []
    for path in sorted(root.iterdir()):
        if not path.is_file():
            continue
        if path.name in CONFIG_NAMES or path.suffix.lower() in CONFIG_SUFFIXES:
            results.append(rel_posix(path, root))
    return results


def collect_entrypoints(root: Path) -> list[str]:
    candidates: set[str] = set()

    for path in iter_files(root, max_depth=3):
        rel = path.relative_to(root)
        if len(rel.parts) > 3:
            continue
        if path.name in ENTRYPOINT_NAMES:
            candidates.add(rel.as_posix())

    for name in sorted(SOURCE_ROOT_NAMES):
        base = root / name
        for path in iter_files(base, max_depth=3):
            if path.name in ENTRYPOINT_NAMES:
                candidates.add(rel_posix(path, root))

    return sorted(candidates)[:MAX_ENTRYPOINTS]


def collect_scripts(root: Path) -> list[str]:
    candidates: set[str] = set()

    for path in sorted(root.iterdir()):
        if path.is_file() and path.suffix.lower() in SCRIPT_SUFFIXES:
            candidates.add(rel_posix(path, root))

    for subdir in ("scripts", "tools"):
        for path in iter_files(root / subdir, max_depth=4):
            if path.suffix.lower() in SCRIPT_SUFFIXES or path.name in {"Makefile"}:
                candidates.add(rel_posix(path, root))

    return sorted(candidates)[:MAX_SCRIPTS]


def collect_workflows(root: Path) -> list[str]:
    candidates: set[str] = set()
    for subdir in (".github/workflows", "workflows", ".specify/workflows"):
        for path in iter_files(root / subdir, max_depth=4):
            candidates.add(rel_posix(path, root))
    return sorted(candidates)[:MAX_WORKFLOWS]


def collect_templates(root: Path) -> list[str]:
    candidates: set[str] = set()
    for subdir in ("templates", ".specify/templates", "presets", "extensions"):
        base = root / subdir
        for path in iter_files(base, max_depth=4):
            rel = rel_posix(path, root)
            if "/templates/" in rel or rel.startswith("templates/") or rel.startswith(".specify/templates/"):
                candidates.add(rel)
    return sorted(candidates)[:MAX_TEMPLATES]


def collect_source_roots(root: Path) -> list[str]:
    return sorted(
        rel_posix(path, root)
        for path in root.iterdir()
        if path.is_dir() and path.name in SOURCE_ROOT_NAMES
    )


def build_payload(root: Path) -> dict[str, object]:
    top_level_dirs = sorted(
        rel_posix(path, root) for path in root.iterdir() if path.is_dir()
    )
    top_level_files = sorted(
        rel_posix(path, root) for path in root.iterdir() if path.is_file()
    )

    return {
        "project_root": str(root),
        "top_level": {
            "directories": top_level_dirs,
            "files": top_level_files,
        },
        "sources": classify_docs(root),
        "config_files": collect_config_files(root),
        "source_roots": collect_source_roots(root),
        "entrypoints": collect_entrypoints(root),
        "scripts": collect_scripts(root),
        "workflows": collect_workflows(root),
        "templates": collect_templates(root),
    }


def main(argv: list[str]) -> int:
    target = Path(argv[1]).resolve() if len(argv) > 1 else Path.cwd().resolve()
    payload = build_payload(target)
    json.dump(payload, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
