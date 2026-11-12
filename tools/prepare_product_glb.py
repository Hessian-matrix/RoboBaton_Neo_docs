"""Prepare the CAD-exported V2 GLB for the public site, preserving geometry.
Usage: python3 tools/prepare_product_glb.py tmp/camera-v2.glb
Export the STEP using cad export first. Original STEP stays outside the site.
"""
import json, struct, sys, hashlib
from pathlib import Path
root = Path(__file__).resolve().parents[1]
b = Path(sys.argv[1]).read_bytes()
assert b[:4] == b"glTF"
n = struct.unpack_from("<I", b, 12)[0]
d = json.loads(b[20:20+n])
for kind in ("nodes", "meshes", "scenes", "materials"):
    for i, item in enumerate(d.get(kind, [])):
        name = item.pop("name", "")
        item.pop("extras", None)
        if kind == "nodes":
            item["name"] = "pcb" if name.startswith("Board~") else "lens" if name.startswith("U6/") else "part_" + str(i)
d["asset"] = {"version": "2.0", "generator": "RoboBaton Neo public product asset"}
payload = json.dumps(d, separators=(",", ":")).encode()
payload += b" " * (-len(payload) % 4)
tail = b[20+n:]
out = struct.pack("<4sII", b"glTF", 2, 20+len(payload)+len(tail)) + struct.pack("<I4s",len(payload),b"JSON") + payload + tail
(root/"site/product-v2.glb").write_bytes(out)
print("Prepared V2 GLB", len(out), "bytes; source SHA256", hashlib.sha256(b).hexdigest())
for name in ("GLTFLoader.js", "BufferGeometryUtils.js"):
    p = root / "tmp" / name
    text = p.read_text().replace("from 'three'", "from './three.module.js'").replace("../utils/BufferGeometryUtils.js", "./BufferGeometryUtils.js")
    (root/"site"/name).write_text(text)
