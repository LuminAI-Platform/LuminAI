"""
LuminAI Feature and Architecture Discovery Script
Scans the frontend, core-backend, and data-engine to inventory all endpoints,
routes, operations, and services.
"""
import os
import re
import json

def discover_frontend():
    routes = []
    app_file = "frontend/src/App.tsx"
    if os.path.exists(app_file):
        with open(app_file, "r", encoding="utf-8") as f:
            c = f.read()
        pattern = re.compile(r'path:\s*["\']([^"\']+)["\']')
        for match in pattern.finditer(c):
            routes.append(match.group(1))

    # Also scan sidebar config for navigation labels
    sidebar_file = "frontend/src/components/layout/sidebar/sidebarConfig.tsx"
    sidebar_items = []
    if os.path.exists(sidebar_file):
        with open(sidebar_file, "r", encoding="utf-8") as f:
            sc = f.read()
        item_matches = re.findall(r'name:\s*["\']([^"\']+)["\'],\s*to:\s*["\']([^"\']+)["\']', sc)
        sidebar_items = [{"name": name, "to": to} for name, to in item_matches]

    # Pages
    pages = []
    pages_dir = "frontend/src/pages"
    if os.path.exists(pages_dir):
        for root, _, files in os.walk(pages_dir):
            for file in files:
                if file.endswith("Page.tsx"):
                    pages.append(os.path.relpath(os.path.join(root, file), "frontend/src"))

    return {
        "routes": sorted(list(set(routes))),
        "sidebar_items": sidebar_items,
        "pages": sorted(pages),
    }

def discover_backend():
    controllers = []
    be_dir = "core-backend/src/main/java"
    if not os.path.exists(be_dir):
        return controllers

    for root, _, files in os.walk(be_dir):
        for file in files:
            if file.endswith("Controller.java"):
                p = os.path.join(root, file)
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read()

                # Extract base path
                base_match = re.search(r'@RequestMapping\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', content)
                base_path = base_match.group(1) if base_match else ""

                endpoints = []
                method_pattern = re.compile(r'@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)(?:\(\s*(?:value\s*=\s*)?["\']([^"\']*)["\'])?')
                for m in method_pattern.finditer(content):
                    http_method = m.group(1).replace("Mapping", "").upper()
                    sub_path = m.group(2) or ""
                    full_path = f"{base_path}{sub_path}".replace("//", "/")
                    endpoints.append({
                        "method": http_method,
                        "path": full_path,
                    })

                controllers.append({
                    "controller": file,
                    "file": os.path.relpath(p, "core-backend"),
                    "base_path": base_path,
                    "endpoints": endpoints,
                })
    return controllers

def discover_data_engine():
    endpoints = []
    de_dir = "data-engine/app"
    if not os.path.exists(de_dir):
        return endpoints

    for root, _, files in os.walk(de_dir):
        for file in files:
            if file.endswith(".py"):
                p = os.path.join(root, file)
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read()

                ep_pattern = re.compile(r'@(?:app|router)\.(get|post|put|delete)\(\s*["\']([^"\']+)["\']')
                for m in ep_pattern.finditer(content):
                    endpoints.append({
                        "file": os.path.relpath(p, "data-engine"),
                        "method": m.group(1).upper(),
                        "path": m.group(2),
                    })
    return endpoints

def discover_processing_capabilities():
    # Inspect cleaning, transformation, validation, ML, graph modules
    capabilities = {
        "cleaning_operations": [],
        "transformations": [],
        "validations": [],
        "ml_tasks": [],
        "graph_operations": []
    }

    # Cleaning operations
    cleaning_ops_file = "data-engine/app/processing/engine/cleaning_operations.py"
    if os.path.exists(cleaning_ops_file):
        with open(cleaning_ops_file, "r", encoding="utf-8") as f:
            c = f.read()
        ops = re.findall(r'def\s+(apply_\w+)\(', c)
        capabilities["cleaning_operations"] = ops

    # Transformations
    trans_file = "data-engine/app/processing/engine/transformation_engine.py"
    if os.path.exists(trans_file):
        with open(trans_file, "r", encoding="utf-8") as f:
            c = f.read()
        ops = re.findall(r'def\s+(apply_\w+|_apply_\w+)\(', c)
        capabilities["transformations"] = ops

    # Validation
    val_file = "data-engine/app/processing/engine/quality_framework.py"
    if os.path.exists(val_file):
        with open(val_file, "r", encoding="utf-8") as f:
            c = f.read()
        rules = re.findall(r'def\s+(\w+_rule|\w+_check|validate_\w+)\(', c)
        capabilities["validations"] = rules

    # ML
    ml_file = "data-engine/app/services/ml_service.py"
    if os.path.exists(ml_file):
        with open(ml_file, "r", encoding="utf-8") as f:
            c = f.read()
        tasks = re.findall(r'["\'](classification|regression|clustering|kmeans|random_forest|logistic_regression)["\']', c, re.IGNORECASE)
        capabilities["ml_tasks"] = sorted(list(set(tasks)))

    return capabilities

def main():
    discovery = {
        "frontend": discover_frontend(),
        "backend_controllers": discover_backend(),
        "data_engine_endpoints": discover_data_engine(),
        "processing_capabilities": discover_processing_capabilities(),
    }

    out_dir = "luminai-testing/documentation"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "discovered_architecture.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(discovery, f, indent=2)

    print(f"Discovery complete. Output written to {out_file}")
    print(f"- Frontend Routes: {len(discovery['frontend']['routes'])}")
    print(f"- Frontend Pages: {len(discovery['frontend']['pages'])}")
    print(f"- Backend Controllers: {len(discovery['backend_controllers'])}")
    total_be_ep = sum(len(c['endpoints']) for c in discovery['backend_controllers'])
    print(f"- Backend Endpoints: {total_be_ep}")
    print(f"- Data Engine Endpoints: {len(discovery['data_engine_endpoints'])}")
    print(f"- Cleaning Operations: {len(discovery['processing_capabilities']['cleaning_operations'])}")
    print(f"- Transformations: {len(discovery['processing_capabilities']['transformations'])}")

if __name__ == "__main__":
    main()
