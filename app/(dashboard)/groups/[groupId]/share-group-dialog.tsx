"use client";

import { useCallback, useMemo, useState } from "react";
import { Share2, RefreshCw, Clock, Copy, QrCode, Smartphone, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ShareGroupDialogProps {
  groupId: string;
  inviteToken: string;
  inviteExpiresAt?: string | null;
}

function getTimeRemaining(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function getTimeColor(expiresAt?: string | null): "green" | "amber" | "red" | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  if (hours > 24) return "green";
  if (hours > 6) return "amber";
  return "red";
}

export function ShareGroupDialog({ groupId, inviteToken, inviteExpiresAt }: ShareGroupDialogProps) {
  const [currentToken, setCurrentToken] = useState(inviteToken);
  const [currentExpiry, setCurrentExpiry] = useState(inviteExpiresAt);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const isExpired = useMemo(() => {
    if (!currentExpiry) return false;
    return new Date(currentExpiry).getTime() < Date.now();
  }, [currentExpiry]);

  const timeRemaining = getTimeRemaining(currentExpiry);
  const timeColor = getTimeColor(currentExpiry);

  const magicLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${currentToken}`;
  }, [currentToken]);

  const copyLink = async () => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(magicLink);
    } catch {
      // Fallback: use textarea + execCommand for focus/permission issues
      const el = document.createElement("textarea");
      el.value = magicLink;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        toast.error("Failed to copy magic link");
        document.body.removeChild(el);
        return;
      }
      document.body.removeChild(el);
    }
    toast.success("Magic link copied");
  };

  // Native share API for mobile
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  const nativeShare = async () => {
    if (!canNativeShare) {
      toast.error("Sharing not supported on this device");
      return;
    }
    try {
      await navigator.share({
        title: "Join my group on SplitEasy",
        text: "Let's split expenses together! Join my group on SplitEasy.",
        url: magicLink,
      });
    } catch (err) {
      // User cancelled share - no need to show error
      if ((err as Error).name !== "AbortError") {
        toast.error("Failed to share");
      }
    }
  };

  const refreshLink = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/refresh-invite`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to refresh link"); return; }
      setCurrentToken(data.data.inviteToken);
      setCurrentExpiry(data.data.inviteExpiresAt);
      toast.success("New invite link generated — valid for 72 hours");
    } catch {
      toast.error("Failed to refresh link");
    } finally {
      setRefreshing(false);
    }
  }, [groupId]);

  const sendEmailInvite = useCallback(async () => {
    const email = emailInput.trim();
    if (!email) { toast.error("Enter an email address"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { toast.error("Enter a valid email address"); return; }

    setSendingEmail(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientEmail: email,
          recipientName: nameInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to send invite"); return; }
      toast.success(`Invite sent to ${email}`);
      setEmailInput("");
      setNameInput("");
    } catch {
      toast.error("Failed to send invite email");
    } finally {
      setSendingEmail(false);
    }
  }, [groupId, emailInput, nameInput]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white" />}
      >
        <Share2 className="size-4 mr-2" />
        Share Group
      </DialogTrigger>
      <DialogContent className="rounded-3xl bg-slate-900 border border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Share this group</DialogTitle>
          <DialogDescription className="text-slate-300">
            Send this magic link to invite members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Expiry status with color coding */}
          {isExpired ? (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
              <Clock className="size-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                This link has expired. Generate a new one to invite members.
              </p>
            </div>
          ) : timeRemaining ? (
            <div
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
                timeColor === "green"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : timeColor === "amber"
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-rose-500/10 border border-rose-500/30"
              }`}
            >
              <Clock
                className={`size-4 shrink-0 ${
                  timeColor === "green"
                    ? "text-emerald-400"
                    : timeColor === "amber"
                      ? "text-amber-400"
                      : "text-rose-400"
                }`}
              />
              <p
                className={`text-sm ${
                  timeColor === "green"
                    ? "text-emerald-300"
                    : timeColor === "amber"
                      ? "text-amber-300"
                      : "text-rose-300"
                }`}
              >
                {timeRemaining}
              </p>
            </div>
          ) : null}

          {/* QR Code Toggle */}
          {!isExpired && (
            <Button
              variant="outline"
              onClick={() => setShowQR(!showQR)}
              className="w-full rounded-3xl border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300"
            >
              <QrCode className="size-4 mr-2" />
              {showQR ? "Hide QR Code" : "Show QR Code"}
            </Button>
          )}

          {/* QR Code Display */}
          {showQR && !isExpired && magicLink && (
            <div className="flex justify-center py-4">
              <div className="bg-white p-4 rounded-2xl">
                <QRCodeSVG value={magicLink} size={200} />
              </div>
            </div>
          )}

          <Input
            readOnly
            value={isExpired ? "Link expired" : magicLink}
            className={`bg-slate-950 border-slate-700 ${isExpired ? "text-slate-500" : "text-slate-200"}`}
          />

          {isExpired ? (
            <Button
              onClick={refreshLink}
              disabled={refreshing}
              className="w-full rounded-3xl bg-amber-500 hover:bg-amber-600 text-white"
            >
              <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Generating..." : "Generate New Link"}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {canNativeShare && (
                <Button
                  onClick={nativeShare}
                  className="flex-1 rounded-3xl bg-emerald-500 hover:bg-emerald-600 sm:hidden"
                >
                  <Smartphone className="size-4 mr-2" />
                  Share
                </Button>
              )}
              <Button
                onClick={copyLink}
                className="flex-1 rounded-3xl bg-emerald-500 hover:bg-emerald-600"
              >
                <Copy className="size-4 mr-2" />
                Copy Link
              </Button>
              <Button
                onClick={refreshLink}
                disabled={refreshing}
                variant="outline"
                className="rounded-3xl border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300"
                title="Refresh link"
              >
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          )}

          {/* Email invite section */}
          <div className="pt-3 border-t border-slate-700/50">
            <p className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Mail className="size-4 text-emerald-400" />
              Send invite by email
            </p>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Name (optional)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
              />
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="friend@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendEmailInvite(); }}
                  className="bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500 flex-1"
                />
                <Button
                  onClick={sendEmailInvite}
                  disabled={sendingEmail || !emailInput.trim()}
                  className="rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                >
                  {sendingEmail ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
