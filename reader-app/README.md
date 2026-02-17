# Reader App (PDF/EPUB + Notes + Vocabulary)

This is a v1 scaffold for a reader app where users can:
- Upload PDF/EPUB documents
- Save highlights with page references
- Add notes linked to page or highlight
- Look up highlighted words and build a vocabulary list

## Project structure

- `frontend`: React + TypeScript (Vite)
- `backend`: Node.js + Express + file upload + JSON store

## Run locally

1. Install dependencies:

```bash
cd reader-app
npm install
```

2. Start backend:

```bash
npm run dev:backend
```

3. Start frontend (new terminal):

```bash
npm run dev:frontend
```

Frontend proxies `/api` and `/uploads` to backend in dev mode.

## Current v1 behavior

- PDF reader is rendered in-app with page navigation.
- EPUB reader is rendered in-app with next/previous navigation.
- Select text in the reader, click `Use selected text`, then save highlight/note.
- Word lookup supports one word at a time via backend dictionary fetch.

## Next implementation steps

1. Add true text-layer selection and anchor mapping for PDF (`pdf.js`) and EPUB (`epub.js`).
2. Persist by real DB (PostgreSQL) + auth.
3. Add spaced repetition for saved vocabulary.
4. Add search across notes/highlights.
