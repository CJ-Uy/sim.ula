"use client";

import { useEffect, useState } from "react";
import type { Dimension } from "@/data/mockResults";

export default function DimensionBlock({
  name,
  score,
  color,
  findings,
}: Dimension) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  const label =
    score >= 80 ? "Strong" : score >= 60 ? "Moderate" : score >= 40 ? "Fair" : "Low";

  return (
    <div className="w-full border-l-2" style={{ borderColor: color }}>
      {/* Header row: name + score */}
      <div className="flex items-baseline justify-between gap-4 pl-5 pr-1">
        <h3 className="text-[15px] font-semibold leading-snug">{name}</h3>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-serif text-2xl font-bold leading-none"
            style={{ color }}
          >
            {score}
          </span>
          <span className="text-xs text-muted-light">/100</span>
          <span
            className="ml-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Progress bar — full width */}
      <div className="mt-2.5 ml-5 mr-1 h-1 bg-border-light">
        <div
          className="h-full transition-[width] duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>

      {/* Findings */}
      <ul className="mt-3.5 space-y-1.5 pl-5 pr-1">
        {findings.map((f) => (
          <li
            key={f}
            className="flex gap-2.5 text-sm leading-snug text-muted"
          >
            <span
              className="mt-1.75 h-1 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
