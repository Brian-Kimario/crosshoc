import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GroupsListClient } from "@/components/groups/GroupsListClient";

export default async function GroupsPage() {
  const userId = await verifyAuth();
  if (!userId) {
    redirect("/login");
  }

  return <GroupsListClient />;
}
