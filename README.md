# 🤖 Autocorrect Tool — AI Writing Assistant

An AI-driven autocorrect tool that detects and fixes spelling, grammar, and contextual errors in real time using a three-tier NLP pipeline.

![Dark glassmorphism UI with error highlighting](./docs/screenshot.png)


## ✨ Features

| Feature | Description |
|---------|-------------|
| **Spell Check** | Instant detection via pyspellchecker (Levenshtein distance) |
| **Grammar Check** | Rule-based checking via LanguageTool (30+ languages) |
| **Context AI** | Deep correction via Grammarly's CoEdIT model (T5-based) |
| **Real-time** | 600ms debounced API calls for near-instant feedback |
| **Error Highlights** | Color-coded wavy/dashed underlines by error type |
| **Suggestion Popup** | Click any error for ranked suggestions |
| **Accept / Ignore** | Per-error and apply-all controls |
| **Custom Dictionary** | Add domain-specific words that won't be flagged |
| **Correction History** | Session history of accepted corrections |
| **Supabase** | Optional cloud persistence for history and dictionary |


## 🏗️ Architecture

```
Frontend (React + Vite + Slate.js)
       ↕ REST API (debounced 600ms)
Backend (FastAPI)
       ↕
  ┌────────────────────────────────┐
  │ Tier 1: pyspellchecker (fast)  │
  │ Tier 2: language-tool-python   │  ← concurrent
  │ Tier 3: grammarly/coedit-large │  ← sequential after
  └────────────────────────────────┘
       ↕
  Supabase (optional)
```


## 🚀 Quick Start

### Prerequisites


> To install Java on Windows: download from [adoptium.net](https://adoptium.net)


### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env if needed (Supabase credentials, model selection, etc.)

# Start the API server
uvicorn app.main:app --reload --port 8000
```

The backend will:
1. Load pyspellchecker (instant)
2. Start the LanguageTool Java server (~30s first run, downloads ~200MB)
3. Download and load `grammarly/coedit-large` (~1.5GB, first run only)

> **Tip**: Set `ENABLE_CONTEXT_MODEL=false` and/or `ENABLE_GRAMMAR_CHECK=false` in `.env` for faster startup during development.


### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
copy .env.example .env

# Start dev server
npm run dev
```

Visit **http://localhost:5173**


## 📡 API Reference

### `POST /api/check`
Check text for errors. Returns errors with character offsets and suggestions.

**Request:**
```json
{ "text": "I has a aple and he go to scool" }
```

**Response:**
```json
{
  "original_text": "I has a aple and he go to scool",
  "corrected_text": "I have an apple and he goes to school",
  "errors": [
    {
      "offset": 2, "length": 3, "original": "has",
      "suggestions": ["have"],
      "error_type": "grammar",
      "message": "Agreement error.",
      "rule_id": "HAVE_PART_AGREEMENT"
    }
  ],
  "error_counts": { "spelling": 2, "grammar": 1 }
}
```

### `POST /api/correct`
Return only the corrected text.

### `GET /api/history?limit=50&offset=0`
Get paginated correction history (requires Supabase).

### `POST /api/dictionary`
Add words to custom dictionary: `{ "words": ["supabase", "fastapi"] }`

### `GET /api/health`
Check service status and which NLP modules are active.


## ⚙️ Configuration

### Backend `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `HF_MODEL_NAME` | `grammarly/coedit-large` | HuggingFace model to use |
| `HF_DEVICE` | `cpu` | `cpu` or `cuda` |
| `ENABLE_GRAMMAR_CHECK` | `true` | Toggle LanguageTool |
| `ENABLE_CONTEXT_MODEL` | `true` | Toggle CoEdIT model |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |
| `SUPABASE_URL` | *(empty)* | Supabase project URL |
| `SUPABASE_KEY` | *(empty)* | Supabase anon key |

### Model Options

| Model | Size | RAM | Speed | Quality |
|-------|------|-----|-------|---------|
| `vennify/t5-base-grammar-correction` | 220MB | 4GB | Fast | ⭐⭐ |
| `grammarly/coedit-large` *(default)* | 1.5GB | 6GB | Medium | ⭐⭐⭐⭐ |
| `grammarly/coedit-xl` | 6GB | 16GB | Slow | ⭐⭐⭐⭐⭐ |


## 🧪 Testing

```bash
cd backend

# Activate venv first
venv\Scripts\activate

# Run all tests
python -m pytest tests/ -v

# Run only spell checker tests
python -m pytest tests/test_spell_checker.py -v

# Run API integration tests
python -m pytest tests/test_api.py -v
```


## 🐳 Docker (Backend)

```bash
cd backend
docker build -t autocorrect-backend .
docker run -p 8000:8000 --env-file .env autocorrect-backend
```


## 🚢 Deployment

### Frontend → Vercel
```bash
cd frontend && npm run build
# Deploy `dist/` folder to Vercel, or use Vercel CLI:
npx vercel --prod
```

Set `VITE_API_URL=https://your-backend.render.com` in Vercel environment variables.

### Backend → Render
1. Connect GitHub repo to Render
2. Set Build Command: `pip install -r requirements.txt`
3. Set Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`
5. Ensure **Java 17** is available (use Docker deployment on Render for this)


## 🗄️ Supabase Schema

```sql
CREATE TABLE correction_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  errors_count INTEGER DEFAULT 0,
  error_types JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE custom_dictionary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word VARCHAR(100) NOT NULL UNIQUE,
  added_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_correction_history_created_at
  ON correction_history(created_at DESC);
```


## 📁 Project Structure

```
autocorrect-tool/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + lifespan model loading
│   │   ├── config.py          # Settings from environment
│   │   ├── models.py          # Pydantic schemas
│   │   ├── nlp/
│   │   │   ├── spell_checker.py    # pyspellchecker wrapper
│   │   │   ├── grammar_checker.py  # language-tool-python wrapper
│   │   │   ├── context_model.py    # CoEdIT (T5) model wrapper
│   │   │   └── pipeline.py         # Tiered NLP orchestrator
│   │   ├── routers/
│   │   │   ├── check.py       # POST /api/check + /api/correct
│   │   │   └── history.py     # GET/POST /api/history + /api/dictionary
│   │   ├── services/
│   │   │   └── supabase_client.py
│   │   └── middleware/
│   │       └── rate_limiter.py
│   ├── tests/
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── api/autocorrect.js       # Axios API client
    │   ├── components/
    │   │   ├── Editor/              # Slate.js editor + error highlights
    │   │   ├── Header/              # Top nav with live stats
    │   │   └── Sidebar/             # Errors / History / Settings tabs
    │   ├── hooks/
    │   │   ├── useDebounce.js
    │   │   └── useAutocorrect.js
    │   ├── context/CorrectionContext.jsx
    │   └── utils/errorTypes.js
    └── vite.config.js
```


## 🔬 Algorithms

| Algorithm | Module | Purpose |
|-----------|--------|---------|
| Levenshtein distance | pyspellchecker | Find closest word for misspellings |
| Rule-based grammar | LanguageTool | Structural grammar, punctuation, style |
| Encoder-decoder T5 | CoEdIT model | Deep contextual correction |
| SequenceMatcher diff | difflib | Map AI corrections to character offsets |


## 📄 License

MIT
