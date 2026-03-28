"""
Schrollar Grounding API — DeBERTa-v3 NLI Verification Service
==============================================================
Endpoints:
  POST /verify        → Verify a full card (multiple claims vs source)
  POST /check-claim   → Check a single claim against source text
  GET  /health        → Health check

Example usage:
  curl -X POST http://localhost:8890/verify \
    -H "Content-Type: application/json" \
    -d '{
      "source_text": "Climate change increases global temperatures by 1.5°C...",
      "synthesis": "The study found that global temperatures rose by 1.5 degrees."
    }'
"""

import os
import re
import time
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer


# ── Config ──────────────────────────────────────────────────
THRESHOLD = float(os.getenv("ENTAILMENT_THRESHOLD", "0.85"))
MODEL_NAME = "cross-encoder/nli-deberta-v3-base"
# Labels: 0 = contradiction, 1 = entailment, 2 = neutral
ENTAILMENT_IDX = 1
CONTRADICTION_IDX = 0

# ── Global model references ─────────────────────────────────
tokenizer = None
model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, clean up on shutdown."""
    global tokenizer, model
    print(f"Loading {MODEL_NAME}...")
    start = time.time()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    model.eval()
    print(f"Model loaded in {time.time() - start:.1f}s")
    yield
    del model, tokenizer


app = FastAPI(
    title="Schrollar Grounding API",
    description="DeBERTa-v3 NLI verification for AI-generated research cards",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for local dev / Cloudflare tunnel access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ──────────────────────────────

class ClaimCheckRequest(BaseModel):
    """Check a single claim against source text."""
    source_text: str = Field(..., min_length=10, description="Original paper abstract or text")
    claim: str = Field(..., min_length=5, description="A single claim to verify")


class ClaimResult(BaseModel):
    claim: str
    entailment_score: float
    contradiction_score: float
    neutral_score: float
    verdict: str  # "entailed", "contradicted", or "neutral"
    passed: bool


class VerifyCardRequest(BaseModel):
    """Verify an entire AI-generated card against source text."""
    source_text: str = Field(..., min_length=10, description="Original paper abstract or full text")
    synthesis: str = Field(..., min_length=10, description="AI-generated card text to verify")
    threshold: float | None = Field(None, description="Override default threshold (0.0-1.0)")


class VerifyCardResponse(BaseModel):
    card_verified: bool
    threshold_used: float
    claims: list[ClaimResult]
    summary: str
    processing_time_ms: float


# ── Core logic ──────────────────────────────────────────────

def split_into_claims(text: str) -> list[str]:
    """Split synthesis text into individual verifiable claims."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    # Filter out very short fragments that aren't real claims
    return [s.strip() for s in sentences if len(s.strip()) > 15]


def check_entailment(source_text: str, claim: str) -> dict:
    """
    Score a single claim against source text using DeBERTa NLI.
    Returns probabilities for entailment, contradiction, and neutral.
    """
    # Truncate source to fit model's max context (512 tokens)
    # ~4 chars per token, leave room for claim + special tokens
    source_truncated = source_text[:1800]

    inputs = tokenizer(
        source_truncated,
        claim,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)[0]

    return {
        "entailment": probs[ENTAILMENT_IDX].item(),
        "contradiction": probs[CONTRADICTION_IDX].item(),
        "neutral": probs[2].item(),
    }


# ── Endpoints ───────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — confirms model is loaded and ready."""
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "threshold": THRESHOLD,
        "device": "cpu",
    }


@app.post("/check-claim", response_model=ClaimResult)
async def check_single_claim(req: ClaimCheckRequest):
    """
    Check a single claim against source text.
    Useful for real-time verification as the LLM generates.
    """
    scores = check_entailment(req.source_text, req.claim)

    # Determine verdict
    max_label = max(scores, key=scores.get)
    verdict = {
        "entailment": "entailed",
        "contradiction": "contradicted",
        "neutral": "neutral",
    }[max_label]

    return ClaimResult(
        claim=req.claim,
        entailment_score=round(scores["entailment"], 4),
        contradiction_score=round(scores["contradiction"], 4),
        neutral_score=round(scores["neutral"], 4),
        verdict=verdict,
        passed=scores["entailment"] >= THRESHOLD,
    )


@app.post("/verify", response_model=VerifyCardResponse)
async def verify_card(req: VerifyCardRequest):
    """
    Verify an entire AI-generated card.
    
    This is the core endpoint for Schrollar's grounding pipeline:
    1. Splits the synthesis into individual claims
    2. Checks each claim against the source text via NLI
    3. Returns pass/fail for the entire card
    
    A card passes ONLY if ALL claims score >= threshold.
    """
    start = time.time()
    threshold = req.threshold if req.threshold is not None else THRESHOLD

    claims = split_into_claims(req.synthesis)

    if not claims:
        raise HTTPException(
            status_code=400,
            detail="Could not extract any claims from the synthesis text. "
                   "Ensure it contains complete sentences.",
        )

    results: list[ClaimResult] = []
    all_pass = True

    for claim_text in claims:
        scores = check_entailment(req.source_text, claim_text)

        max_label = max(scores, key=scores.get)
        verdict = {
            "entailment": "entailed",
            "contradiction": "contradicted",
            "neutral": "neutral",
        }[max_label]

        passed = scores["entailment"] >= threshold
        if not passed:
            all_pass = False

        results.append(
            ClaimResult(
                claim=claim_text,
                entailment_score=round(scores["entailment"], 4),
                contradiction_score=round(scores["contradiction"], 4),
                neutral_score=round(scores["neutral"], 4),
                verdict=verdict,
                passed=passed,
            )
        )

    passed_count = sum(1 for r in results if r.passed)
    elapsed_ms = (time.time() - start) * 1000

    return VerifyCardResponse(
        card_verified=all_pass,
        threshold_used=threshold,
        claims=results,
        summary=f"{passed_count}/{len(results)} claims verified",
        processing_time_ms=round(elapsed_ms, 1),
    )
