import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Temporary header — we will replace with full sidebar later */}
      <header className="bg-[#1e2937] border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔀</div>
          <span className="font-bold text-2xl">SplitEasy</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">Demo User</span>
          {/* Avatar will go here later */}
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar placeholder */}
        <div className="w-72 bg-[#1e2937] border-r border-slate-700 min-h-[calc(100vh-73px)] p-6 hidden md:block">
          <div className="space-y-6">
            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-3xl font-medium flex items-center justify-center gap-3">
              + New Group
            </button>
            <div className="text-xs font-medium text-slate-400 px-3">YOUR GROUPS</div>
            {/* Group list will be added later */}
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
