from pathlib import Path
from sentence_transformers import SentenceTransformer, util

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / "daily_inputs" / "image_text_clean.txt"
OUTPUT_FILE = BASE_DIR / "daily_inputs" / "image_text_dedup.txt"
SIMILARITY_THRESHOLD = 0.90

# ---------- LOAD MODEL ----------
model = SentenceTransformer("all-MiniLM-L6-v2")

# ---------- CHECK INPUT FILE EXISTS ----------
if not INPUT_FILE.exists():
    raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

# ---------- LOAD & SPLIT TEXT ----------
raw_text = INPUT_FILE.read_text(encoding="utf-8", errors="ignore")

# Split by blank lines into paragraphs
paragraphs = [
    p.strip()
    for p in raw_text.split("\n\n")
    if len(p.strip()) > 50   # ignore very short junk
]

print(f"Loaded {len(paragraphs)} paragraphs")

# ---------- DEDUPLICATION ----------
kept_paragraphs = []
kept_embeddings = []

for para in paragraphs:
    embedding = model.encode(para, convert_to_tensor=True)

    is_duplicate = False
    for existing_emb in kept_embeddings:
        similarity = util.cos_sim(embedding, existing_emb).item()
        if similarity >= SIMILARITY_THRESHOLD:
            is_duplicate = True
            break

    if not is_duplicate:
        kept_paragraphs.append(para)
        kept_embeddings.append(embedding)

print(f"Kept {len(kept_paragraphs)} unique paragraphs")

# ---------- WRITE OUTPUT ----------
OUTPUT_FILE.write_text(
    "\n\n".join(kept_paragraphs),
    encoding="utf-8"
)

print(f"Deduplicated file written to {OUTPUT_FILE}")