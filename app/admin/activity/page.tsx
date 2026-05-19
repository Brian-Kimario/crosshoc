import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { LiveActivityClient } from "./LiveActivityClient";

export default async function ActivityPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return <LiveActivityClient />;
}
