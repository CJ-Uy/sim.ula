# Schrollar Infrastructure Setup Guide

## SearXNG + DeBERTa NLI on Docker Desktop

### Prerequisites

- Docker Desktop installed and running
- Ollama already running on localhost:11434 with `qwen3.5:9b`
- Cloudflare tunnel (`cloudflared`) installed

---

## Step 1: Start Everything (One Command)

```bash
cd schrollar-infra
docker compose up -d --build
```

First run will take ~5-10 minutes (downloads DeBERTa model + SearXNG image).
Subsequent starts take seconds.

### What Gets Created

| Service           | Local URL              | What It Does                    |
| ----------------- | ---------------------- | ------------------------------- |
| SearXNG           | http://localhost:8888  | Free unlimited web search API   |
| DeBERTa NLI       | http://localhost:8890  | Fact-grounding verification API |
| Ollama (existing) | http://localhost:11434 | Qwen3.5 9B LLM                  |

---

## Step 2: Verify Everything Works

### Test SearXNG

```bash
curl "http://localhost:8888/search?q=climate+change+research&format=json" | python -m json.tool | head -30
```

You should see JSON with search results from Google, Bing, DuckDuckGo, Google Scholar, etc.

### Test DeBERTa NLI

```bash
curl -X POST http://localhost:8890/verify \
  -H "Content-Type: application/json" \
  -d '{
    "source_text": "This study found that regular exercise reduces the risk of cardiovascular disease by 30% in adults over 50. The research was conducted over a 10-year period with 5000 participants.",
    "synthesis": "Regular exercise cuts heart disease risk by 30% in older adults. The study tracked 5000 people over a decade."
  }'
```

Expected: `"card_verified": true` with both claims showing high entailment scores.

### Test a FAILING card (hallucinated claim)

```bash
curl -X POST http://localhost:8890/verify \
  -H "Content-Type: application/json" \
  -d '{
    "source_text": "This study found that regular exercise reduces the risk of cardiovascular disease by 30% in adults over 50.",
    "synthesis": "Exercise reduces heart disease risk by 50% and also prevents cancer."
  }'
```

Expected: `"card_verified": false` — the "50%" and "prevents cancer" claims should fail.

### Health Check

```bash
curl http://localhost:8890/health
```

---

## Step 3: Cloudflare Tunnel Each Service

Since you already tunnel Ollama, do the same for these:

```bash
# Terminal 1: SearXNG tunnel
cloudflared tunnel --url http://localhost:8888

# Terminal 2: DeBERTa tunnel
cloudflared tunnel --url http://localhost:8890

# Terminal 3: Ollama (you already have this)
cloudflared tunnel --url http://localhost:11434
```

Each command prints a public URL like `https://xxx-xxx.trycloudflare.com`.
Use these URLs in your Next.js frontend's environment variables:

```env
# .env.local in your Next.js app
SEARXNG_URL=https://your-searxng-tunnel.trycloudflare.com
DEBERTA_URL=https://your-deberta-tunnel.trycloudflare.com
OLLAMA_URL=https://your-ollama-tunnel.trycloudflare.com
```

---

## Step 4: Using from Your Backend

### SearXNG Search API

```python
import httpx

async def web_search(query: str, num_results: int = 5) -> list[dict]:
    """Search the web via SearXNG — free and unlimited."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SEARXNG_URL}/search",
            params={
                "q": query,
                "format": "json",
                "categories": "general,science",
                "language": "en",
                "pageno": 1,
            },
            timeout=10,
        )
        results = resp.json().get("results", [])[:num_results]
        return [
            {
                "title": r["title"],
                "url": r["url"],
                "snippet": r.get("content", ""),
                "engine": r.get("engine", ""),
            }
            for r in results
        ]
```

### DeBERTa Verification API

```python
import httpx

async def verify_card(source_text: str, synthesis: str) -> dict:
    """Verify an AI-generated card against source text."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DEBERTA_URL}/verify",
            json={
                "source_text": source_text,
                "synthesis": synthesis,
            },
            timeout=30,
        )
        return resp.json()

# Usage
result = await verify_card(
    source_text=paper["abstract"],
    synthesis=llm_output,
)
if result["card_verified"]:
    # Publish card to feed
    ...
else:
    # Retry with stricter prompt, or reject
    ...
```

### Single Claim Check (for real-time streaming verification)

```python
async def check_claim(source_text: str, claim: str) -> dict:
    """Check a single claim — useful during LLM streaming."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DEBERTA_URL}/check-claim",
            json={"source_text": source_text, "claim": claim},
            timeout=10,
        )
        return resp.json()
```

---

## Common Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f searxng
docker compose logs -f deberta-nli

# Stop all services
docker compose down

# Restart a specific service
docker compose restart searxng

# Rebuild DeBERTa after code changes
docker compose up -d --build deberta-nli

# Check status
docker compose ps

# Full cleanup (removes volumes/cached models too)
docker compose down -v
```

---

## Architecture Overview

```
Your Laptop (32GB RAM)
├── Ollama (native)          → localhost:11434  → tunnel → https://xxx.trycloudflare.com
├── Docker Desktop
│   ├── SearXNG              → localhost:8888   → tunnel → https://yyy.trycloudflare.com
│   └── DeBERTa NLI (FastAPI)→ localhost:8890   → tunnel → https://zzz.trycloudflare.com
│
Next.js Frontend (Vercel / local)
  └── Calls all 3 services via Cloudflare tunnel URLs
```

---

## Troubleshooting

### SearXNG returns no results

- Some engines may be blocked in your region. Check logs: `docker compose logs searxng`
- Try disabling Google and using only DuckDuckGo in `searxng/settings.yml`

### DeBERTa is slow

- First request takes ~2-3 seconds (model warmup). Subsequent requests: ~200-500ms per claim.
- For faster inference, uncomment the GPU section in docker-compose.yml (requires NVIDIA GPU + nvidia-container-toolkit)

### Port conflicts

- If 8888 is taken: change the left side of the port mapping in docker-compose.yml, e.g., `"9999:8080"`
- If 8890 is taken: change to `"9890:8890"`

### Docker Desktop memory

- Ensure Docker Desktop is allocated at least 8GB RAM in Settings → Resources
- SearXNG uses ~200MB, DeBERTa uses ~1-2GB
