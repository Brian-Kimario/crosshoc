export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Welcome to SplitEasy 👋</h1>
        <p className="text-slate-400 text-lg">
          Stop fighting over bills. Start splitting easier.
        </p>
      </div>

      {/* Placeholder for upcoming groups */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-[#1e2937] border-2 border-dashed border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500 transition-colors">
          <div className="text-5xl">➕</div>
          <p className="text-white font-semibold">Create New Group</p>
          <p className="text-slate-400 text-sm text-center">
            Create a new expense group with friends, roommates, or family
          </p>
        </div>
      </div>

      {/* Coming soon sections */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-[#1e2937] rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Your Groups</h2>
          <p className="text-slate-400">No groups yet. Create one to get started!</p>
        </div>

        <div className="bg-[#1e2937] rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
          <p className="text-slate-400">Activity will appear here</p>
        </div>
      </div>
    </div>
  );
}
