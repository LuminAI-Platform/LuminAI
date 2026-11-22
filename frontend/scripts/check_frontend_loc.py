#!/usr/bin/env python3
import os
import sys

def count_ncloc(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    ncloc = 0
    in_block_comment = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
                after_block = stripped.split("*/", 1)[1].strip()
                if after_block and not after_block.startswith("//"):
                    ncloc += 1
            continue

        if stripped.startswith("/*"):
            if "*/" not in stripped:
                in_block_comment = True
            else:
                after_block = stripped.split("*/", 1)[1].strip()
                if after_block and not after_block.startswith("//"):
                    ncloc += 1
            continue

        if stripped.startswith("//") or stripped.startswith("<!--"):
            continue

        ncloc += 1

    return ncloc

def main():
    frontend_src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
    max_loc = 250
    violations = []
    total_files = 0

    for root, dirs, files in os.walk(frontend_src):
        # ignore test files or build output if needed, but let's check all src files
        for f in files:
            if f.endswith((".ts", ".tsx", ".js", ".jsx", ".css")):
                total_files += 1
                full_path = os.path.join(root, f)
                ncloc = count_ncloc(full_path)
                if ncloc > max_loc:
                    rel_path = os.path.relpath(full_path, os.path.join(frontend_src, ".."))
                    violations.append((rel_path, ncloc))

    print(f"=== Frontend Source NCLOC Audit (Max: {max_loc} lines) ===")
    print(f"Audited {total_files} source files in {frontend_src}")

    if violations:
        print(f"\nFAILURE: {len(violations)} files exceed {max_loc} NCLOC:")
        for path, ncloc in sorted(violations, key=lambda x: -x[1]):
            print(f"  {path}: {ncloc} lines (exceeds by {ncloc - max_loc})")
        sys.exit(1)
    else:
        print(f"SUCCESS: All {total_files} source files comply with <= {max_loc} NCLOC.")
        sys.exit(0)

if __name__ == "__main__":
    main()
