import type { TimelineMilestone } from "@/data/mockResults";

interface TimelineBlockProps extends TimelineMilestone {
  index: number;
}

export default function TimelineBlock({
  timeframe,
  phase,
  description,
  index,
}: TimelineBlockProps) {
  return (
    <div className="flex gap-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-foreground text-xs font-medium text-background">
        {index}
      </span>
      <div>
        <p className="text-[15px]">
          <span className="font-semibold">{timeframe}</span>
          <span className="text-muted"> &mdash; {phase}</span>
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );
}
