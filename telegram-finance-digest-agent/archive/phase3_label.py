import json
from pathlib import Path
from datetime import date
from openai import OpenAI
from dotenv import load_dotenv
import os
load_dotenv()

client = OpenAI(api_key= os.getenv("OPENAI_API_KEY"))

# ---------- PATHS ----------
BASE_DIR = Path(__file__).resolve().parent.parent
CLUSTERS_FILE = BASE_DIR / "daily_inputs" / "clusters.json"
OUTPUT_FILE = BASE_DIR / "daily_inputs" / f"daily_themes_{date.today()}.txt"

clusters = json.loads(CLUSTERS_FILE.read_text())

def label_cluster(paragraphs: list[str]) -> str:
    content = "\n\n".join(paragraphs[:6])  # cap input for safety

    prompt = f"""
You are consolidating financial news items.

Given the following related content, do the following:
1. Assign a short, factual theme title.
2. Write a neutral 2–3 line summary capturing the shared idea.
3. List key factual points as bullets.

Rules:
- Do not add opinions or forecasts.
- Do not introduce information not present.
- Be precise and restrained.

Content:
{content}
"""

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )

    return response.output_text.strip()

with open(OUTPUT_FILE, "w") as out:
    for cluster_id, items in clusters.items():
        paragraphs = [i["text"] for i in items]
        theme_text = label_cluster(paragraphs)

        out.write(theme_text)
        out.write("\n\n" + "=" * 50 + "\n\n")

print(f"Phase 3 labeling complete → {OUTPUT_FILE.name}")