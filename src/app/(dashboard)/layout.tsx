import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import PageHeader from "@/components/PageHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PageHeader />
          <main className="page-enter flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
