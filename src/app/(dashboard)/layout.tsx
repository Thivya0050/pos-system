import { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import PageHeader from "@/components/PageHeader";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Suspense
            fallback={
              <header className="flex h-14 shrink-0 items-center border-b border-[#e2e8f0] bg-white px-6" />
            }
          >
            <PageHeader />
          </Suspense>
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
