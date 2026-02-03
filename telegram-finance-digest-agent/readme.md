Telegram Finance Digest Agent

A practical AI pipeline that ingests image-heavy Telegram finance channels, extracts signal using OCR and semantic de-duplication, and produces a clean daily intelligence-ready corpus for downstream summarization and analysis.

This project focuses on real-world data ingestion and hygiene, not toy prompts.

⸻

Why this project exists

Most finance-related Telegram channels publish:
	•	screenshots instead of text
	•	repeated headlines with minor wording changes
	•	high noise-to-signal ratio

Naively “summarizing Telegram” fails because:
	•	OCR output is noisy
	•	the same news appears dozens of times
	•	LLMs overweight repetition

This project solves that problem systematically.

⸻

What the pipeline does

1. Telegram ingestion (API-based)
	•	Uses Telegram API (Telethon)
	•	Downloads only today’s messages
	•	Handles hundreds of images per day
	•	Secure credential handling via .env

2. OCR extraction
	•	Converts images → raw text using Tesseract OCR
	•	Preserves all extracted signal (lossless at this stage)

3. OCR cleanup (rule-based)
	•	Removes OCR junk characters
	•	Normalizes whitespace
	•	Eliminates obvious noise
	•	Keeps content readable and structured

4. Semantic de-duplication (Phase 2)
	•	Splits content into paragraphs
	•	Uses sentence embeddings (sentence-transformers)
	•	Removes near-duplicate ideas using cosine similarity
	•	Retains one representative paragraph per idea

5. Daily corpus generation
	•	Merges cleaned OCR text + native Telegram text
	•	Produces a single daily file ready for:
	•	thematic consolidation
	•	summarization
	•	trend analysis
	•	agent-based reasoning

⸻

Project structure
.
├── telegram_ingest/
│   ├── download.py          # Telegram API ingestion (date-restricted)
│   ├── ocr.py               # Image → text OCR
│   ├── clean_ocr.py         # OCR cleanup & normalization
│   ├── phase2_dedup.py      # Semantic paragraph de-duplication
│   └── merge_daily.py       # Daily corpus creation
│
├── daily_inputs/            # Generated data (gitignored)
│   ├── *.jpg
│   ├── image_text_clean.txt
│   ├── image_text_dedup.txt
│   └── daily_YYYY-MM-DD.txt
│
├── .env                     # API credentials (gitignored)
├── .gitignore
└── README.md

Technologies used
	•	Telethon – Telegram API client
	•	Tesseract OCR – image text extraction
	•	sentence-transformers – semantic similarity & de-duplication
	•	Python – pipeline orchestration

LLMs are intentionally not used in early stages to:
	•	reduce cost
	•	improve determinism
	•	avoid overfitting noise

⸻

Security & best practices
	•	Telegram API credentials loaded via .env
	•	Session files and raw data excluded from Git
	•	No secrets committed
	•	Stateless daily ingestion (idempotent)

⸻

What this is not
	•	❌ Not a trading bot
	•	❌ Not financial advice
	•	❌ Not a generic “AI summarizer”

This is an ingestion + signal preparation system.

⸻

Current status
	•	✅ Telegram ingestion working
	•	✅ OCR pipeline stable
	•	✅ Semantic de-duplication validated
	•	⏳ Phase 3: thematic consolidation (next)
	•	⏳ Daily summary agent (planned)

⸻

Who this is for
	•	AI builders working with messy real-world data
	•	Developers interested in agents + pipelines
	•	Anyone trying to extract signal from Telegram / WhatsApp-style feeds

⸻

Philosophy

Compression before cognition.
Clean signal before intelligence.
Determinism before cleverness.