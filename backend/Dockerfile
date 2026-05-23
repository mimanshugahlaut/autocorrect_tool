FROM python:3.12-slim

# Install Java 17+ for language-tool-python (LanguageTool 6.6+)
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download CoEdIT model at build time (avoids cold-start delay)
RUN python -c "\
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM; \
AutoTokenizer.from_pretrained('grammarly/coedit-large'); \
AutoModelForSeq2SeqLM.from_pretrained('grammarly/coedit-large')"

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
