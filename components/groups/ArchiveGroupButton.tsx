"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ArchiveGroupButtonProps {
  groupId: string;
  isArchived: boolean;
}

export function ArchiveGroupButton({ groupId, isArchived }: ArchiveGroupButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    const action = isArchived ? "unarchive" : "archive";
    const confirmed = window.confirm(
      isArchived
        ? "Restore this group? It will become active again."
        : "Archive this group? You can restore it later from the Groups page."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/archive`, {
        method: isArchived ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Failed to ${action} group`);
        return;
      }
      toast.success(isArchived ? "Group restored" : "Group archived");
      router.refresh();
    } catch {
      toast.error(`Failed to ${action} group`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
        isArchived
          ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300 border border-slate-700"
      }`}
      title={isArchived ? "Restore group" : "Archive group"}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isArchived ? (
        <ArchiveRestore className="w-4 h-4" />
      ) : (
        <Archive className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">{isArchived ? "Restore" : "Archive"}</span>
    </button>
  );
}
