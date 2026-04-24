"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, LogIn, UserPlus, Loader2, Receipt, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, getCurrencySymbol, type SupportedCurrency } from "@/lib/format-utils";

// ── Cookie helpers (client-side, non-httpOnly) ────────────────────────────────

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function generateGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuestExpense {
  _id: string;
  description: string;
  amount: number;
  category: string;
  guestName: string;
  createdAt: string;
}

interface InviteGroup {
  id: string;
  name: string;
  currency: SupportedCurrency;
}

type PageState = "loading" | "name-entry" | "sandbox" | "expired" | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export default function GuestSandboxPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [group, setGroup] = useState<InviteGroup | null>(null);

  const [guestId, setGuestId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [nameInput, setNameInput] = useState("");

  const [expenses, setExpenses] = useState<GuestExpense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupExpenseCount, setGroupExpenseCount] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [saving, setSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // If already logged in, join the group directly via API
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.ok) {
          const joinRes = await fetch(`/api/groups/join/${params.token}`, {
            method: "POST",
            credentials: "include",
          });
          const joinData = await joinRes.json();

          if (!joinRes.ok) {
            if (joinRes.status === 410) {
              setPageState("expired");
            } else {
              toast.error(joinData.error || "Failed to join group");
              setPageState("error");
            }
            return;
          }

          toast.success(`Joined "${joinData.data?.group?.name || "group"}" successfully!`);
          // Navigate to the group page
          if (joinData.data?.group?.id) {
            router.replace(`/groups/${joinData.data.group.id}`);
          } else {
            router.replace("/dashboard");
          }
          return;
        }

        // Validate invite token for guests
        const inviteRes = await fetch(`/api/groups/join/${params.token}`);
        const inviteData = await inviteRes.json();

        if (inviteRes.status === 410) { setPageState("expired"); return; }
        if (!inviteRes.ok) { setPageState("error"); return; }

        const groupData: InviteGroup = {
          id: inviteData.data.group.id,
          name: inviteData.data.group.name,
          currency: inviteData.data.group.currency || "USD",
        };
        setGroup(groupData);

        // Restore guest session from cookies
        const storedId = getCookie("guestId");
        const storedName = getCookie("guestName");

        if (storedId && storedName) {
          setGuestId(storedId);
          setGuestName(storedName);
          setPageState("sandbox");
          loadGuestExpenses(storedId, groupData.id);
          loadGroupTotal(groupData.id);
        } else {
          setPageState("name-entry");
        }
      } catch {
        setPageState("error");
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  useEffect(() => {
    if (pageState === "name-entry") {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [pageState]);

  // ── Load existing guest expenses ──────────────────────────────────────────

  const loadGuestExpenses = async (gId: string, groupId: string) => {
    try {
      const res = await fetch(
        `/api/guest/expenses?groupId=${groupId}&token=${params.token}&guestId=${encodeURIComponent(gId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const list: GuestExpense[] = data.data.expenses || [];
      setExpenses(list);
      setTotalSpent(list.reduce((sum, e) => sum + e.amount, 0));
    } catch {
      // non-fatal
    }
  };

  const loadGroupTotal = async (groupId: string) => {
    try {
      const res = await fetch(
        `/api/guest/group-total?groupId=${groupId}&token=${params.token}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setGroupTotal(data.data.total ?? 0);
      setGroupExpenseCount(data.data.count ?? 0);
    } catch {
      // non-fatal
    }
  };

  // ── Enter display name ────────────────────────────────────────────────────

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) { toast.error("Please enter a display name"); return; }
    const id = generateGuestId();
    setCookie("guestId", id);
    setCookie("guestName", trimmed);
    setGuestId(id);
    setGuestName(trimmed);
    setPageState("sandbox");
    toast.success(`Welcome, ${trimmed}!`);
    if (group) loadGroupTotal(group.id);
  };

  // ── Add expense ───────────────────────────────────────────────────────────

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!group) return;

    const parsedAmount = Number(amount);
    if (!description.trim() || parsedAmount <= 0) {
      toast.error("Please fill in description and a valid amount");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/guest/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId,
          guestName,
          groupId: group.id,
          token: params.token,
          description: description.trim(),
          amount: parsedAmount,
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to add expense"); return; }

      const newExpense: GuestExpense = {
        _id: data.data.expense._id,
        description: data.data.expense.description,
        amount: data.data.expense.amount,
        category: data.data.expense.category,
        guestName,
        createdAt: data.data.expense.createdAt,
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setTotalSpent((prev) => prev + newExpense.amount);
      setGroupTotal((prev) => prev + newExpense.amount);
      setGroupExpenseCount((prev) => prev + 1);
      setDescription("");
      setAmount("");
      setCategory("other");
      setAddOpen(false);
      toast.success("Expense added!");
    } catch {
      toast.error("Failed to add expense");
    } finally {
      setSaving(false);
    }
  };

  // ── Claim flow ────────────────────────────────────────────────────────────

  const handleClaim = (mode: "register" | "login") => {
    const redirectPath = `/join/${params.token}`;
    router.push(
      `/${mode}?redirect=${encodeURIComponent(redirectPath)}&guestId=${encodeURIComponent(guestId)}`
    );
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="size-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-3xl bg-slate-800 border-amber-500/40 text-white text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-amber-400">Link Expired</CardTitle>
            <CardDescription className="text-slate-300">
              This invite link has expired. Ask the group creator to generate a new one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-3xl bg-slate-800 border-slate-700 text-white text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-rose-400">Invalid Link</CardTitle>
            <CardDescription className="text-slate-300">
              This invite link is invalid or no longer exists.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (pageState === "name-entry") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-3xl bg-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">
              You&apos;re invited to{" "}
              <span className="text-emerald-400">{group?.name}</span>
            </CardTitle>
            <CardDescription className="text-slate-300">
              Enter a display name to start adding expenses — no account needed yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Alex"
                  className="bg-slate-950 border-slate-700 text-white"
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-3xl bg-emerald-500 hover:bg-emerald-600">
                Enter as Guest
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Sandbox view ──────────────────────────────────────────────────────────

  const currency = group?.currency ?? "USD";
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Guest Sandbox</p>
            <h1 className="text-lg font-bold">{group?.name}</h1>
          </div>
          <span className="text-xs text-slate-400 hidden sm:block">
            Signed in as <span className="text-emerald-300">{guestName}</span>
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Total Spent teaser */}
        <Card className="rounded-3xl bg-linear-to-br from-emerald-900/40 to-slate-800 border-emerald-500/30">
          <CardContent className="p-6">
            <p className="text-sm text-emerald-300 mb-1">Total Spent So Far</p>
            <p className="text-4xl font-bold">{formatCurrency(groupTotal, currency)}</p>
            <p className="text-xs text-slate-400 mt-2">
              {groupExpenseCount} expense{groupExpenseCount !== 1 ? "s" : ""} in this group
            </p>
            {totalSpent > 0 && (
              <p className="text-xs text-emerald-400 mt-1">
                You added {formatCurrency(totalSpent, currency)} of that
              </p>
            )}
          </CardContent>
        </Card>

        {/* Claim CTA */}
        <Card className="rounded-3xl bg-slate-800 border-amber-500/30">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-amber-300 mb-1">🔒 Claim this group</p>
            <p className="text-xs text-slate-400 mb-4">
              Create an account or log in to permanently save your expenses and join the group.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleClaim("register")}
                className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-sm"
              >
                <UserPlus className="size-4 mr-2" />
                Sign Up
              </Button>
              <Button
                onClick={() => handleClaim("login")}
                variant="outline"
                className="flex-1 rounded-2xl border-slate-600 bg-transparent hover:bg-slate-700 text-sm"
              >
                <LogIn className="size-4 mr-2" />
                Log In
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add expense */}
        <div className="flex items-center justify-between">
          <p className="font-semibold">Your Expenses</p>
          <Button
            onClick={() => setAddOpen((v) => !v)}
            className="rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-sm"
          >
            <Plus className="size-4 mr-2" />
            Add Expense
          </Button>
        </div>

        {addOpen && (
          <Card className="rounded-3xl bg-slate-800 border-slate-700">
            <CardContent className="p-5">
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Dinner at SeaSalt"
                    className="bg-slate-950 border-slate-700"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="amt">Amount ({symbol})</Label>
                    <Input
                      id="amt"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-slate-950 border-slate-700"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat">Category</Label>
                    <select
                      id="cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                    >
                      {["food", "rent", "travel", "transport", "entertainment", "grocery", "other"].map(
                        (c) => (
                          <option key={c} value={c}>
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-slate-700 bg-transparent hover:bg-slate-700"
                    onClick={() => setAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-3xl bg-emerald-500 hover:bg-emerald-600"
                  >
                    {saving ? "Saving..." : "Save Expense"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Expense list */}
        {expenses.length === 0 ? (
          <div className="rounded-3xl border border-slate-700 bg-slate-800/70 p-8 text-center">
            <Receipt className="size-10 text-slate-500 mx-auto mb-3" />
            <p className="font-semibold">No expenses yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Add your first expense above — it will be saved to your account when you sign up.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <Card key={expense._id} className="rounded-3xl border-slate-700 bg-slate-800/80">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{expense.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {expense.category} · {new Date(expense.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-emerald-400 shrink-0">
                    {formatCurrency(expense.amount, currency)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
