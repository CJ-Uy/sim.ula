"use client";

import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ScrapePanel from "@/components/ScrapePanel";

export default function ScrapePage() {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header hideNav />
      <main className="min-h-0 flex-1 overflow-hidden">
        <ScrapePanel onBack={() => router.push("/")} />
      </main>
    </div>
  );
}
