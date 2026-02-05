import json
from pathlib import Path
from sentence_transformers import SentenceTransformer, util
import torch

# ---------- Config ----------
OUTPUT_DIR = Path("pipeline_outputs")

USABLE_FILE = OUTPUT_DIR / "usable.json"
PARTIAL_FILE = OUTPUT_DIR / "partial.json"

DEDUP_USABLE_OUT = OUTPUT_DIR / "dedup_usable.txt"
DEDUP_PARTIAL_OUT = OUTPUT_DIR / "dedup_partial.txt"
DEDUP_ALL_OUT = OUTPUT_DIR / "dedup_all.txt"

MODEL_NAME = "all-MiniLM-L6-v2"

SIM_THRESHOLD_USABLE = 0.88
SIM_THRESHOLD_PARTIAL = 0.93
# ----------------------------


def load_texts(path):
    if not path.exists():
        return []
    items = json.loads(path.read_text())
    return [item["text"].strip() for item in items if item.get("text")]


def deduplicate(texts, threshold, model):
    kept = []
    embeddings = []

    for text in texts:
        emb = model.encode(text, convert_to_tensor=True)

        if not embeddings:
            kept.append(text)
            embeddings.append(emb)
            continue

        emb_matrix = torch.stack(embeddings)
        sims = util.cos_sim(emb, emb_matrix)[0]

        if sims.max().item() < threshold:
            kept.append(text)
            embeddings.append(emb)

    return kept


def write_output(path, texts):
    with path.open("w", encoding="utf-8") as f:
        for t in texts:
            f.write(t.strip())
            f.write("\n\n---\n\n")


def main():
    model = SentenceTransformer(MODEL_NAME)

    usable_texts = load_texts(USABLE_FILE)
    partial_texts = load_texts(PARTIAL_FILE)

    print(f"USABLE input: {len(usable_texts)}")
    print(f"PARTIAL input: {len(partial_texts)}")

    dedup_usable = deduplicate(
        usable_texts,
        SIM_THRESHOLD_USABLE,
        model
    )

    dedup_partial = deduplicate(
        partial_texts,
        SIM_THRESHOLD_PARTIAL,
        model
    )

    write_output(DEDUP_USABLE_OUT, dedup_usable)
    write_output(DEDUP_PARTIAL_OUT, dedup_partial)

    # Merge (usable first → higher trust)
    merged = dedup_usable + dedup_partial
    write_output(DEDUP_ALL_OUT, merged)

    print("\nDeduplication complete:")
    print(f"USABLE kept: {len(dedup_usable)}")
    print(f"PARTIAL kept: {len(dedup_partial)}")
    print(f"TOTAL kept: {len(merged)}")


if __name__ == "__main__":
    main()