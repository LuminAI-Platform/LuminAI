#!/usr/bin/env python3
"""
Automated Line Count Validator for LuminAI Codebase.
Checks that no source code file exceeds 400 non-comment, non-blank lines of code (NCLOC).
"""

import sys
import os
import re
from pathlib import Path

# Directories to skip
EXCLUDE_DIRS = {
    ".git", ".idea", ".gradle", "build", "dist", "node_modules",
    ".venv", "venv", "__pycache__", ".pytest_cache", ".ruff_cache",
    "qa_datasets", "storage", ".tmp_dagster_home_yrnh4mp2"
}

# File extensions to check
SOURCE_EXTENSIONS = {
    ".py", ".java", ".ts", ".tsx", ".js", ".jsx", ".sql", ".css"
}

def count_python_ncloc(text: str) -> int:
    """Count non-comment, non-blank lines in Python source."""
    lines = text.splitlines()
    ncloc = 0
    in_multiline_string = False
    quote_char = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        
        # Check multiline docstrings/strings
        if in_multiline_string:
            if quote_char in stripped:
                in_multiline_string = False
                quote_char = None
            continue

        # Check if line starts with comment
        if stripped.startswith("#"):
            continue

        # Check start of multiline comment/docstring
        if stripped.startswith('"""') or stripped.startswith("'''"):
            quote = stripped[:3]
            # If closed on same line:
            rest = stripped[3:]
            if quote in rest:
                # closed on same line, it's a docstring comment if alone
                continue
            else:
                in_multiline_string = True
                quote_char = quote
                continue

        ncloc += 1
    return ncloc

def count_c_style_ncloc(text: str) -> int:
    """Count non-comment, non-blank lines for Java, TS, JS, CSS."""
    lines = text.splitlines()
    ncloc = 0
    in_block_comment = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
                # If there is code after */
                after = stripped.split("*/", 1)[1].strip()
                if after and not after.startswith("//"):
                    ncloc += 1
            continue

        if stripped.startswith("//"):
            continue

        if stripped.startswith("/*"):
            if "*/" in stripped:
                after = stripped.split("*/", 1)[1].strip()
                if after and not after.startswith("//"):
                    ncloc += 1
                continue
            else:
                in_block_comment = True
                continue

        ncloc += 1
    return ncloc

def count_sql_ncloc(text: str) -> int:
    """Count non-comment, non-blank lines for SQL."""
    lines = text.splitlines()
    ncloc = 0
    in_block_comment = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
                after = stripped.split("*/", 1)[1].strip()
                if after and not after.startswith("--"):
                    ncloc += 1
            continue

        if stripped.startswith("--"):
            continue

        if stripped.startswith("/*"):
            if "*/" in stripped:
                after = stripped.split("*/", 1)[1].strip()
                if after and not after.startswith("--"):
                    ncloc += 1
                continue
            else:
                in_block_comment = True
                continue

        ncloc += 1
    return ncloc

def count_file_ncloc(path: Path) -> int:
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return 0

    suffix = path.suffix.lower()
    if suffix == ".py":
        return count_python_ncloc(content)
    elif suffix in (".java", ".ts", ".tsx", ".js", ".jsx", ".css"):
        return count_c_style_ncloc(content)
    elif suffix == ".sql":
        return count_sql_ncloc(content)
    return 0

def scan_repository(root_dir: Path, limit: int = 400):
    violations = []
    total_files = 0
    total_ncloc = 0

    for root, dirs, files in os.walk(root_dir):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".tmp")]
        
        for file in files:
            p = Path(root) / file
            if p.suffix.lower() in SOURCE_EXTENSIONS:
                total_files += 1
                ncloc = count_file_ncloc(p)
                total_ncloc += ncloc
                if ncloc > limit:
                    rel_path = p.relative_to(root_dir)
                    violations.append((str(rel_path), ncloc))

    violations.sort(key=lambda x: x[1], reverse=True)
    return violations, total_files, total_ncloc

def main():
    root = Path(__file__).resolve().parent.parent
    limit = 400
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        limit = int(sys.argv[1])

    print(f"Scanning LuminAI repository at: {root}")
    print(f"Threshold: > {limit} Non-Comment Lines of Code (NCLOC)\n")

    violations, total_files, total_ncloc = scan_repository(root, limit)

    print(f"Total source files scanned: {total_files}")
    print(f"Total non-comment LOC: {total_ncloc}")
    print(f"Files exceeding {limit} NCLOC: {len(violations)}\n")

    if violations:
        print(f"{'NCLOC':<8} | {'File Path'}")
        print("-" * 70)
        for path, ncloc in violations:
            print(f"{ncloc:<8} | {path}")
        print("\nFAIL: Source files exceed the 400 non-comment LOC limit.")
        return 1
    else:
        print(f"SUCCESS: All {total_files} source files are within {limit} non-comment LOC.")
        return 0

if __name__ == "__main__":
    sys.exit(main())
