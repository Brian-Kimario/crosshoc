"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ExternalLink, Loader2, FolderOpen } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-utils";

interface Group {
  _id: string;
  name: string;
  currency: string;
  memberCount: number;
  expenseCount: number;
  totalSpent: number;
  createdAt: string;
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      search,
    });
    const res = await fetch(`/api/admin/groups?${params}`);
    const data = await res.json();
    setGroups(data.groups ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchGroups();
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Groups</h1>
          <p className="text-sm text-slate-500">
            {total.toLocaleString()} total groups
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups..."
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2.5 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
        />
      </div>

      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {["Name", "Members", "Expenses", "Total Spent", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600 mx-auto" />
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No groups found
                  </td>
                </tr>
              ) : groups.map((group) => (
                <tr key={group._id} className="hover:bg-[#1E293B]/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-4 h-4 text-teal-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-200">{group.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{group.memberCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{group.expenseCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-200">
                    {formatCurrency(group.totalSpent, group.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(group.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/groups/${group._id}`}
                      className="p-1.5 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-teal-400 transition-colors inline-flex"
                      title="View group details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="px-4 py-3 border-t border-[#1E293B] flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
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
