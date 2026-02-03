import pytesseract
from PIL import Image
from pathlib import Path

IMAGE_DIR = Path("daily_inputs")
OUTPUT_FILE = IMAGE_DIR / "image_text.txt"

with open(OUTPUT_FILE, "w") as out:
    for img in IMAGE_DIR.glob("*.jpg"):
        text = pytesseract.image_to_string(Image.open(img))
        if text.strip():
            out.write(f"[{img.name}]\n{text}\n\n")