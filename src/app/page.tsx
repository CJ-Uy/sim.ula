"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const TICKER_ITEMS = [
  "GRAPHRAG ANALYSIS",
  "POLICY SIMULATION ENGINE",
  "STAKEHOLDER IMPACT MODELING",
  "HISTORICAL PRECEDENTS",
  "SUSTAINABILITY SCORING",
  "URBAN RESILIENCE ASSESSMENT",
  "TRAFFIC REGULATION ANALYSIS",
  "ZONING POLICY EVALUATION",
  "GREEN INFRASTRUCTURE PLANNING",
  "CLIMATE ADAPTATION MODELING",
  "COMMUNITY ENGAGEMENT METRICS",
  "RISK ASSESSMENT FRAMEWORK",
];

const FEATURES = [
  {
    tag: "GRAPHRAG",
    headline: "Knowledge-Powered Analysis",
    body: "Queries a graph of 10,000+ historical policy precedents to surface relevant context and real-world outcomes in real time.",
  },
  {
    tag: "SIMULATION ENGINE",
    headline: "LLM-Driven Projections",
    body: "Runs proposals through a multi-stage pipeline, modeling stakeholder reactions, environmental effects, and second-order impacts.",
  },
  {
    tag: "HISTORICAL DATA",
    headline: "Global Policy Archive",
    body: "Draws from urban policies across 94 cities worldwide, scored and indexed for rapid retrieval and cross-reference.",
  },
  {
    tag: "SUSTAINABILITY INDEX",
    headline: "0 – 100 Score",
    body: "Every simulation produces a composite sustainability score with dimension-level breakdowns and confidence indicators.",
  },
];

const STATS = [
  { value: "1,247", label: "Policies Simulated" },
  { value: "94", label: "Cities Covered" },
  { value: "10K+", label: "Historical Precedents" },
  { value: "5", label: "Analysis Dimensions" },
];

const HEADLINE = "Intelligence-Driven Urban Policy Simulation";

export default function LandingPage() {
  const [displayed, setDisplayed] = useState("");
  const [headlineDone, setHeadlineDone] = useState(false);
  const indexRef = useRef(0);

  // Typewriter effect for headline
  useEffect(() => {
    const interval = setInterval(() => {
      if (indexRef.current < HEADLINE.length) {
        setDisplayed(HEADLINE.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        setHeadlineDone(true);
        clearInterval(interval);
      }
    }, 38);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tickerItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="flex min-h-screen flex-col bg-background" style={{ animation: "fade-in 500ms ease" }}>

      {/* ── MASTHEAD ── */}
      <div className="border-b-[3px] border-foreground px-6 pt-5 pb-0">
        <div className="mx-auto max-w-6xl">
          {/* Top meta row */}
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">
            <span>Urban Policy Intelligence</span>
            <span>Vol. I, No. 1</span>
          </div>

          {/* Title */}
          <div className="text-center pb-4">
            <h1
              className="font-serif text-[3.5rem] sm:text-[5.5rem] font-black leading-none tracking-tight text-foreground uppercase"
              style={{ letterSpacing: "-0.02em" }}
            >
              sim.ula
            </h1>
            <div className="mt-2 flex items-center justify-center gap-0">
              <div className="h-px flex-1 bg-foreground" />
              <p
                className="px-4 text-[10px] uppercase tracking-[0.3em] text-foreground"
                style={{ fontVariant: "small-caps" }}
              >
                Urban Policy Simulation Platform
              </p>
              <div className="h-px flex-1 bg-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-light">
              {today}
            </p>
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="overflow-hidden border-b border-foreground bg-foreground py-1.5">
        <div
          style={{
            display: "inline-flex",
            gap: 0,
            whiteSpace: "nowrap",
            animation: "ticker-scroll 36s linear infinite",
          }}
        >
          {tickerItems.map((item, i) => (
            <span
              key={i}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-background"
            >
              {item}
              <span className="mx-5 text-background/30">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 px-6 py-7">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-0">

            {/* ── LEAD ARTICLE (2/3) ── */}
            <div
              className="lg:col-span-2 lg:border-r lg:border-border lg:pr-8"
              style={{ animation: "slide-up 500ms ease both" }}
            >
              {/* Section badge */}
              <div className="mb-4 flex items-center gap-3">
                <span className="bg-foreground px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-background">
                  Feature
                </span>
                <div
                  className="h-px flex-1 bg-foreground origin-left"
                  style={{ animation: "reveal-line 600ms ease both" }}
                />
              </div>

              {/* Big headline with typewriter */}
              <h2
                className="font-serif text-[2rem] sm:text-[2.75rem] font-black leading-[1.1] text-foreground"
                style={{ letterSpacing: "-0.015em" }}
              >
                {displayed}
                {!headlineDone && (
                  <span
                    className="ml-0.5 inline-block w-[3px] bg-foreground align-baseline"
                    style={{
                      height: "0.85em",
                      animation: "blink-cursor 0.7s ease-in-out infinite",
                    }}
                  />
                )}
              </h2>

              {/* Byline */}
              <div className="mt-3 flex items-center gap-3">
                <div className="h-px w-8 bg-border" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-light">
                  By the sim.ula Intelligence Engine
                </p>
              </div>

              <div className="my-5 border-t border-border" />

              {/* Lead copy with dropcap */}
              <p
                className="font-serif text-[0.975rem] leading-relaxed text-foreground"
                style={{ animation: "slide-up 700ms ease both" }}
              >
                <span
                  className="float-left mr-2 font-serif font-black text-foreground leading-none"
                  style={{ fontSize: "3.6rem", marginTop: "0.06em" }}
                >
                  S
                </span>
                im.ula is a platform for evaluating urban policy proposals against a curated
                knowledge graph of historical precedents. Powered by GraphRAG and large-language
                model simulation, it projects stakeholder impacts, environmental effects, and
                long-term sustainability scores — in seconds.
              </p>

              <p
                className="mt-4 text-sm leading-relaxed text-muted clear-both"
                style={{ animation: "slide-up 800ms ease both" }}
              >
                Each simulation draws on policies from across 94 cities, running them through
                a multi-stage analysis pipeline that surfaces relevant historical precedents,
                models second-order effects, and computes a composite 0–100 sustainability
                index with dimension-level breakdowns.
              </p>

              {/* Pull quote */}
              <blockquote
                className="my-6 border-l-[3px] border-foreground pl-4 clear-both"
                style={{ animation: "slide-up 850ms ease both" }}
              >
                <p className="font-serif text-base font-bold italic leading-snug text-foreground">
                  &ldquo;From proposal to analysis in under a minute — grounded in a decade of
                  global policy data.&rdquo;
                </p>
              </blockquote>

              {/* CTA */}
              <div style={{ animation: "slide-up 950ms ease both" }}>
                <Link
                  href="/simulate"
                  className="inline-flex items-center gap-3 border-2 border-foreground bg-foreground px-6 py-3 text-[13px] font-black uppercase tracking-[0.15em] text-background transition-all duration-200 hover:bg-background hover:text-foreground"
                >
                  Simulate a Policy
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/policies"
                  className="ml-4 inline-flex items-center gap-2 text-[13px] font-medium text-muted underline-offset-4 hover:text-foreground hover:underline transition-colors"
                >
                  View past simulations
                </Link>
              </div>
            </div>

            {/* ── SIDEBAR (1/3) ── */}
            <div
              className="mt-0 lg:pl-8"
              style={{ animation: "slide-up 600ms ease both" }}
            >
              {/* Section label */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted">
                  Platform Features
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div>
                {FEATURES.map((f, i) => (
                  <div
                    key={f.tag}
                    className="border-b border-border py-4 last:border-b-0"
                    style={{ animation: `slide-up ${600 + i * 90}ms ease both` }}
                  >
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent">
                      {f.tag}
                    </span>
                    <h3 className="mt-0.5 font-serif text-[0.95rem] font-bold leading-tight text-foreground">
                      {f.headline}
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      {f.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* Secondary CTA */}
              <div
                className="mt-4 border border-border p-4"
                style={{ animation: "slide-up 1000ms ease both" }}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted mb-1">
                  Knowledge Base
                </p>
                <p className="text-[12px] leading-relaxed text-muted">
                  Browse ingested policy documents, source articles, and the underlying
                  knowledge graph.
                </p>
                <Link
                  href="/knowledge"
                  className="mt-3 inline-block text-[12px] font-semibold text-accent hover:underline underline-offset-4"
                >
                  Explore the archive →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div
        className="border-t-[3px] border-foreground bg-foreground px-6 py-5"
        style={{ animation: "slide-up 1100ms ease both" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="text-center"
                style={{ animation: `slide-up ${1100 + i * 70}ms ease both` }}
              >
                <p className="font-serif text-[1.75rem] font-black leading-none text-background">
                  {stat.value}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-background/50">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
