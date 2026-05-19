import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { AdminExchangeRatesClient } from "@/components/admin/AdminExchangeRatesClient";

export default async function AdminExchangeRatesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return <AdminExchangeRatesClient />;
}
