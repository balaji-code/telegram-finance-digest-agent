import re
import json
from pathlib import Path
from datetime import date
from fpdf import FPDF
import unicodedata

# ---------- Paths ----------
INPUT_FILE = Path("daily_digest.txt")
OUTPUT_JSON = Path("pipeline_outputs/formatted_report.json")
OUTPUT_PDF = Path("pipeline_outputs/daily_report.pdf")
# ---------------------------


SECTION_HEADERS = [
    "Market & Macro",
    "Corporate Actions & Announcements",
    "Earnings & Financial Performance",
    "Sector / Thematic Developments",
    "Policy / Regulatory",
    "Other Noteworthy Updates",
]


COMPANY_PATTERN = re.compile(r"^([A-Z][A-Za-z &().-]{2,})")


def normalize_company_name(name: str) -> str:
    # Remove trailing reporting verbs / fragments accidentally captured
    name = re.split(
        r"\b(reported|announced|posted|saw|maintained|maintains|reported\s+Q\d*)\b",
        name,
        flags=re.IGNORECASE,
    )[0]
    return name.strip()


def parse_digest(text):
    sections = {}
    current_section = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        if line in SECTION_HEADERS:
            current_section = line
            sections[current_section] = []
        elif line.startswith("•") and current_section:
            sections[current_section].append(line[1:].strip())

    return sections


def group_by_company(items):
    grouped = {}
    ungrouped = []

    for item in items:
        match = COMPANY_PATTERN.match(item)
        if match:
            raw_company = match.group(1)
            company = normalize_company_name(raw_company)
            grouped.setdefault(company, []).append(item)
        else:
            ungrouped.append(item)

    return grouped, ungrouped


def format_report(sections):
    formatted = {}
    earnings_snapshot = []
    earnings_details = []

    for section, items in sections.items():
        if section == "Earnings & Financial Performance":
            for item in items:
                if any(x in item for x in ["YoY", "%", "Revenue", "PAT", "EBITDA"]):
                    earnings_snapshot.append(item)
                else:
                    earnings_details.append(item)
            continue

        grouped, ungrouped = group_by_company(items)
        formatted[section] = {
            "grouped": grouped,
            "other": ungrouped,
        }

    # Company-wise grouping for Earnings
    earnings_grouped = {}
    for item in earnings_snapshot + earnings_details:
        match = COMPANY_PATTERN.match(item)
        if match:
            raw_company = match.group(1)
            company = normalize_company_name(raw_company)
            earnings_grouped.setdefault(company, []).append(item)
        else:
            earnings_grouped.setdefault("Other Earnings", []).append(item)

    formatted["Earnings – Company-wise"] = earnings_grouped

    return formatted


def generate_pdf(report):
    def safe(text):
        if not text:
            return ""
        normalized = unicodedata.normalize("NFKD", text)
        return normalized.encode("latin-1", "ignore").decode("latin-1")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "DAILY FINANCE REPORT", ln=True)
    pdf.set_font("Arial", size=11)
    pdf.cell(0, 8, safe(date.today().isoformat()), ln=True)
    pdf.ln(6)

    for section, content in report.items():
        pdf.set_font("Arial", "B", 13)
        pdf.cell(0, 8, safe(section), ln=True)
        pdf.ln(2)

        if isinstance(content, list):
            pdf.set_font("Arial", size=10)
            for item in content:
                pdf.multi_cell(0, 6, safe(f"- {item}"))
            pdf.ln(4)
            continue

        # Company-wise earnings rendering
        if section == "Earnings – Company-wise":
            for company, bullets in content.items():
                pdf.set_font("Arial", "B", 11)
                pdf.cell(0, 7, safe(company), ln=True)

                pdf.set_font("Arial", size=10)
                for bullet in bullets:
                    pdf.multi_cell(0, 6, safe(f"  - {bullet}"))
                pdf.ln(3)
            continue

        for company, bullets in content.get("grouped", {}).items():
            pdf.set_font("Arial", "B", 11)
            pdf.cell(0, 7, safe(company), ln=True)

            pdf.set_font("Arial", size=10)
            for bullet in bullets:
                pdf.multi_cell(0, 6, safe(f"  - {bullet}"))
            pdf.ln(2)

        if content.get("other"):
            pdf.set_font("Arial", size=10)
            for bullet in content["other"]:
                pdf.multi_cell(0, 6, safe(f"- {bullet}"))
            pdf.ln(4)

    pdf.output(str(OUTPUT_PDF))


def main():
    raw_text = INPUT_FILE.read_text(encoding="utf-8")
    sections = parse_digest(raw_text)
    formatted = format_report(sections)

    OUTPUT_JSON.parent.mkdir(exist_ok=True)

    OUTPUT_JSON.write_text(
        json.dumps(formatted, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    generate_pdf(formatted)

    print("Step 5 complete:")
    print("✔ formatted_report.json created")
    print("✔ daily_report.pdf created")


if __name__ == "__main__":
    main()