Telegram Finance Digest Agent

A production-grade personal intelligence pipeline that ingests image-heavy Telegram finance channels, extracts signal using OCR and semantic de-duplication, and produces a clean, readable daily finance report (TXT + PDF) with zero hallucination.

This project focuses on real-world data hygiene, determinism, and presentation — not toy prompts or speculative AI summaries.

⸻

Why this project exists

Most finance-related Telegram channels publish:
• screenshots instead of text  
• repeated headlines with minor wording changes  
• dense broker notes and TV captures  
• extremely high noise-to-signal ratio  

Naively “summarizing Telegram” fails because:
• OCR output is noisy  
• the same news appears dozens of times  
• LLMs overweight repetition and hallucinate context  

This project solves that problem systematically by enforcing:
signal cleanliness → de-duplication → controlled presentation.

⸻

What the pipeline does (end-to-end)

1. Telegram ingestion (API-based)
• Uses Telegram API (Telethon)
• Downloads only today’s messages
• Handles hundreds of images per day
• Secure credential handling via .env
• Stateless, repeatable daily runs

2. OCR extraction
• Converts images → raw text using Tesseract OCR
• Preserves all extracted signal (lossless stage)
• No correction or guessing at this step

3. OCR confidence classification
• Classifies OCR output into:
  – USABLE
  – PARTIAL
  – QUARANTINED
• Uses LLM-based semantic judgment
• Prevents unreadable OCR from polluting downstream steps
• Quarantined content is never discarded, only excluded

4. Semantic de-duplication
• Splits text into paragraphs
• Uses sentence embeddings (sentence-transformers)
• Removes near-duplicate ideas using cosine similarity
• Aggressive de-duplication for clean text
• Conservative de-duplication for partial text
• Guarantees no loss of unique information

5. Daily digest generation
• Converts deduplicated content into a factual daily digest
• Bullet-style, no creative rewriting
• Sectioned by:
  – Market & Macro
  – Corporate Actions
  – Earnings
  – Sector / Themes
  – Policy / Regulatory
• LLM used only for classification + compression
• Temperature = 0 (deterministic)

6. Company-wise consolidation (presentation-only)
• Groups all earnings and updates by company
• Eliminates repetition without summarizing
• One company = one block
• No inference, no editorial judgment

7. Report formatting & export
• Produces:
  – daily_digest.txt (audit-friendly)
  – daily_report.pdf (human-readable)
• PDF rendering handles Unicode safely
• Presentation improvements only, no intelligence added

8. Optional local UI (Streamlit)
• One-click “Run Full Pipeline”
• One-click “Generate Today’s Digest”
• View output on screen
• Download TXT or PDF
• UI is a thin wrapper — pipeline remains headless

⸻

Project structure (current)

telegram-finance-digest-agent/
├── pipeline/
│   ├── step0_download_images.py
│   ├── step1_ocr.py
│   ├── step2_llm_confidence.py
│   ├── step3_semantic_dedup.py
│   ├── step4_daily_digest.py
│   ├── step5_format_report.py
│   └── run_full_pipeline.py
│
├── pipeline_outputs/         # Generated artifacts (gitignored)
│   ├── usable.json
│   ├── partial.json
│   ├── quarantine.json
│   ├── formatted_report.json
│   └── daily_report.pdf
│
├── daily_inputs/             # Raw Telegram images (gitignored)
│   └── *.jpg
│
├── ui/
│   └── app.py                # Local Streamlit UI
│
├── .env                      # API credentials (gitignored)
├── .gitignore
└── README.md

⸻

Technologies used

• Telethon — Telegram API client  
• Tesseract OCR — image → text extraction  
• sentence-transformers — semantic embeddings & de-duplication  
• OpenAI API — controlled classification & compression  
• FPDF — PDF report generation  
• Streamlit — local UI  
• Python — orchestration  

⸻

Design principles

• Compression before cognition  
• Clean signal before intelligence  
• Determinism before cleverness  
• Presentation without hallucination  
• Pipelines before agents  

⸻

What this project is NOT

• ❌ Not a trading bot  
• ❌ Not financial advice  
• ❌ Not a generic AI “summarizer”  
• ❌ Not a chat interface  

This is a **signal preparation + reporting system**.

⸻

Current status

• ✅ End-to-end pipeline stable  
• ✅ OCR confidence gating validated  
• ✅ Semantic de-duplication validated  
• ✅ Company-wise consolidation implemented  
• ✅ Daily PDF report generation stable  
• ✅ Local UI integrated  
• 🔒 Pipeline frozen (presentation-only changes allowed)

⸻

Who this is for

• Builders working with messy real-world data  
• Developers interested in pipelines over prompts  
• Analysts drowning in Telegram noise  
• Anyone who values correctness over cleverness  

⸻

Philosophy

Clean signal is intelligence.
Intelligence without hygiene is noise.