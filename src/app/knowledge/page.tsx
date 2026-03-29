"use client";

import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import DocumentDashboard from "@/components/DocumentDashboard";

export default function KnowledgePage() {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header hideNav />
      <main className="min-h-0 flex-1 overflow-hidden">
        <DocumentDashboard onBack={() => router.push("/simulate")} />
      </main>
    </div>
  );
}
