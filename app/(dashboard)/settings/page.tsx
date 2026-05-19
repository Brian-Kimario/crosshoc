import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata = { title: "Settings — SplitEasy" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; success?: string; error?: string };
}) {
  const userId = await verifyAuth();
  if (!userId) redirect("/login");

  return (
    <SettingsClient
      initialTab={searchParams.tab ?? "profile"}
      successMessage={searchParams.success}
      errorMessage={searchParams.error}
    />
  );
}
