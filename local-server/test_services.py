#!/usr/bin/env python3
"""
Quick smoke test for all Schrollar services.
Run after `docker compose up -d`:

    python test_services.py
"""

import json
import sys
import urllib.request
import urllib.error

SERVICES = {
    "Ollama (Qwen3.5)": {
        "url": "http://localhost:11434/api/tags",
        "method": "GET",
    },
    "SearXNG": {
        "url": "http://localhost:8888/search?q=test&format=json",
        "method": "GET",
    },
    "DeBERTa NLI": {
        "url": "http://localhost:8890/health",
        "method": "GET",
    },
}


def test_service(name: str, config: dict) -> bool:
    try:
        req = urllib.request.Request(config["url"], method=config["method"])
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            print(f"  ✅ {name} — OK")
            if name == "DeBERTa NLI":
                print(f"     Model: {data.get('model', '?')}, Threshold: {data.get('threshold', '?')}")
            if name == "SearXNG":
                n = len(data.get("results", []))
                print(f"     Returned {n} search results")
            if name == "Ollama (Qwen3.5)":
                models = [m["name"] for m in data.get("models", [])]
                print(f"     Models: {', '.join(models) or 'none pulled yet'}")
            return True
    except urllib.error.URLError as e:
        print(f"  ❌ {name} — FAILED ({e.reason})")
        return False
    except Exception as e:
        print(f"  ❌ {name} — FAILED ({e})")
        return False


def test_grounding_pipeline() -> bool:
    """End-to-end test: verify a card through DeBERTa."""
    print("\n🔬 Testing grounding pipeline (end-to-end)...")
    try:
        payload = json.dumps({
            "source_text": (
                "This study found that regular exercise reduces the risk of "
                "cardiovascular disease by 30% in adults over 50. The research "
                "was conducted over a 10-year period with 5000 participants."
            ),
            "synthesis": (
                "Regular exercise cuts heart disease risk by 30% in older adults. "
                "The study tracked 5000 people over a decade."
            ),
        }).encode()

        req = urllib.request.Request(
            "http://localhost:8890/verify",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            verified = data["card_verified"]
            summary = data["summary"]
            ms = data["processing_time_ms"]

            if verified:
                print(f"  ✅ Card VERIFIED — {summary} (took {ms:.0f}ms)")
            else:
                print(f"  ⚠️  Card REJECTED — {summary} (took {ms:.0f}ms)")

            for claim in data["claims"]:
                icon = "✅" if claim["passed"] else "❌"
                print(f"     {icon} [{claim['entailment_score']:.3f}] {claim['claim'][:70]}...")
            return True

    except Exception as e:
        print(f"  ❌ Grounding test FAILED — {e}")
        return False


if __name__ == "__main__":
    print("🚀 Schrollar Service Health Check\n")
    print("=" * 50)

    all_ok = True
    for name, config in SERVICES.items():
        if not test_service(name, config):
            all_ok = False

    test_grounding_pipeline()

    print("\n" + "=" * 50)
    if all_ok:
        print("🎉 All services are running! Ready to build Schrollar.")
    else:
        print("⚠️  Some services are down. Check Docker Desktop and try:")
        print("   docker compose up -d --build")
        print("   docker compose logs -f")

    sys.exit(0 if all_ok else 1)
