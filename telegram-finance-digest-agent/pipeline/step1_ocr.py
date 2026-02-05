import json
from pathlib import Path
from PIL import Image
import pytesseract


# -------- CONFIG --------
IMAGE_DIR = Path("daily_inputs")
OUTPUT_PATH = Path("pipeline_outputs/raw_ocr.json")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
# ------------------------


def run_ocr_on_image(image_path: Path) -> str:
    """
    Runs raw OCR on a single image.
    Returns text exactly as produced by Tesseract.
    """
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        return f"[OCR_ERROR] {str(e)}"


def main():
    records = []

    images = sorted(
        [p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS]
    )

    if not images:
        raise RuntimeError("No images found in daily_inputs/")

    for img_path in images:
        print(f"OCR → {img_path.name}")
        text = run_ocr_on_image(img_path)

        records.append({
            "image": img_path.name,
            "text": text
        })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(records, indent=2, ensure_ascii=False))

    print(f"\nOCR complete.")
    print(f"Images processed: {len(records)}")
    print(f"Output written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()