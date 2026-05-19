"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Archive } from "lucide-react";
import { DashboardOverviewButton } from "@/components/dashboard/DashboardOverviewButton";
import { keys } from "@/lib/swr-keys";

interface GroupMember {
  user?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  role?: string;
  joinedAt?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  currency: string;
  members: GroupMember[];
  createdAt: string;
  status?: "active" | "archived";
  archivedAt?: string;
}

interface GroupsApiResponse {
  success: boolean;
  data: {
    groups: Group[];
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const colors = ["#10B981", "#8B5CF6", "#3B82F6", "#F59E0B", "#EC4899", "#14B8A6"];
const avatarBgs = ["#134E4A", "#3B0764", "#1E3A5F", "#78350F", "#701A75", "#134E4A"];

export function GroupsListClient() {
  const [showArchived, setShowArchived] = useState(false);

  const swrKey = showArchived ? keys.archivedGroups() : keys.groups();
  const { data, isLoading } = useSWR<GroupsApiResponse>(swrKey, fetcher);

  const groups = data?.data?.groups ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-slate-400 mt-1">
            {isLoading
              ? "Loading groups…"
              : groups.length === 0
              ? showArchived
                ? "No archived groups"
                : "No groups yet — create one or join with a link"
              : `${groups.length} group${groups.length !== 1 ? "s" : ""} · ${
                  showArchived ? "archived" : "manage your shared expenses"
                }`}
          </p>
        </div>

        {/* Show archived toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <span className="text-sm text-slate-400">Show archived</span>
          <button
            role="switch"
            aria-checked={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120] ${
              showArchived ? "bg-teal-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                showArchived ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 animate-pulse"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#1E293B]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#1E293B] rounded w-3/4" />
                  <div className="h-3 bg-[#1E293B] rounded w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-[#1E293B] rounded mb-2" />
              <div className="h-3 bg-[#1E293B] rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Groups Grid */}
      {!isLoading && groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => {
            const color = colors[i % colors.length];
            const avatarBg = avatarBgs[i % avatarBgs.length];
            const isArchived = group.status === "archived";

            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className={`bg-[#0F172A] border rounded-xl p-5 transition-all group relative ${
                  isArchived
                    ? "border-[#1E293B] opacity-70 hover:opacity-90 hover:border-[#334155]"
                    : "border-[#1E293B] hover:border-[#334155]"
                }`}
              >
                {/* Archived badge */}
                {isArchived && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-700/60 text-slate-400 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-600/50">
                    <Archive className="w-3 h-3" />
                    Archived
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-medium shrink-0 ${
                      isArchived ? "grayscale" : ""
                    }`}
                    style={{
                      backgroundColor: isArchived ? "#1E293B" : `${color}20`,
                      color: isArchived ? "#64748B" : color,
                    }}
                  >
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-medium transition-colors truncate ${
                        isArchived
                          ? "text-slate-400 group-hover:text-slate-300"
                          : "text-slate-100 group-hover:text-teal-400"
                      }`}
                    >
                      {group.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {(group.members || []).length} members
                    </p>
                  </div>
                </div>

                {/* Description or fallback */}
                <p className="text-sm text-slate-400 line-clamp-2 mb-4 min-h-[40px]">
                  {group.description || "No description added"}
                </p>

                {/* Stats row */}
                <div className="text-xs text-slate-500 mb-4">
                  {isArchived && group.archivedAt ? (
                    <>
                      Archived{" "}
                      {new Date(group.archivedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </>
                  ) : (
                    <>
                      Created{" "}
                      {new Date(group.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </>
                  )}
                </div>

                {/* Member avatars + open */}
                <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]">
                  <div className="flex items-center">
                    {(group.members || []).slice(0, 5).map((m, j) => (
                      <div
                        key={m.user?._id || j}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[#0F172A]"
                        style={{
                          backgroundColor: isArchived ? "#1E293B" : avatarBg,
                          color: isArchived ? "#64748B" : "#fff",
                          marginLeft: j > 0 ? "-6px" : "0",
                        }}
                      >
                        {(m.user?.name || m.user?.email || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    ))}
                    {(group.members || []).length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-[#1E293B] flex items-center justify-center text-xs text-slate-400 border-2 border-[#0F172A] ml-[-6px]">
                        +{(group.members || []).length - 5}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-sm group-hover:underline ${
                      isArchived ? "text-slate-500" : "text-teal-400"
                    }`}
                  >
                    Open →
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Add group card — only show when not in archived view */}
          {!showArchived && <DashboardOverviewButton />}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups.length === 0 && (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4 text-3xl">
            {showArchived ? "🗄️" : "👥"}
          </div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">
            {showArchived ? "No archived groups" : "No groups yet"}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            {showArchived
              ? "Groups you archive will appear here"
              : "Create a group or join one with an invite link"}
          </p>
          {!showArchived && (
            <div className="flex items-center justify-center gap-3">
              <DashboardOverviewButton />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
