FROM python:3.11-slim

WORKDIR /app

# Install everything except torch from PyPI
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    transformers \
    pydantic

# Install torch separately from PyTorch's CPU repo
RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cpu

COPY app.py .

# Download model at build time
RUN python -c "\
from transformers import AutoTokenizer, AutoModelForSequenceClassification; \
AutoTokenizer.from_pretrained('cross-encoder/nli-deberta-v3-base'); \
AutoModelForSequenceClassification.from_pretrained('cross-encoder/nli-deberta-v3-base'); \
print('Model downloaded successfully')"

EXPOSE 8890

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8890"]