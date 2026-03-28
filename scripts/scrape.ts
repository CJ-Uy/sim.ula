#!/usr/bin/env npx tsx
/**
 * Local CLI scraper for sim.ula
 *
 * Usage:
 *   npx tsx scripts/scrape.ts                        # Full run (all rings)
 *   npx tsx scripts/scrape.ts --ring 1               # Ring 1 only
 *   npx tsx scripts/scrape.ts --ring 1 --ring 3      # Rings 1 and 3
 *   npx tsx scripts/scrape.ts --city singapore        # Single city
 *   npx tsx scripts/scrape.ts --resume                # Resume stopped jobs
 *   npx tsx scripts/scrape.ts --seed                  # Seed city graph only
 *   npx tsx scripts/scrape.ts --limit 5               # Max 5 jobs
 *
 * Environment:
 *   SIMULA_URL  Base URL of the deployed app (default: http://localhost:3000)
 */

const BASE_URL = process.env.SIMULA_URL ?? "http://localhost:3000";

function parseArgs(): {
  rings: number[];
  city?: string;
  topic?: string;
  limit?: number;
  resume: boolean;
  seed: boolean;
} {
  const args = process.argv.slice(2);
  const rings: number[] = [];
  let city: string | undefined;
  let topic: string | undefined;
  let limit: number | undefined;
  let resume = false;
  let seed = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--ring":
        rings.push(Number(args[++i]));
        break;
      case "--city":
        city = args[++i];
        break;
      case "--topic":
        topic = args[++i];
        break;
      case "--limit":
        limit = Number(args[++i]);
        break;
      case "--resume":
        resume = true;
        break;
      case "--seed":
        seed = true;
        break;
      case "--help":
      case "-h":
        console.log(`
sim.ula Policy Scraper CLI

Usage: npx tsx scripts/scrape.ts [options]

Options:
  --ring <n>       Scrape only ring N (can repeat: --ring 1 --ring 3)
  --city <id>      Scrape only this city (e.g. "singapore")
  --topic <topic>  Scrape only this topic (e.g. "waste management")
  --limit <n>      Max jobs to process
  --resume         Resume stopped jobs from last run
  --seed           Seed city graph (create nodes + proximity chains)
  --help, -h       Show this help

Environment:
  SIMULA_URL       Base URL (default: http://localhost:3000)
`);
        process.exit(0);
    }
  }

  return { rings, city, topic, limit, resume, seed };
}

async function seedCityGraph() {
  console.log("Seeding city graph...");
  const res = await fetch(`${BASE_URL}/api/scrape/seed`, { method: "POST" });
  if (!res.ok) {
    console.error(`Seed failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = (await res.json()) as { nodes_created: number; edges_created: number };
  console.log(`Seeded: ${data.nodes_created} nodes, ${data.edges_created} edges`);
}

async function runScrape(opts: ReturnType<typeof parseArgs>) {
  console.log(`Starting scrape (URL: ${BASE_URL})...`);
  if (opts.rings.length) console.log(`  Rings: ${opts.rings.join(", ")}`);
  if (opts.city) console.log(`  City: ${opts.city}`);
  if (opts.topic) console.log(`  Topic: ${opts.topic}`);
  if (opts.limit) console.log(`  Limit: ${opts.limit}`);
  if (opts.resume) console.log(`  Mode: resume`);

  const res = await fetch(`${BASE_URL}/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      rings: opts.rings.length > 0 ? opts.rings : undefined,
      city: opts.city,
      topic: opts.topic,
      limit: opts.limit,
      resume: opts.resume,
    }),
  });

  if (!res.ok || !res.body) {
    console.error(`Scrape request failed: ${res.status}`);
    process.exit(1);
  }

  // Handle graceful shutdown
  let stopping = false;
  process.on("SIGINT", async () => {
    if (stopping) {
      console.log("\nForce quit.");
      process.exit(1);
    }
    stopping = true;
    console.log("\nSending stop signal (finishing current job)...");
    await fetch(`${BASE_URL}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    }).catch(() => {});
  });

  // Stream SSE events
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        formatEvent(event);
      } catch {
        // Skip malformed events
      }
    }
  }

  console.log("\nDone.");
}

function formatEvent(event: Record<string, unknown>) {
  const type = event.type as string;
  const timestamp = new Date().toLocaleTimeString();

  switch (type) {
    case "session_start":
      console.log(`\n[${timestamp}] Session started — Cycle ${event.cycle}`);
      break;
    case "job_start":
      process.stdout.write(`[${timestamp}] ${event.city}/${event.topic}... `);
      break;
    case "search_done":
      process.stdout.write(`${event.results_count} results → `);
      break;
    case "extract_done":
      process.stdout.write(`${event.policies_found} policies, ${event.edges_created} edges `);
      break;
    case "crosslink_done":
      if ((event.cross_links as number) > 0) {
        process.stdout.write(`+${event.cross_links} cross-links `);
      }
      break;
    case "job_done":
      console.log("OK");
      break;
    case "job_error":
      console.log(`FAILED: ${event.error}`);
      break;
    case "progress":
      console.log(`  Progress: ${event.completed}/${event.total} (${event.failed} failed)`);
      break;
    case "stopped":
      console.log(`\n[${timestamp}] ${event.message}`);
      break;
    case "complete":
      console.log(`\n[${timestamp}] ${event.message}`);
      break;
    default:
      console.log(`[${timestamp}] [${type}] ${event.message ?? ""}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (opts.seed) {
    await seedCityGraph();
    return;
  }

  await runScrape(opts);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
