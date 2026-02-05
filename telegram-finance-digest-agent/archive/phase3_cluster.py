from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering

# ---------- PATHS ----------
BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / "daily_inputs" / "image_text_dedup.txt"
OUTPUT_FILE = BASE_DIR / "daily_inputs" / "clusters.json"

# ---------- LOAD ----------
paragraphs = [
    p.strip()
    for p in INPUT_FILE.read_text(encoding="utf-8").split("\n\n")
    if len(p.strip()) > 60
]

print(f"Loaded {len(paragraphs)} paragraphs")

if len(paragraphs) < 2:
    import json

    single_cluster = {
        0: [
            {"id": 0, "text": paragraphs[0]}
        ]
    }

    OUTPUT_FILE.write_text(json.dumps(single_cluster, indent=2))
    print("Only one paragraph found — created single cluster.")
    exit(0)
# ---------- EMBED ----------
model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(paragraphs)

# ---------- CLUSTER ----------
clusterer = AgglomerativeClustering(
    n_clusters=None,
    distance_threshold=1.2,   # tune later
    metric="cosine",
    linkage="average"
)

labels = clusterer.fit_predict(embeddings)

# ---------- GROUP ----------
clusters = {}
for idx, label in enumerate(labels):
    clusters.setdefault(int(label), []).append({
        "id": idx,
        "text": paragraphs[idx]
    })

# ---------- SAVE ----------
import json
OUTPUT_FILE.write_text(json.dumps(clusters, indent=2))
print(f"Created {len(clusters)} clusters")