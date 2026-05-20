#!/usr/bin/env python3
import re
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
js_path = root / "frontend" / "src" / "circuitData.js"
out_dir = root / "backend" / "data"
out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / "circuits.json"

text = js_path.read_text(encoding="utf-8")
start = text.find("const CIRCUITS =")
if start == -1:
    raise SystemExit("CIRCUITS not found in frontend/src/circuitData.js")
obj_start = text.find("{", start)
depth = 0
end_idx = None
for i in range(obj_start, len(text)):
    if text[i] == "{":
        depth += 1
    elif text[i] == "}":
        depth -= 1
        if depth == 0:
            end_idx = i
            break
if end_idx is None:
    raise SystemExit("Failed to parse CIRCUITS object")
obj_text = text[obj_start:end_idx+1]

# Convert JS-ish object to JSON
# 1) Replace single quotes with double quotes
obj_text = obj_text.replace("'", '"')
# 2) Quote bare keys: fullName: -> "fullName":
obj_text = re.sub(r'(?m)(^|\s)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'"\2":', obj_text)
# 3) Remove trailing commas before closing braces/brackets
obj_text = re.sub(r',\s*([}\]])', r'\1', obj_text)

data = json.loads(obj_text)
out_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
print(f"Wrote {out_path}")
