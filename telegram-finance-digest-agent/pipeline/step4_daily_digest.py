import os
from pathlib import Path
from datetime import date
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()
# ---------- Config ----------
INPUT_FILE = Path("pipeline_outputs/dedup_all.txt")
OUTPUT_FILE = Path("daily_digest.txt")

MODEL = "gpt-4o-mini"
TEMPERATURE = 0.0

SECTIONS = [
    "Market & Macro",
    "Corporate Actions & Announcements",
    "Earnings & Financial Performance",
    "Sector / Thematic Developments",
    "Policy / Regulatory",
    "Other Noteworthy Updates"
]
# ----------------------------

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def split_items(text):
    return [t.strip() for t in text.split("\n\n---\n\n") if t.strip()]


def classify_and_compress(item_text):
    prompt = f"""
You are preparing a factual daily finance digest.

Task:
1. Assign the text to ONE of these sections:
{", ".join(SECTIONS)}

2. Rewrite it as ONE concise bullet point.
Rules:
- Preserve factual content
- Do NOT add new information
- Do NOT speculate
- If unclear, stay close to original wording

Return exactly in this format:
SECTION: <section name>
BULLET: <single bullet sentence>

TEXT:
{item_text}
""".strip()

    response = client.chat.completions.create(
        model=MODEL,
        temperature=TEMPERATURE,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.choices[0].message.content.strip()
    return content


def main():
    raw_text = INPUT_FILE.read_text(encoding="utf-8")
    items = split_items(raw_text)

    grouped = {s: [] for s in SECTIONS}

    for item in items:
        result = classify_and_compress(item)

        lines = result.splitlines()
        section = lines[0].replace("SECTION:", "").strip()
        bullet = lines[1].replace("BULLET:", "").strip()

        if section not in grouped:
            section = "Other Noteworthy Updates"

        grouped[section].append(bullet)

    today = date.today().isoformat()

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        f.write(f"DAILY FINANCE DIGEST — {today}\n\n")

        for section in SECTIONS:
            if not grouped[section]:
                continue

            f.write(f"{section}\n")
            for b in grouped[section]:
                f.write(f"• {b}\n")
            f.write("\n")

    print("Phase 4 complete.")
    print(f"Digest written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()