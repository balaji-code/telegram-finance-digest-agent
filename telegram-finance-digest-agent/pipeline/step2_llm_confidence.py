import json
import os
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()

# ---------- Config ----------
INPUT_FILE = Path("pipeline_outputs/raw_ocr.json")
OUTPUT_DIR = Path("pipeline_outputs")

MODEL = "gpt-4o-mini"  # cheap + sufficient
TEMPERATURE = 0.0

OUTPUT_DIR.mkdir(exist_ok=True)

def obvious_garbage(text: str) -> bool:
    if not text:
        return True

    words = text.split()
    alpha_ratio = sum(c.isalpha() for c in text) / max(len(text), 1)

    # Allow short but meaningful announcements
    if len(words) >= 12 and alpha_ratio >= 0.35:
        return False

    # Quarantine only extreme OCR collapse
    return alpha_ratio < 0.25

def extract_semantic_core(text: str, max_lines: int = 6) -> str:
    """
    Keep only the top meaningful lines.
    This removes watermark/footer/ticker garbage that appears later in OCR.
    """
    lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 3]
    return "\n".join(lines[:max_lines])

# ---------- Load OCR ----------
with INPUT_FILE.open() as f:
    ocr_items = json.load(f)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

usable = []
partial = []
quarantine = []

# ---------- Prompt ----------
PROMPT_TEMPLATE = """
You are evaluating OCR output extracted from financial news images.

Classify the text into EXACTLY ONE category based on summarization safety.

USABLE:
- Grammatically readable
- Facts are explicit and extractable
- Safe to summarize without guessing

PARTIAL:
- Some OCR noise
- Short announcements or headlines are acceptable
- Meaning is still clear with LOW hallucination risk

UNUSABLE:
- Heavy OCR corruption or broken language
- Meaning requires reconstruction or guessing
- HIGH risk of hallucination if summarized

If you would hesitate to summarize this text accurately, classify it as UNUSABLE.

Return ONLY one word: USABLE, PARTIAL, or UNUSABLE.

TEXT:
{ocr_text}
""".strip()

# ---------- Classification Loop ----------
for item in ocr_items:
    text = item.get("text", "").strip()

    heuristic_flag = obvious_garbage(text)

    llm_text = extract_semantic_core(text)

    response = client.chat.completions.create(
        model=MODEL,
        temperature=TEMPERATURE,
        messages=[
            {"role": "user", "content": PROMPT_TEMPLATE.format(ocr_text=llm_text)}
        ],
    )

    label = response.choices[0].message.content.strip().upper()

    if label not in {"USABLE", "PARTIAL", "UNUSABLE"}:
        label = "UNUSABLE"  # fail-safe

    # Heuristic is advisory only; LLM has final authority
    if heuristic_flag and label != "UNUSABLE":
        label = "PARTIAL"

    item["llm_confidence"] = label

    if label == "USABLE":
        usable.append(item)
    elif label == "PARTIAL":
        partial.append(item)
    else:
        quarantine.append(item)

# ---------- Write Outputs ----------
(OUTPUT_DIR / "usable.json").write_text(json.dumps(usable, indent=2))
(OUTPUT_DIR / "partial.json").write_text(json.dumps(partial, indent=2))
(OUTPUT_DIR / "quarantine.json").write_text(json.dumps(quarantine, indent=2))

print(f"USABLE: {len(usable)}")
print(f"PARTIAL: {len(partial)}")
print(f"UNUSABLE: {len(quarantine)}")