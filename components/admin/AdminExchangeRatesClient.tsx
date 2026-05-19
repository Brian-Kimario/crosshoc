"use client";

import { useState } from "react";
import useSWR from "swr";
import { keys } from "@/lib/swr-keys";
import { Loader2, DollarSign, Save, Plus } from "lucide-react";

interface ExchangeRate {
  _id: string;
  base: string;
  target: string;
  rate: number;
  source: string;
  fetchedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AdminExchangeRatesClient() {
  const { data, error, isLoading, mutate } = useSWR<{ exchangeRates: ExchangeRate[] }>(
    keys.adminExchangeRates(),
    fetcher
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [newBase, setNewBase] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const exchangeRates = data?.exchangeRates ?? [];

  async function handleSaveEdit(id: string, base: string, target: string) {
    const rate = parseFloat(editRate);
    if (!rate || rate <= 0) {
      setErrorMsg("Rate must be a positive number");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base, target, rate }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to update rate");
        setSaving(false);
        return;
      }

      await mutate();
      setEditingId(null);
      setEditRate("");
    } catch {
      setErrorMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNew() {
    const rate = parseFloat(newRate);
    if (!newBase.trim() || !newTarget.trim()) {
      setErrorMsg("Base and target currency codes are required");
      return;
    }
    if (!rate || rate <= 0) {
      setErrorMsg("Rate must be a positive number");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: newBase.trim().toUpperCase(),
          target: newTarget.trim().toUpperCase(),
          rate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to add rate");
        setSaving(false);
        return;
      }

      await mutate();
      setNewBase("");
      setNewTarget("");
      setNewRate("");
    } catch {
      setErrorMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(id: string, currentRate: number) {
    setEditingId(id);
    setEditRate(String(currentRate));
    setErrorMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRate("");
    setErrorMsg("");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Exchange Rates</h1>
          <p className="text-sm text-slate-500">
            Manage currency exchange rates for multi-currency groups
          </p>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm text-rose-400">
          {errorMsg}
        </div>
      )}

      {/* Add new rate form */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">Add or Update Rate</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={newBase}
            onChange={(e) => setNewBase(e.target.value)}
            placeholder="Base (e.g. USD)"
            className="bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
          />
          <input
            type="text"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="Target (e.g. EUR)"
            className="bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
          />
          <input
            type="number"
            step="0.000001"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder="Rate (e.g. 0.85)"
            className="bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
          />
          <button
            onClick={handleAddNew}
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {["Base", "Target", "Rate", "Source", "Fetched At", "Actions"].map((h) => (
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
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600 mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-rose-400">
                    Failed to load exchange rates
                  </td>
                </tr>
              ) : exchangeRates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No exchange rates found. Add one above.
                  </td>
                </tr>
              ) : (
                exchangeRates.map((rate) => {
                  const isEditing = editingId === rate._id;
                  return (
                    <tr
                      key={rate._id}
                      className="hover:bg-[#1E293B]/30 transition-colors"
                    >
                      {/* Base */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-200">
                            {rate.base}
                          </span>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-200">
                            {rate.target}
                          </span>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.000001"
                            value={editRate}
                            onChange={(e) => setEditRate(e.target.value)}
                            className="w-32 bg-[#0B1120] border border-[#334155] rounded-lg px-2 py-1 text-slate-200 text-sm outline-none focus:border-violet-500 transition-colors"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm text-slate-300">
                            {rate.rate.toFixed(6)}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            rate.source === "manual"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-blue-500/10 text-blue-400"
                          }`}
                        >
                          {rate.source}
                        </span>
                      </td>

                      {/* Fetched At */}
                      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                        {new Date(rate.fetchedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSaveEdit(rate._id, rate.base, rate.target)}
                              disabled={saving}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40"
                              title="Save changes"
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                              title="Cancel"
                            >
                              <span className="text-sm">✕</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(rate._id, rate.rate)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-violet-400 transition-colors"
                            title="Edit rate"
                          >
                            <span className="text-sm">✏️</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile note */}
      <p className="text-xs text-slate-600 text-center">
        Table scrolls horizontally on narrow screens
      </p>
    </div>
  );
}
