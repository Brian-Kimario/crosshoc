import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Group from "@/lib/models/Group";
import dbConnect from "@/lib/db";

export default async function GroupsPage() {
  const userId = await verifyAuth();
  if (!userId) {
    redirect("/login");
  }

  await dbConnect();
  const groups = (await Group.find({ "members.user": userId })
    .populate("members.user", "name email")
    .sort({ updatedAt: -1 })
    .lean()) as any[];

  return (
    <div className="min-h-screen bg-[#0B1221] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Groups</h1>
            <p className="text-slate-400">Manage all your expense groups</p>
          </div>
          <Link href="/groups/new">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4 py-2 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Group
            </Button>
          </Link>
        </div>

        {/* Groups Grid */}
        {groups && groups.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group: any) => (
              <Link
                key={String(group._id)}
                href={`/groups/${group._id}`}
                className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 hover:border-emerald-500/50 hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs text-slate-500">
                    {group.members?.length || 0} members
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  {group.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {group.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Created {new Date(group.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-emerald-400 text-sm">View →</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No groups yet
            </h3>
            <p className="text-slate-400 mb-6">
              Create your first group to start splitting expenses
            </p>
            <Link href="/groups/new">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 py-2">
                Create First Group
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
