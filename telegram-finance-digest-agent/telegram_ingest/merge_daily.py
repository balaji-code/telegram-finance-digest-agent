from pathlib import Path

BASE = Path("daily_inputs")
out = BASE / "daily_input.txt"

with open(out, "w") as f:
    for name in ["text.txt", "image_text.txt"]:
        p = BASE / name
        if p.exists():
            f.write(p.read_text())
            f.write("\n")