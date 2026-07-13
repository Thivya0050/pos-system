"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSession } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && getSession() !== null
  );

  useEffect(() => {
    if (getSession()) {
      setReady(true);
      return;
    }
    router.replace("/login");
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f1f5f9]">
        <Loader2 className="h-6 w-6 animate-spin text-[#64748b]" />
      </div>
    );
  }

  return <>{children}</>;
}
