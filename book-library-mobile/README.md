# BookShelf Scanner (Mobile + Secure Backend)

This app scans a book cover, sends it to a backend for AI extraction, auto-categorizes it, and stores it in folder sections.

## Security model

- OpenAI key is stored only on backend: `backend/.env`
- Mobile app never stores or sends OpenAI key
- Mobile app calls backend using `EXPO_PUBLIC_API_BASE_URL`

## Features

- Cover scan from camera
- AI extraction of title/author/description/category
- Auto-save into matching folder
- User can add/delete folders
- User can move books between folders
- Local persistence using AsyncStorage

## Project structure

- `App.tsx`: main app flow, folders UI, move-book UI
- `src/services/aiBookExtraction.ts`: backend API call
- `src/storage/libraryStore.ts`: books/folders persistence
- `backend/main.py`: FastAPI backend calling OpenAI

## 1) Start backend (secure key)

```bash
cd /Users/balajiakiri/Documents/New\ project/book-library-mobile/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set:

```env
OPENAI_API_KEY=your_real_key
OPENAI_MODEL=gpt-4.1-mini
PORT=8000
```

Run backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 2) Start mobile app

Find your laptop LAN IP (example `192.168.1.20`).

```bash
cd /Users/balajiakiri/Documents/New\ project/book-library-mobile
cp .env.example .env
```

Edit app `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000
```

Install and run:

```bash
npm install
npx expo start --clear --lan
```

## Notes

- Phone and laptop must be on same Wi-Fi.
- If camera capture opens crop UI on some phones, the app still works; cover image is sent after capture.
- If backend is unreachable, app shows an extraction error alert.
