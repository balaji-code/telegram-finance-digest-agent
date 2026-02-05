from pathlib import Path
from datetime import date

BASE = Path("daily_inputs")
today = date.today().isoformat()

out = BASE / f"daily_canonical_{today}.txt"

parts = [
    BASE / "text.txt",
    BASE / "image_text_dedup.txt"
]

with open(out, "w") as f:
    for p in parts:
        if p.exists():
            f.write(p.read_text())
            f.write("\n\n")

print(f"Canonical daily file created → {out.name}")