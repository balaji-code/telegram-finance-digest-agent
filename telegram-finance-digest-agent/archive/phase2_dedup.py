from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
INPUT_FILE = Path("daily_inputs/image_text_normalized.txt")
OUTPUT_FILE = Path("daily_inputs/image_text_dedup.txt")

SIMILARITY_THRESHOLD = 0.82  # aggressive but not insane

model = SentenceTransformer("all-MiniLM-L6-v2")

def load_paragraphs(path):
    text = path.read_text(encoding="utf-8")
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 40]
    return paragraphs

def richer(p1, p2):
    """Return the more information-dense paragraph."""
    return p1 if len(p1) >= len(p2) else p2

paragraphs = load_paragraphs(INPUT_FILE)

canonical = []
canonical_embeddings = []

for para in paragraphs:
    emb = model.encode([para])[0]

    if not canonical:
        canonical.append(para)
        canonical_embeddings.append(emb)
        continue

    sims = cosine_similarity([emb], canonical_embeddings)[0]
    max_sim = sims.max()
    idx = sims.argmax()

    if max_sim >= SIMILARITY_THRESHOLD:
        # replace if current paragraph is richer
        better = richer(para, canonical[idx])
        canonical[idx] = better
        canonical_embeddings[idx] = model.encode([better])[0]
    else:
        canonical.append(para)
        canonical_embeddings.append(emb)

OUTPUT_FILE.write_text("\n\n".join(canonical), encoding="utf-8")

print(f"Input paragraphs: {len(paragraphs)}")
print(f"After aggressive dedup: {len(canonical)}")