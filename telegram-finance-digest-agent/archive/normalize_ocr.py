from pathlib import Path
import re

INPUT_FILE = Path("daily_inputs/image_text_clean.txt")
OUTPUT_FILE = Path("daily_inputs/image_text_normalized.txt")

# Ordered replacements (order matters)
REPLACEMENTS = [
    # AI / OCR confusions
    (r"\bAl\b", "AI"),
    (r"\bQo0Q\b", "QoQ"),
    (r"\bQOQ\b", "QoQ"),
    (r"\blnvestment\b", "Investment"),
    (r"\blndia\b", "India"),
    (r"\bFil\b", "FII"),
    (r"\bFIl\b", "FII"),
    (r"\bFYZ6\b", "FY26"),
    (r"\bFY2G\b", "FY26"),

    # Quarter / Year normalization
    (r"\bQ\s*3\b", "Q3"),
    (r"\bQ\s*4\b", "Q4"),
    (r"\bF\s*Y\b", "FY"),
    (r"\bY\s*O\s*Y\b", "YoY"),
    (r"\bQ\s*o\s*Q\b", "QoQ"),
]

def normalize_text(text: str) -> str:
    for pattern, replacement in REPLACEMENTS:
        text = re.sub(pattern, replacement, text)
    return text

def main():
    raw = INPUT_FILE.read_text()
    normalized = normalize_text(raw)
    OUTPUT_FILE.write_text(normalized)
    print("OCR normalization complete.")

if __name__ == "__main__":
    main()