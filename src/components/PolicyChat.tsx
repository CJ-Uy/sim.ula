"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PolicyChatProps {
  simulationId: string;
  policy: string;
  location: string;
}

const SUGGESTED_QUESTIONS = [
  "What are the biggest risks I should watch for?",
  "Which stakeholders should I engage first?",
  "How does this compare to similar past policies?",
  "What would make this more likely to succeed?",
];

export default function PolicyChat({
  simulationId,
  policy,
  location,
}: PolicyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMessage: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            simulation_id: simulationId,
            policy,
            location,
            history: messages.slice(-6),
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as { answer: string };
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, simulationId, policy, location]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col border border-border-light bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border-light px-5 py-3">
        <span className="flex h-2 w-2 rounded-full bg-accent" />
        <span className="text-[13px] font-semibold uppercase tracking-wide text-foreground/70">
          Policy Assistant
        </span>
        <span className="ml-auto text-xs text-muted-light">
          Ask anything about this simulation
        </span>
      </div>

      {/* Messages */}
      <div className="flex min-h-[220px] max-h-[420px] flex-col gap-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              I&apos;m familiar with this simulation and the historical policy
              knowledge base. What would you like to explore?
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-white"
                  : "border border-border-light bg-background text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="border border-border-light bg-background px-3.5 py-2.5">
              <span className="flex items-center gap-1.5 text-sm text-muted-light">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                  style={{
                    animation: "pulse-dot 1.2s ease-in-out infinite",
                    animationDelay: "0.2s",
                  }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                  style={{
                    animation: "pulse-dot 1.2s ease-in-out infinite",
                    animationDelay: "0.4s",
                  }}
                />
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500">
            Error: {error}{" "}
            <button
              className="underline"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-light px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question… (Enter to send)"
            disabled={loading}
            className="flex-1 resize-none border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-light focus:border-accent disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-default disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-light">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
