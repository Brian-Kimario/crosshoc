"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GuestLandingClientProps {
  token: string;
  groupName: string;
  inviterName: string;
}

export default function GuestLandingClient({
  token,
  groupName,
  inviterName,
}: GuestLandingClientProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter your name.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/guest/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, displayName: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      toast.success(`Welcome, ${trimmed}!`);
      router.push(`/invite/${token}/dashboard`);
    } catch {
      toast.error("Failed to join. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Icon */}
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        {/* Invitation text */}
        <div className="text-center space-y-2">
          <p className="text-sm text-slate-400 uppercase tracking-wider">
            You&apos;ve been invited to
          </p>
          <h1 className="text-3xl font-bold text-white">{groupName}</h1>
          <p className="text-slate-400">
            by <span className="text-emerald-400">{inviterName}</span>
          </p>
        </div>

        {/* Name input card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 space-y-4">
          <label className="block text-sm font-medium text-slate-300">
            What should we call you?
          </label>
          <Input
            type="text"
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-12"
            autoFocus
          />
          <Button
            onClick={handleJoin}
            disabled={loading || !name.trim()}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-medium"
          >
            {loading ? "Joining..." : (
              <>
                View my balance
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500">
          No account needed. Your session lasts 30 days.
        </p>
      </div>
    </div>
  );
}
