import re
from pathlib import Path

INPUT_FILE = Path("daily_inputs/image_text_normalized.txt")
HIGH_CONF = Path("daily_inputs/high_confidence.txt")
LOW_CONF = Path("daily_inputs/low_confidence.txt")

def is_low_confidence(text: str) -> bool:
    words = text.split()
    if len(words) < 5:
        return True

    single_char_ratio = sum(len(w) == 1 for w in words) / len(words)
    avg_word_len = sum(len(w) for w in words) / len(words)
    junk_ratio = len(re.findall(r"[^a-zA-Z0-9\s%.,]", text)) / max(len(text), 1)

    artifact_hits = sum(text.count(c) for c in ["|", "_", "~", "::", ";;"])

    flags = 0
    if single_char_ratio > 0.15:
        flags += 1
    if avg_word_len < 2.4:
        flags += 1
    if junk_ratio > 0.30:
        flags += 1
    if artifact_hits > 5:
        flags += 1

    return flags >= 2


high_blocks = []
low_blocks = []

current = []

with INPUT_FILE.open() as f:
    for line in f:
        line = line.strip()
        if not line:
            if current:
                block = " ".join(current)
                if is_low_confidence(block):
                    low_blocks.append(block)
                else:
                    high_blocks.append(block)
                current = []
        else:
            current.append(line)

# flush last block
if current:
    block = " ".join(current)
    if is_low_confidence(block):
        low_blocks.append(block)
    else:
        high_blocks.append(block)

HIGH_CONF.write_text("\n\n".join(high_blocks))
LOW_CONF.write_text("\n\n".join(low_blocks))

print(f"High confidence blocks: {len(high_blocks)}")
print(f"Low confidence blocks: {len(low_blocks)}")