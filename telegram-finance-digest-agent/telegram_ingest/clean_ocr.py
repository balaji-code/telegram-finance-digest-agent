import re
from pathlib import Path

INPUT = Path("daily_inputs/image_text.txt")
OUTPUT = Path("daily_inputs/image_text_clean.txt")

text = INPUT.read_text(errors="ignore")

# 1. Remove common junk symbols
text = re.sub(r"[¢©®@=~_|]+", " ", text)

# 2. Remove usernames / handles
text = re.sub(r"@\w+", "", text)

# 3. Normalize whitespace
text = re.sub(r"\n{3,}", "\n\n", text)
text = re.sub(r"[ \t]{2,}", " ", text)

# 4. Fix broken words (very conservative)
text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

# 5. Strip lines that are mostly noise
clean_lines = []
for line in text.splitlines():
    if len(line.strip()) < 6:
        continue
    clean_lines.append(line.strip())

OUTPUT.write_text("\n".join(clean_lines))
print("OCR cleanup complete → image_text_clean.txt")