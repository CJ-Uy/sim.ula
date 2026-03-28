import type { Stakeholder } from "@/data/mockResults";

export default function StakeholderBlock({ persona, quote }: Stakeholder) {
  return (
    <div className="border-l-2 border-border-light pl-4">
      <p className="text-sm font-semibold">{persona}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        &ldquo;{quote}&rdquo;
      </p>
    </div>
  );
}
