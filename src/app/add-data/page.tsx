"use client";

import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import IngestForm from "@/components/IngestForm";

export default function AddDataPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header hideNav />
      <main className="min-h-0 flex-1 overflow-hidden">
        <IngestForm onBack={() => router.push("/")} />
      </main>
    </div>
  );
}
