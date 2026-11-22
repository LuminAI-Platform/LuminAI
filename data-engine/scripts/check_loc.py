#!/usr/bin/env python3
"""Check that no source code file in the data engine exceeds 400 non-comment lines of code (NCLOC).

Excludes:
  - Blank lines
  - Comment-only lines (# ...)
  - Multi-line docstrings / block comments
"""

import sys
from pathlib import Path
import tokenize


def count_ncloc(file_path: Path) -> int:
    """Count non-comment, non-blank lines of code in a Python file."""
    try:
        with open(file_path, "rb") as f:
            tokens = list(tokenize.tokenize(f.readline))
    except Exception:
        # Fallback to simple line-based counting if tokenization fails
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        return sum(1 for line in lines if line.strip() and not line.strip().startswith("#"))

    comment_or_doc_lines = set()

    for tok in tokens:
        if tok.type == tokenize.COMMENT:
            for line_no in range(tok.start[0], tok.end[0] + 1):
                comment_or_doc_lines.add(line_no)
        elif tok.type == tokenize.STRING:
            # Check if it's a docstring (standalone expression statement)
            prev_toks = [
                t for t in tokens
                if t.end <= tok.start and t.type not in (tokenize.NL, tokenize.NEWLINE, tokenize.COMMENT)
            ]
            is_docstring = False
            if not prev_toks or prev_toks[-1].string in (":", "INDENT", ";"):
                is_docstring = True
            if is_docstring:
                for line_no in range(tok.start[0], tok.end[0] + 1):
                    comment_or_doc_lines.add(line_no)

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        all_lines = f.readlines()

    ncloc = 0
    for idx, line in enumerate(all_lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if idx in comment_or_doc_lines:
            # Verify if there is non-comment code on this line
            continue
        ncloc += 1

    return ncloc


def main() -> int:
    max_lines = 400
    base_dir = Path(__file__).resolve().parent.parent / "app"
    violators = []

    for path in sorted(base_dir.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        ncloc = count_ncloc(path)
        if ncloc > max_lines:
            violators.append((path, ncloc))

    print(f"=== LuminAI Data Engine NCLOC Audit (Max: {max_lines} lines) ===")
    if violators:
        print(f"FAILED: Found {len(violators)} file(s) exceeding {max_lines} non-comment lines:")
        for path, count in violators:
            rel_path = path.relative_to(base_dir.parent)
            print(f"  {rel_path}: {count} lines (+{count - max_lines})")
        return 1
    else:
        print(f"SUCCESS: All source files in {base_dir} comply with the <= {max_lines} NCLOC limit.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
