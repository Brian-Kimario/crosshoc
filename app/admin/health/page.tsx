"use client";

import { useState, useEffect } from "react";
import { Activity, Database, Wifi, HardDrive, Clock, Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface HealthData {
  status: "healthy" | "degraded" | "down";
  database: {
    status: string;
    pingMs: number | null;
  };
  realtime: {
    activeSSEConnections: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  uptime: {
    seconds: number;
  };
  timestamp: string;
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHealth() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/health");
      if (!res.ok) throw new Error("Failed to fetch health");
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch system health");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  function formatUptime(seconds: number) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  function StatusIcon({ status }: { status: string }) {
    if (status === "healthy" || status === "connected") {
      return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
    if (status === "degraded" || status === "connecting" || status === "disconnecting") {
      return <AlertCircle className="w-5 h-5 text-amber-400" />;
    }
    return <XCircle className="w-5 h-5 text-rose-400" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">System Health</h1>
          <p className="text-sm text-slate-500">
            Real-time system status and diagnostics
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Now"}
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 text-rose-400">
          {error}
        </div>
      )}

      {health && (
        <>
          {/* Overall Status */}
          <div className={`p-4 rounded-xl border ${
            health.status === "healthy"
              ? "bg-emerald-950/30 border-emerald-500/30"
              : health.status === "degraded"
              ? "bg-amber-950/30 border-amber-500/30"
              : "bg-rose-950/30 border-rose-500/30"
          }`}>
            <div className="flex items-center gap-3">
              <StatusIcon status={health.status} />
              <div>
                <p className={`font-semibold ${
                  health.status === "healthy" ? "text-emerald-400" :
                  health.status === "degraded" ? "text-amber-400" : "text-rose-400"
                }`}>
                  System {health.status}
                </p>
                <p className="text-xs text-slate-500">
                  Last updated: {new Date(health.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Database */}
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-medium text-slate-200">Database</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Status</span>
                  <span className={`text-xs font-medium ${
                    health.database.status === "connected" ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {health.database.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Ping</span>
                  <span className="text-xs text-slate-300">
                    {health.database.pingMs ? `${health.database.pingMs}ms` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Realtime */}
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-medium text-slate-200">Realtime</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">SSE Connections</span>
                  <span className="text-xs font-medium text-slate-300">
                    {health.realtime.activeSSEConnections}
                  </span>
                </div>
              </div>
            </div>

            {/* Memory */}
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-medium text-slate-200">Memory</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Heap Used</span>
                  <span className="text-xs text-slate-300">{health.memory.heapUsedMB} MB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">RSS</span>
                  <span className="text-xs text-slate-300">{health.memory.rssMB} MB</span>
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-medium text-slate-200">Uptime</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Server</span>
                  <span className="text-xs font-medium text-slate-300">
                    {formatUptime(health.uptime.seconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
