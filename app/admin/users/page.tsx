import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return <AdminUsersClient />;
}
