"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
  inviteToken: string;
}

interface DashboardShellProps {
  activeGroupId?: string;
  children: ReactNode | ((data: { user: User; groups: Group[] }) => ReactNode);
}

export function DashboardShell({
  activeGroupId,
  children,
}: DashboardShellProps) {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openCreateGroup, setOpenCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const bootstrapDashboard = async () => {
      try {
        const [meResponse, groupsResponse] = await Promise.all([
          fetch("/api/auth/me", {
            credentials: "include",
          }),
          fetch("/api/groups", {
            credentials: "include",
          }),
        ]);

        if (!meResponse.ok) {
          router.push("/login");
          return;
        }

        const meData = await meResponse.json();
        setUser(meData.data.user);

        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          setGroups(groupsData.data.groups || []);
        } else {
          toast.error("Could not load your groups.");
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    bootstrapDashboard();
  }, [router]);

  const onCreateGroupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!groupName.trim()) {
      toast.error("Group name is required.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to create group");
        return;
      }

      setGroups((prev) => [data.data.group, ...prev]);
      setGroupName("");
      setOpenCreateGroup(false);
      toast.success("Group created successfully.");
      router.refresh();
    } catch {
      toast.error("Something went wrong while creating your group.");
    } finally {
      setCreating(false);
    }
  };

  const activeIdFromPath = useMemo(() => {
    const parts = pathname.split("/");
    if (parts[1] === "groups" && parts[2]) {
      return parts[2];
    }
    return undefined;
  }, [pathname]);

  const currentActiveGroupId = activeGroupId || activeIdFromPath;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-300 flex items-center justify-center">
        Loading dashboard...
      </div>
    );
  }

  const resolvedChildren =
    typeof children === "function" ? children({ user, groups }) : children;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="border-b border-emerald-900/40 bg-[#111b31]">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-300/80">
                SplitEasy
              </p>
              <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
          </div>

          <Dialog open={openCreateGroup} onOpenChange={setOpenCreateGroup}>
            <DialogTrigger
              render={
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-5" />
              }
            >
              <Plus className="size-4 mr-1" />
              Create Group
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100">
              <DialogHeader>
                <DialogTitle>Create a new expense group</DialogTitle>
                <DialogDescription>
                  Invite friends, roommates, or family and start tracking shared
                  expenses.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={onCreateGroupSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group name</Label>
                  <Input
                    id="group-name"
                    placeholder="Goa Trip 2026"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                    className="bg-slate-950 border-slate-700"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-700 bg-transparent hover:bg-slate-800"
                    onClick={() => setOpenCreateGroup(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    {creating ? "Creating..." : "Create Group"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl border border-emerald-900/40 bg-[#13203a] p-4 h-fit">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/80 px-2 pb-2">
            YOUR GROUPS
          </p>
          <nav className="space-y-2">
            <Link
              href="/"
              className={`block rounded-2xl px-3 py-2 font-medium ${
                pathname === "/"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
                  : "text-slate-300 hover:bg-slate-800/70"
              }`}
            >
              Overview
            </Link>
            {groups.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">No groups yet.</p>
            ) : (
              groups.map((group) => {
                const isActive = currentActiveGroupId === group.id;
                return (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className={`block rounded-2xl px-3 py-2 ${
                      isActive
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
                        : "text-slate-300 hover:bg-slate-800/70"
                    }`}
                  >
                    {group.name}
                  </Link>
                );
              })
            )}
          </nav>
        </aside>

        <main className="space-y-6">{resolvedChildren}</main>
      </div>
    </div>
  );
}
