import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const metadata = {
  title: "SplitEasy Admin",
  robots: "noindex, nofollow",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // Hard redirect — non-admins cannot see this layout at all
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex">
      {/* Admin sidebar */}
      <AdminSidebar adminName={session.name} />

      {/* Main content - offset by sidebar width on large screens */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <AdminHeader adminName={session.name} />

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
