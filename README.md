# Autocorrect Tool

Autocorrect Tool is a writing assistant with three parts:

* a FastAPI backend that detects spelling, grammar, and context issues
* a React + Vite frontend for interactive editing and correction review
* a Chrome extension that checks text in any input field, with offline fallback support

The backend uses a tiered NLP pipeline:

* `pyspellchecker` for fast spell checking
* lightweight deterministic rules for common typing mistakes
* optional `language-tool-python` grammar checks
* optional contextual correction with a Hugging Face model (`grammarly/coedit-large` by default)


## Features

* Real-time text checking with debounced API calls
* Spell, grammar, and context issue detection
* Ranked suggestions and apply-all support
* Custom dictionary support
* Session correction history in the frontend
* Optional Supabase persistence for history and dictionary words
* Browser extension mode for textarea and contenteditable fields
* Offline extension fallback using a bundled dictionary and lightweight rules


## Project Layout

```text
backend/    FastAPI API, NLP pipeline, tests, Dockerfile
frontend/   React + Vite app for writing and correction review
extension/  Chrome extension popup, content script, background service worker
```


## Requirements

* Python 3.12
* Node.js 20+
* npm 9+
* Java 17+ if you enable grammar checking with LanguageTool

If you want a lighter local setup, set `ENABLE_GRAMMAR_CHECK=false` and `ENABLE_CONTEXT_MODEL=false` in the backend environment.


## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

The backend exposes the API under `http://127.0.0.1:8000`.


## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

`frontend/.env.example` already documents the only frontend variable:

* `VITE_API_URL` - optional backend URL override. Leave it empty for local development because the Vite dev server proxies `/api` requests to the backend.


## Chrome Extension Setup

```bash
cd extension
npm install
npm run build
```

Then load the generated `extension/dist` folder as an unpacked extension in Chrome or Edge.

The extension tries the backend first. If the backend is unavailable, it falls back to its bundled dictionary and lightweight rules.


## Environment Variables

### Backend (`backend/.env`)

* `APP_DEBUG` - enable or disable debug mode
* `CORS_ORIGINS` - comma-separated allowed frontend origins
* `HF_MODEL_NAME` - Hugging Face model name
* `HF_DEVICE` - `cpu` or `cuda`
* `ENABLE_GRAMMAR_CHECK` - enable LanguageTool checks
* `ENABLE_CONTEXT_MODEL` - enable the contextual correction model
* `RATE_LIMIT_CHECK` - rate limit for `/api/check`
* `RATE_LIMIT_CORRECT` - rate limit for `/api/correct`
* `SUPABASE_URL` - optional Supabase project URL
* `SUPABASE_KEY` - optional Supabase anon key

### Frontend (`frontend/.env`)

* `VITE_API_URL` - optional backend base URL


## API Endpoints

All routes are served under `/api`.

### Correction

* `POST /api/check` - return detected issues, suggestions, and a corrected text version
* `POST /api/correct` - return only the corrected text

### History and Dictionary

* `GET /api/history?limit=50&offset=0` - fetch paginated correction history
* `DELETE /api/history` - clear correction history
* `POST /api/dictionary` - add words to the custom dictionary
* `GET /api/dictionary` - list custom dictionary words
* `DELETE /api/dictionary/{word}` - remove a dictionary word

### System

* `GET /api/health` - backend health and feature availability
* `GET /api/stats` - capability flags for the frontend


## Testing

```bash
cd backend
venv\Scripts\activate
python -m pytest tests/ -v
```

Useful targeted tests:

```bash
python -m pytest tests/test_api.py -v
python -m pytest tests/test_spell_checker.py -v
python -m pytest tests/test_lightweight_rules.py -v
```

The repository CI also runs:

* backend linting with `ruff`
* backend type checking with `mypy`
* frontend build verification
* extension build verification


## Deployment Notes

The repo includes a Render deployment manifest for the backend in `render.yaml`.

For production, configure:

* backend origin allowlists in `CORS_ORIGINS`
* frontend `VITE_API_URL` to the deployed backend URL
* Supabase credentials if you want persistent history and dictionary storage


## Implementation Notes

* The backend pipeline runs spell checking and lightweight rules concurrently, then applies optional grammar and context checks.
* Correction history is only persisted when Supabase is configured.
* Removing a dictionary word from the backend removes it from Supabase, but the in-memory spell checker still needs a restart to fully forget it.
