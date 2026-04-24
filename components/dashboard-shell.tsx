"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Wallet, Menu, LogOut, Receipt, Link2 } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  onAddExpense?: () => void;
  showAddExpense?: boolean;
}

export function DashboardShell({ activeGroupId, children, onAddExpense, showAddExpense }: DashboardShellProps) {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openCreateGroup, setOpenCreateGroup] = useState(false);
  const [openJoinGroup, setOpenJoinGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupCurrency, setGroupCurrency] = useState("USD");
  const [inviteLink, setInviteLink] = useState("");
  const [joining, setJoining] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const bootstrapDashboard = async () => {
      try {
        const [meResponse, groupsResponse] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/groups", { credentials: "include" }),
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
    if (!groupName.trim()) { toast.error("Group name is required."); return; }

    setCreating(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), currency: groupCurrency }),
      });

      const data = await response.json();
      if (!response.ok) { toast.error(data.error || "Failed to create group"); return; }

      setGroups((prev) => [data.data.group, ...prev]);
      setGroupName("");
      setGroupCurrency("USD");
      setOpenCreateGroup(false);
      toast.success(`Group "${data.data.group.name}" created!`);
      router.push(`/groups/${data.data.group.id}`);
    } catch {
      toast.error("Something went wrong while creating your group.");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  const activeIdFromPath = useMemo(() => {
    const parts = pathname.split("/");
    if (parts[1] === "groups" && parts[2]) return parts[2];
    return undefined;
  }, [pathname]);

  const currentActiveGroupId = activeGroupId || activeIdFromPath;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-300 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
            <Wallet className="size-5 text-emerald-300 animate-pulse" />
          </div>
          <p className="text-sm text-slate-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const resolvedChildren =
    typeof children === "function" ? children({ user, groups }) : children;

  // ── Sidebar nav content (shared between desktop + mobile sheet) ──────────
  const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      <Link
        href="/"
        onClick={onNavigate}
        className={`block rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
          pathname === "/"
            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
            : "text-slate-300 hover:bg-slate-800/70"
        }`}
      >
        Overview
      </Link>
      {groups.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-500">No groups yet.</p>
      ) : (
        groups.map((group) => {
          const isActive = currentActiveGroupId === group.id;
          return (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              onClick={onNavigate}
              className={`block rounded-2xl px-3 py-2 text-sm transition-colors ${
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
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* ── Top nav bar ─────────────────────────────────────────────────── */}
      <header className="border-b border-emerald-900/40 bg-[#111b31] sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger
                render={
                  <button
                    className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Open navigation"
                  >
                    <Menu className="size-5" />
                  </button>
                }
              />
              <SheetContent
                side="left"
                className="w-72 bg-[#13203a] border-emerald-900/40 text-white p-0"
              >
                <SheetHeader className="px-4 pt-5 pb-3 border-b border-emerald-900/30">
                  <SheetTitle className="flex items-center gap-2 text-white">
                    <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                      <Wallet className="size-4 text-emerald-300" />
                    </div>
                    SplitEasy
                  </SheetTitle>
                </SheetHeader>
                <div className="px-3 py-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70 px-2 pb-2">
                      Your Groups
                    </p>
                    <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
                  </div>
                  <div className="border-t border-slate-700/50 pt-4 space-y-2">
                    <p className="text-xs text-slate-400 px-2 truncate">{user.email}</p>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full rounded-2xl px-3 py-2 text-sm text-slate-400 hover:text-rose-300 hover:bg-slate-800/70 transition-colors"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-2">
              <div className="size-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                <Wallet className="size-4" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 leading-none">
                  SplitEasy
                </p>
                <p className="text-sm font-semibold leading-tight">Dashboard</p>
              </div>
            </Link>
          </div>

          {/* Right side: user info + create group + mobile add expense */}
          <div className="flex items-center gap-2">
            {/* Mobile Add Expense - only shows when showAddExpense is true */}
            {showAddExpense && onAddExpense && (
              <button
                onClick={onAddExpense}
                className="lg:hidden flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-[44px]"
                aria-label="Add expense"
              >
                <Receipt className="size-4" />
                <span className="hidden xs:inline">Add</span>
              </button>
            )}

            <span className="hidden md:block text-xs text-slate-400 truncate max-w-40">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 transition-colors px-3 py-2 rounded-xl hover:bg-slate-800 min-h-[44px]"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>

            {/* Join Group Dialog */}
            <Dialog open={openJoinGroup} onOpenChange={setOpenJoinGroup}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    className="rounded-full px-3 sm:px-4 text-sm min-h-11 hidden lg:flex items-center gap-1.5 border-slate-600 bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white"
                  />
                }
              >
                <Link2 className="size-4" />
                <span className="hidden sm:inline">Join a Group</span>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 rounded-3xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join a Group</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Paste an invite link to join an existing expense group.
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!inviteLink.trim()) {
                      toast.error("Please paste an invite link.");
                      return;
                    }
                    setJoining(true);
                    try {
                      // Extract token from link (handles both full URLs and just tokens)
                      const tokenMatch = inviteLink.match(/inviteToken=([a-f0-9]+)/i) ||
                                        inviteLink.match(/join\/([a-f0-9]+)/i) ||
                                        inviteLink.match(/^([a-f0-9]{32,})$/i);
                      const token = tokenMatch ? tokenMatch[1] : inviteLink.trim();

                      const response = await fetch(`/api/groups/join/${token}`, {
                        method: "POST",
                        credentials: "include",
                      });
                      const data = await response.json();

                      if (!response.ok) {
                        toast.error(data.error || "Failed to join group");
                        return;
                      }

                      toast.success(`Joined "${data.data?.group?.name || "group"}" successfully!`);
                      setOpenJoinGroup(false);
                      setInviteLink("");
                      // Refresh groups list
                      const groupsRes = await fetch("/api/groups", { credentials: "include" });
                      if (groupsRes.ok) {
                        const groupsData = await groupsRes.json();
                        setGroups(groupsData.data.groups || []);
                      }
                      // Navigate to the new group
                      if (data.data?.group?._id) {
                        router.push(`/groups/${data.data.group._id}`);
                      }
                    } catch {
                      toast.error("Failed to join group. Please check the link and try again.");
                    } finally {
                      setJoining(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="invite-link">Invite Link</Label>
                    <Input
                      id="invite-link"
                      placeholder="https://spliteasy.app/join/abc123... or paste the token"
                      value={inviteLink}
                      onChange={(e) => setInviteLink(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-700"
                    />
                    <p className="text-xs text-slate-500">
                      You can paste the full invite link or just the invite token.
                    </p>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 bg-transparent hover:bg-slate-800"
                      onClick={() => {
                        setOpenJoinGroup(false);
                        setInviteLink("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={joining}
                      className="bg-emerald-500 hover:bg-emerald-600 rounded-2xl"
                    >
                      {joining ? "Joining…" : "Join Group"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Create Group Dialog */}
            <Dialog open={openCreateGroup} onOpenChange={setOpenCreateGroup}>
              <DialogTrigger
                render={
                  <Button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-3 sm:px-4 text-sm min-h-11 hidden lg:flex items-center gap-1.5 shadow-lg shadow-emerald-900/20" />
                }
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Create Group</span>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Create a new expense group</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Invite friends, roommates, or family and start tracking shared expenses.
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

                  <div className="space-y-2">
                    <Label htmlFor="group-currency">Currency</Label>
                    <select
                      id="group-currency"
                      value={groupCurrency}
                      onChange={(e) => setGroupCurrency(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                    >
                      <option value="USD">USD — US Dollar ($)</option>
                      <option value="INR">INR — Indian Rupee (₹)</option>
                      <option value="TZS">TZS — Tanzanian Shilling (Tsh)</option>
                    </select>
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
                      className="bg-emerald-500 hover:bg-emerald-600 rounded-2xl"
                    >
                      {creating ? "Creating…" : "Create Group"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* ── Page body ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-4 sm:py-6 grid gap-4 lg:gap-6 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block rounded-3xl border border-emerald-900/40 bg-[#13203a] p-4 h-fit sticky top-18.25">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70 px-2 pb-3">
            Your Groups
          </p>
          <SidebarNav />
          <div className="mt-4 border-t border-slate-700/50 pt-4">
            <p className="text-xs text-slate-500 px-2 truncate">{user.email}</p>
          </div>
        </aside>

        <main className="space-y-4 lg:space-y-6 min-w-0 pb-20 lg:pb-0">{resolvedChildren}</main>
      </div>
    </div>
  );
}
