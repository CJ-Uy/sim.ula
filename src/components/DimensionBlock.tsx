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

  return (
    <div className="border border-border-light bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">{name}</span>
        <span className="font-serif text-lg font-bold" style={{ color }}>
          {score}
          <span className="text-sm font-normal text-muted-light">/100</span>
        </span>
      </div>
      <div className="mt-3 h-1 w-full bg-border-light">
        <div
          className="h-full transition-[width] duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <ul className="mt-4 space-y-1.5">
        {findings.map((f) => (
          <li
            key={f}
            className="flex gap-2 text-sm leading-snug text-muted"
          >
            <span className="shrink-0 text-muted-light">&middot;</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
