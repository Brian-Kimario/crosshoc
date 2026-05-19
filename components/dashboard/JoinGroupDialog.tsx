"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Loader2, X, CheckCircle, AlertCircle, Clipboard, Camera, ScanLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Dynamic import for QR scanner to avoid SSR issues
let Html5QrcodeScanner: any = null;

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinGroupDialog({ open, onOpenChange }: JoinGroupDialogProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "scan">("paste");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ groupName: string; groupId: string } | null>(null);
  const router = useRouter();

  const handleJoin = async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/join/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid or expired invite link");
        setLoading(false);
        return false;
      }

      setSuccess({ groupName: data.data?.group?.name || "Group", groupId: data.data?.group?._id });
      toast.success(`Joined ${data.data?.group?.name || "group"}!`);

      setTimeout(() => {
        onOpenChange(false);
        if (data.data?.group?._id) {
          router.push(`/groups/${data.data.group._id}`);
          router.refresh();
        }
      }, 1500);
      return true;
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
      return false;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const match = input.match(/\/join\/([a-zA-Z0-9_-]+)/) || input.match(/\/invite\/([a-zA-Z0-9_-]+)/);
    const token = match ? match[1] : input.trim();
    if (!token) {
      setError("Please enter a valid invite link or token");
      return;
    }
    await handleJoin(token);
  };

  const handleClose = () => {
    setInput("");
    setError("");
    setSuccess(null);
    setActiveTab("paste");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0F172A] border-[#1E293B] text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-400" />
            Join a Group
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Join an existing expense group
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        {!success && (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "paste"
                  ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]"
                  : "bg-[#1E293B] text-slate-400 border border-[#334155] hover:border-[#475569]"
              }`}
            >
              <Clipboard className="w-4 h-4" />
              Paste link
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scan")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "scan"
                  ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]"
                  : "bg-[#1E293B] text-slate-400 border border-[#334155] hover:border-[#475569]"
              }`}
            >
              <Camera className="w-4 h-4" />
              Scan QR
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-950 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-100 mb-2">
                Successfully joined!
              </h3>
              <p className="text-slate-400">
                You are now a member of <span className="text-teal-400">{success.groupName}</span>
              </p>
              <p className="text-sm text-slate-500 mt-2">Redirecting...</p>
            </motion.div>
          ) : activeTab === "paste" ? (
            <motion.form
              key="paste"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleFormSubmit}
              className="space-y-4 mt-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Invite link or token
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="url"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="https://spliteasy.app/join/abc123 or abc123"
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all"
                    disabled={loading}
                  />
                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Example: https://spliteasy.app/join/abc123 or just abc123
                </p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-rose-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading || !input.trim()}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 px-4 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Group"
                )}
              </motion.button>
            </motion.form>
          ) : (
            <motion.div
              key="scan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mt-4"
            >
              <QRScannerTab onResult={(token) => handleJoin(token)} loading={loading} />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function QRScannerTab({ onResult, loading }: { onResult: (token: string) => Promise<boolean>; loading: boolean }) {
  const [status, setStatus] = useState<"scanning" | "success" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scanner: any = null;

    const initScanner = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const mod = await import("html5-qrcode");
        const Html5QrcodeScanner = mod.Html5QrcodeScanner;

        if (!containerRef.current) return;

        scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true,
          },
          false
        );

        scanner.render(
          async (decodedText: string) => {
            // Extract token from scanned URL
            const match = decodedText.match(/\/invite\/([a-zA-Z0-9_-]+)/) || decodedText.match(/\/join\/([a-zA-Z0-9_-]+)/);
            const token = match ? match[1] : decodedText.trim();

            if (token) {
              setStatus("success");
              try {
                await scanner.clear();
              } catch {}
              await onResult(token);
            } else {
              setStatus("error");
              setErrorMsg("Could not read invite code from QR");
            }
          },
          (errorMessage: string) => {
            // QR code scanning errors are expected when no code is visible
            // We don't surface these to the user
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error("Failed to initialize QR scanner:", err);
        setStatus("error");
        setErrorMsg("Camera access denied or not available");
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [onResult]);

  if (status === "success" || loading) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
        </div>
        <h3 className="text-lg font-medium text-slate-100 mb-2">QR code detected</h3>
        <p className="text-slate-400">Joining group...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <ScanLine className="w-8 h-8 text-rose-400" />
        </div>
        <p className="text-rose-400 mb-4">{errorMsg}</p>
        <p className="text-sm text-slate-500">Try the "Paste link" tab instead</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        id="qr-reader"
        className="rounded-xl overflow-hidden bg-[#1E293B]"
        style={{ minHeight: 250 }}
      />
      <p className="text-sm text-center text-slate-400">
        Point your camera at the QR code shown on the group owner&apos;s screen
      </p>
    </div>
  );
}
