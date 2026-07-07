"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const SESSION_KEY = "pharmapos_session";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        router.replace("/login");
        return;
      }
      const session = JSON.parse(raw) as { isLoggedIn?: boolean };
      if (session.isLoggedIn === true) {
        setReady(true);
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
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
