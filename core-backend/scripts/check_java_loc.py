"""Audit Non-Comment Lines of Code (NCLOC) for Java source files in core-backend.

Rule: Every Java source file in src/main/java must contain <= 400 NCLOC
(excluding blank lines and comments).
"""

import os
import re
import sys
from pathlib import Path

MAX_NCLOC = 400


def count_java_ncloc(file_path: Path) -> int:
    """Counts non-comment, non-blank lines in a Java file."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Remove block comments /* ... */
    content_no_blocks = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)

    ncloc = 0
    for line in content_no_blocks.splitlines():
        line_stripped = line.strip()
        # Skip empty lines or line comments //
        if not line_stripped or line_stripped.startswith("//"):
            continue
        ncloc += 1

    return ncloc


def main():
    root = Path(__file__).resolve().parent.parent / "src" / "main" / "java"
    if not root.exists():
        print(f"Directory {root} does not exist.")
        sys.exit(1)

    violations = []
    total_files = 0

    print(f"=== Core Backend Java NCLOC Audit (Max: {MAX_NCLOC} lines) ===")
    for java_file in root.rglob("*.java"):
        total_files += 1
        ncloc = count_java_ncloc(java_file)
        if ncloc > MAX_NCLOC:
            violations.append((java_file, ncloc))
            print(f"VIOLATION: {java_file.relative_to(root)} -> {ncloc} lines (exceeds {MAX_NCLOC})")

    if violations:
        print(f"\nFAILURE: {len(violations)} of {total_files} Java files violate the <= {MAX_NCLOC} NCLOC limit.")
        sys.exit(1)
    else:
        print(f"SUCCESS: All {total_files} Java source files in {root} comply with the <= {MAX_NCLOC} NCLOC limit.")
        sys.exit(0)


if __name__ == "__main__":
    main()
