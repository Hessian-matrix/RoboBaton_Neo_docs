"""Refresh the published Python connector source and checksum."""
import hashlib
import shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
shutil.copyfile(root/"connector/neo_connect.py", root/"site/neo_connect.py")
names=["neo_connect.py"]
(root/"site/NeoConnect-SHA256.txt").write_text("".join(hashlib.sha256((root/"site"/name).read_bytes()).hexdigest()+"  "+name+"\n" for name in names))
print("Packaged connector source and checksums")
