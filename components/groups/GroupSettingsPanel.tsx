"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings,
  Pencil,
  Trash2,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Check,
  X,
  Shield,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  avatar?: string | null;
}

interface GroupSettingsPanelProps {
  groupId: string;
  groupName: string;
  groupDescription?: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "member";
}

export function GroupSettingsPanel({
  groupId,
  groupName,
  groupDescription = "",
  members,
  currentUserId,
  currentUserRole,
}: GroupSettingsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Edit state
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState(groupName);
  const [descValue, setDescValue] = useState(groupDescription);
  const [savingName, setSavingName] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canEditSettings = currentUserRole === "owner" || currentUserRole === "admin";
  const canDeleteGroup = currentUserRole === "owner";
  const canRemoveMember = currentUserRole === "owner" || currentUserRole === "admin";

  // ── Save name ──────────────────────────────────────────────────────────────
  async function saveName() {
    if (!nameValue.trim() || nameValue.trim() === groupName) {
      setEditingName(false);
      setNameValue(groupName);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to rename group"); return; }
      toast.success("Group renamed");
      setEditingName(false);
      router.refresh();
    } catch {
      toast.error("Failed to rename group");
    } finally {
      setSavingName(false);
    }
  }

  // ── Save description ───────────────────────────────────────────────────────
  async function saveDesc() {
    if (descValue.trim() === groupDescription) {
      setEditingDesc(false);
      return;
    }
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: descValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to update description"); return; }
      toast.success("Description updated");
      setEditingDesc(false);
      router.refresh();
    } catch {
      toast.error("Failed to update description");
    } finally {
      setSavingDesc(false);
    }
  }

  // ── Remove member ──────────────────────────────────────────────────────────
  async function removeMember(memberId: string, memberName: string) {
    if (!window.confirm(`Remove ${memberName} from this group?`)) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: memberId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to remove member"); return; }
      toast.success(`${memberName} removed`);
      router.refresh();
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  }

  // ── Delete group ───────────────────────────────────────────────────────────
  async function deleteGroup() {
    if (deleteConfirmText !== groupName) {
      toast.error("Group name doesn't match");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to delete group"); return; }
      toast.success("Group deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete group");
    } finally {
      setDeleting(false);
    }
  }

  if (!canEditSettings && !canDeleteGroup && !canRemoveMember) return null;

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-[#1E293B]/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          <span className="font-semibold text-slate-100">Group Settings</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-6 border-t border-[#1E293B]">

          {/* ── Edit name ── */}
          {canEditSettings && (
            <div className="pt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Group Name
              </p>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") { setEditingName(false); setNameValue(groupName); }
                    }}
                    maxLength={100}
                    className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#10B981]"
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNameValue(groupName); }}
                    className="p-2 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1E293B]/50 border border-[#1E293B]">
                  <span className="text-sm text-slate-200 truncate">{groupName}</span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#334155] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Edit description ── */}
          {canEditSettings && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Description
              </p>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="What is this group for?"
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setEditingDesc(false); setDescValue(groupDescription); }}
                      className="px-3 py-1.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 bg-slate-700/50 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveDesc}
                      disabled={savingDesc}
                      className="px-3 py-1.5 rounded-xl text-sm text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savingDesc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#1E293B]/50 border border-[#1E293B]">
                  <span className="text-sm text-slate-400 flex-1">
                    {groupDescription || <span className="italic text-slate-600">No description</span>}
                  </span>
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#334155] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Members management ── */}
          {canRemoveMember && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Members
              </p>
              <div className="space-y-1">
                {members.map((member) => {
                  const isCurrentUser = member.id === currentUserId;
                  const isLastOwner =
                    member.role === "owner" &&
                    members.filter((m) => m.role === "owner").length <= 1;
                  const canRemove = !isCurrentUser && !isLastOwner;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[#1E293B]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar name={member.name} avatarUrl={member.avatar} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">
                            {isCurrentUser ? `${member.name} (you)` : member.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role badge */}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          member.role === "owner"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : member.role === "admin"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-slate-700/50 text-slate-500 border-slate-600/30"
                        }`}>
                          {member.role === "owner" && <Shield className="w-2.5 h-2.5 inline mr-0.5" />}
                          {member.role}
                        </span>
                        {/* Remove button */}
                        {canRemove && (
                          <button
                            onClick={() => removeMember(member.id, member.name)}
                            disabled={removingId === member.id}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                            title={`Remove ${member.name}`}
                          >
                            {removingId === member.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Delete group ── */}
          {canDeleteGroup && (
            <div className="pt-2 border-t border-[#1E293B]">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete this group
                </button>
              ) : (
                <div className="space-y-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-rose-300">Delete group permanently?</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        This will delete all expenses and settlements. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Type <span className="font-mono text-rose-300">{groupName}</span> to confirm:
                  </p>
                  <input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={groupName}
                    className="w-full bg-[#0F172A] border border-rose-500/30 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                      className="flex-1 py-2 rounded-xl text-sm text-slate-400 bg-slate-700/50 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteGroup}
                      disabled={deleting || deleteConfirmText !== groupName}
                      className="flex-1 py-2 rounded-xl text-sm text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
