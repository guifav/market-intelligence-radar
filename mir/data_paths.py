"""Helpers for locating MIR static data files."""

from __future__ import annotations

import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def data_dirs() -> list[Path]:
    """Return candidate data directories in priority order."""
    dirs: list[Path] = []
    env_dir = os.getenv("MIR_DATA_DIR", "").strip()
    if env_dir:
        dirs.append(Path(env_dir).expanduser())
    dirs.extend([_REPO_ROOT / "app" / "data", _REPO_ROOT / "data"])
    unique: list[Path] = []
    seen: set[Path] = set()
    for path in dirs:
        resolved = path.resolve(strict=False)
        if resolved not in seen:
            seen.add(resolved)
            unique.append(resolved)
    return unique


def data_file(name: str) -> Path:
    """Return an existing data file path, raising if not found."""
    candidates = [directory / name for directory in data_dirs()]
    for path in candidates:
        if path.exists():
            return path
    candidate_str = ", ".join(str(path) for path in candidates)
    raise FileNotFoundError(f"Could not locate data file '{name}'. Tried: {candidate_str}")


def writable_data_file(name: str) -> Path:
    """Return the preferred writable data file path."""
    candidates = [directory / name for directory in data_dirs()]
    for path in candidates:
        if path.exists():
            return path
    preferred_dir = data_dirs()[0]
    preferred_dir.mkdir(parents=True, exist_ok=True)
    return preferred_dir / name
