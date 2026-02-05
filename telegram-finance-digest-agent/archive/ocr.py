import pytesseract
from PIL import Image
from pathlib import Path

IMAGE_DIR = Path("daily_inputs")
OUTPUT_FILE = IMAGE_DIR / "image_text.txt"

with open(OUTPUT_FILE, "w") as out:
    images = sorted(IMAGE_DIR.glob("*.jpg"))
    processed = 0
    skipped = 0

    for img in images:
        try:
            image = Image.open(img).convert("RGB")
            text = pytesseract.image_to_string(image)
            processed += 1

            if text.strip():
                out.write(f"[{img.name}]\n{text}\n\n")
            else:
                skipped += 1

        except Exception as e:
            skipped += 1
            out.write(f"[OCR ERROR] {img.name}: {e}\n\n")

print(f"OCR complete. Processed: {processed}, Empty/Skipped: {skipped}")