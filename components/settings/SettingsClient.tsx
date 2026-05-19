"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { PasswordTab } from "@/components/settings/PasswordTab";
import { EmailTab } from "@/components/settings/EmailTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { SessionsTab } from "@/components/settings/SessionsTab";
import { DangerZoneTab } from "@/components/settings/DangerZoneTab";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = "profile" | "password" | "email" | "notifications" | "sessions" | "danger";

interface TabDef {
  key: Tab;
  label: string;
}

const TABS: TabDef[] = [
  { key: "profile",       label: "Profile" },
  { key: "password",      label: "Password" },
  { key: "email",         label: "Email" },
  { key: "notifications", label: "Notifications" },
  { key: "sessions",      label: "Sessions" },
  { key: "danger",        label: "Danger Zone" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsClientProps {
  initialTab: string;
  successMessage?: string;
  errorMessage?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsClient({
  initialTab,
  successMessage,
  errorMessage,
}: SettingsClientProps) {
  const router = useRouter();

  // Validate initialTab — fall back to "profile" if unknown
  const resolvedInitial: Tab =
    TABS.some((t) => t.key === initialTab)
      ? (initialTab as Tab)
      : "profile";

  const [activeTab, setActiveTab] = useState<Tab>(resolvedInitial);

  function handleTabChange(key: Tab) {
    setActiveTab(key);
    router.replace(`/settings?tab=${key}`, { scroll: false });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0F172A] p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your account and preferences
          </p>
        </div>

        {/* Success banner */}
        {successMessage && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <CheckCircle className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error banner */}
        {errorMessage && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            <XCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="flex overflow-x-auto gap-1 pb-1 -mx-1 px-1 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{ minHeight: "44px", fontSize: "16px" }}
              className={`
                shrink-0 rounded-lg px-4 font-medium whitespace-nowrap transition-colors
                ${
                  activeTab === tab.key
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 md:p-6">
          {activeTab === "profile"       && <ProfileTab />}
          {activeTab === "password"      && <PasswordTab />}
          {activeTab === "email"         && <EmailTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "sessions"      && <SessionsTab />}
          {activeTab === "danger"        && <DangerZoneTab />}
        </div>

      </div>
    </div>
  );
}
