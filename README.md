# 🤖 Autocorrect Tool — AI Writing Assistant

[![CI](https://github.com/mimanshugahlaut/autocorrect_tool/actions/workflows/ci.yml/badge.svg)](https://github.com/mimanshugahlaut/autocorrect_tool/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)

An AI-driven autocorrect tool that detects and fixes spelling, grammar, and contextual errors in real time using a three-tier NLP pipeline.

> **Live demo:** _deploy the backend to Render and the frontend to Vercel — see the [Deployment](#-deployment-100-free-hosting) section below._


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

### Launch as a Browser Extension

#### Option A: Quick Install (Pre-packaged ZIP)
1. Download the pre-built extension package **[dist.zip](extension/dist.zip)** (or get it from the GitHub Releases page).
2. Extract the `dist.zip` file to a folder on your computer.
3. Open Chrome or Edge and go to `chrome://extensions` (or `edge://extensions`).
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** (top-left button).
6. Select the extracted folder containing the extension files.

#### Option B: Build from Source
```bash
cd extension
npm install
npm run build
```
Then open Chrome or Edge, go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `extension/dist`.

The extension works in two modes:

- Backend-enhanced mode: if the FastAPI backend is running on `http://127.0.0.1:8000`, the extension uses spelling, lightweight grammar, common typo, and optional AI/context checks.
- Offline fallback mode: if the backend is unavailable, the extension uses its bundled dictionary for local spelling checks.

For best correction quality while testing the extension, start the backend first.

### Prerequisites

| Dependency | Minimum Version | Notes |
|------------|----------------|-------|
| **Python** | 3.12 | Backend runtime |
| **Java** | 17+ | Required by LanguageTool (grammar checker) |
| **Node.js** | 20+ | Frontend and extension builds |
| **npm** | 9+ | Package manager |

> To install Java on Windows: download from [adoptium.net](https://adoptium.net)
>
> **Tip:** Set `ENABLE_GRAMMAR_CHECK=false` and `ENABLE_CONTEXT_MODEL=false` in `.env` to skip Java and the 1.5GB AI model during development.


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

The app also includes lightweight built-in rules that work even when the heavy grammar/context systems are disabled:

- Capitalizes standalone `i` to `I`
- Fixes repeated words such as `a a`
- Fixes simple article agreement such as `a apple` to `an apple`
- Corrects common typing mistakes such as `th` to `the` and `perosm` to `person`


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

### `DELETE /api/history`
Clear all correction history.

### `POST /api/dictionary`
Add words to custom dictionary: `{ "words": ["supabase", "fastapi"] }`

### `GET /api/dictionary`
Return all custom dictionary words.

### `DELETE /api/dictionary/{word}`
Remove a word from the custom dictionary.

### `GET /api/health`
Check service status and which NLP modules are active.

### `GET /api/stats`
Return backend capability flags (useful for the frontend status display).



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


## 🚢 Deployment (100% Free Hosting)

### 1. Database → Supabase (Free Tier)
1. Sign up on [supabase.com](https://supabase.com) and create a free project.
2. Open the **SQL Editor** in the Supabase Dashboard and run the query in the [Supabase Schema](#️-supabase-schema) section below to set up tables.
3. Obtain your `SUPABASE_URL` and `SUPABASE_KEY` (Anon Key) from Project Settings -> API.

### 2. Backend → Hugging Face Spaces (Free 16GB RAM, Full AI Enabled)
This is the **highly recommended** method to run the backend for free, as Hugging Face provides **16GB of RAM** which can comfortably run our 1.5GB `grammarly/coedit-large` deep grammar AI model.

1. Sign up/log in on [huggingface.co](https://huggingface.co).
2. Go to **Spaces** -> **New Space**.
3. Set Space Name (e.g. `autocorrect-backend`), and select **Docker** as the SDK.
4. Select **Blank** template (or choose Docker).
5. Set Space visibility to **Public** (required for API access).
6. Clone the Space repository, copy the backend directory contents along with `Dockerfile.hf` (rename it to `Dockerfile`), and push to Hugging Face!
7. Or, connect it to your GitHub repository and build using the provided `Dockerfile.hf`.
8. Set Space variables (Settings -> Variables and Secrets):
   - `ENABLE_CONTEXT_MODEL` = `true`
   - `ENABLE_GRAMMAR_CHECK` = `true`
   - `SUPABASE_URL` = *(your Supabase URL)*
   - `SUPABASE_KEY` = *(your Supabase Key)*

### 3. Backend → Render (Free 512MB RAM, Lightweight Mode)
Render provides free web service hosting, but has a 512MB RAM limit. To prevent Out-Of-Memory crashes, we must disable the deep AI model (`ENABLE_CONTEXT_MODEL=false`).

1. Connect your GitHub repository to [Render.com](https://render.com).
2. Create a new **Web Service** and choose **Docker** as the runtime.
3. Specify `backend/Dockerfile` as the Dockerfile path.
4. Render will automatically read the `render.yaml` blueprint to set:
   - `ENABLE_CONTEXT_MODEL` = `false`
   - `ENABLE_GRAMMAR_CHECK` = `true`
   - `SUPABASE_URL` & `SUPABASE_KEY` (add these in Render environment variables)

### 4. Frontend → Vercel or Netlify (Free Tier)
1. Sign up on [Vercel](https://vercel.com) or [Netlify](https://netlify.com) and connect your GitHub repository.
2. Set the build directory/root directory to `frontend`.
3. Add the following **Environment Variable** in the Vercel/Netlify dashboard:
   - `VITE_API_URL` = `https://your-backend-url.hf.space` (or your Render URL)
4. Deploy the project!


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


## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Open a pull request against `main`

Please run the test suite before submitting:
```bash
cd backend && python -m pytest tests/ -v
```


## 📄 License

MIT — see [LICENSE](LICENSE)
