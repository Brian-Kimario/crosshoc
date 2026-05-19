"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Shield, Trash2, UserCheck,
  UserX, UserCog, Loader2, KeyRound, CheckCircle,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface User {
  _id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isDisabled: boolean;
  createdAt: string;
  groupCount: number;
  avatarUrl?: string;
}

export function AdminUsersClient() {
  const [users, setUsers]       = useState<User[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [confirming,    setConfirming]    = useState<string | null>(null);
  const [resetting,     setResetting]     = useState<string | null>(null);
  const [resetSuccess,  setResetSuccess]  = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), search });
    const res  = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers(); }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function performAction(userId: string, action: string) {
    const key = userId + action;
    setConfirming(key);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setConfirming(null);
    fetchUsers();
  }

  async function deleteUser(userId: string) {
    if (!window.confirm("Permanently delete this user? This cannot be undone.")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    fetchUsers();
  }

  async function handlePasswordReset(userId: string, userName: string, email: string) {
    const confirmed = window.confirm(
      `Send a password reset email to ${userName} (${email})?\n\nThey will receive a link to set a new password.`
    );
    if (!confirmed) return;

    setResetting(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });
      if (res.ok) {
        setResetSuccess(userId);
        setTimeout(() => setResetSuccess(null), 3000);
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to send reset email");
      }
    } catch {
      alert("Network error — please try again");
    } finally {
      setResetting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Users</h1>
          <p className="text-sm text-slate-500">
            {total.toLocaleString()} total accounts
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2.5 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {["User", "Groups", "Joined", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600 mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr
                  key={user._id}
                  className={`hover:bg-[#1E293B]/30 transition-colors ${
                    user.isDisabled ? "opacity-60" : ""
                  }`}
                >
                  {/* User info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name || "?"} avatarUrl={user.avatarUrl} size={32} className="shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-slate-200 truncate">
                            {user.name}
                          </p>
                          {user.isAdmin && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[10px] font-medium">
                              Admin
                            </span>
                          )}
                          {user.isDisabled && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-medium">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Groups */}
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {user.groupCount}
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        user.isDisabled
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {user.isDisabled ? "Disabled" : "Active"}
                    </span>
                  </td>

                  {/* Actions — min 44px touch targets */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Disable / Enable */}
                      <button
                        onClick={() =>
                          performAction(
                            user._id,
                            user.isDisabled ? "enable" : "disable"
                          )
                        }
                        disabled={
                          confirming ===
                          user._id + (user.isDisabled ? "enable" : "disable")
                        }
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-40"
                        title={user.isDisabled ? "Re-enable account" : "Disable account"}
                      >
                        {user.isDisabled ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <UserX className="w-4 h-4" />
                        )}
                      </button>

                      {/* Admin toggle */}
                      <button
                        onClick={() =>
                          performAction(
                            user._id,
                            user.isAdmin ? "remove-admin" : "make-admin"
                          )
                        }
                        disabled={
                          confirming ===
                          user._id + (user.isAdmin ? "remove-admin" : "make-admin")
                        }
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-violet-400 transition-colors disabled:opacity-40"
                        title={user.isAdmin ? "Remove admin" : "Make admin"}
                      >
                        {user.isAdmin ? (
                          <UserCog className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </button>

                      {/* Reset Password */}
                      {resetSuccess === user._id ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 px-2">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Email sent
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            handlePasswordReset(user._id, user.name, user.email)
                          }
                          disabled={resetting === user._id}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-40"
                          title="Send password reset email"
                        >
                          {resetting === user._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <KeyRound className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => deleteUser(user._id)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete account permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-3 border-t border-[#1E293B] flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs text-slate-400 border border-[#1E293B] rounded-lg hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="px-3 py-1.5 text-xs text-slate-400 border border-[#1E293B] rounded-lg hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
