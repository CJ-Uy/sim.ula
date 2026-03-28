"use client";

import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import PolicyHistory from "@/components/PolicyHistory";
import type { SimulationResult } from "@/lib/types";

export default function PoliciesPage() {
  const router = useRouter();

  const handleSelect = (
    result: SimulationResult & { simulation_id: string },
    policy: string,
    location: string
  ) => {
    sessionStorage.setItem(
      "pendingSimulation",
      JSON.stringify({ result, policy, location })
    );
    router.push("/");
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header hideNav />
      <main className="min-h-0 flex-1 overflow-hidden">
        <PolicyHistory onBack={() => router.push("/")} onSelect={handleSelect} />
      </main>
    </div>
  );
}
