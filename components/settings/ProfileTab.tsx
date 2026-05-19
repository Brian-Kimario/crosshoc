"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Camera, Trash2, Loader2, CheckCircle, XCircle, User } from "lucide-react";
import { keys } from "@/lib/swr-keys";
import { UserAvatar } from "@/components/ui/UserAvatar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  preferences: {
    currency: string;
    splitMethod: "equal" | "percent" | "exact";
    timezone: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "TZS", label: "TZS — Tanzanian Shilling" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
];

const SPLIT_METHOD_OPTIONS = [
  { value: "equal",   label: "Equal — split evenly" },
  { value: "percent", label: "Percent — split by percentage" },
  { value: "exact",   label: "Exact — enter exact amounts" },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Avatar skeleton */}
      <div className="flex items-center gap-4">
        <div className="size-20 rounded-full bg-slate-700" />
        <div className="space-y-2">
          <div className="h-9 w-28 rounded-lg bg-slate-700" />
          <div className="h-9 w-24 rounded-lg bg-slate-700" />
        </div>
      </div>
      {/* Fields skeleton */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-24 rounded bg-slate-700" />
          <div className="h-10 w-full rounded-lg bg-slate-700" />
        </div>
      ))}
      {/* Save button skeleton */}
      <div className="h-11 w-24 rounded-lg bg-slate-700" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileTab() {
  const { data, isLoading } = useSWR<{ user: UserProfile }>(keys.profile());

  // Local form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio]                 = useState("");
  const [currency, setCurrency]       = useState("USD");
  const [splitMethod, setSplitMethod] = useState<"equal" | "percent" | "exact">("equal");

  // UI state
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [removing, setRemoving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Sync local state when SWR data loads
  useEffect(() => {
    if (data?.user) {
      setDisplayName(data.user.displayName ?? "");
      setBio(data.user.bio ?? "");
      setCurrency(data.user.preferences?.currency ?? "USD");
      setSplitMethod(data.user.preferences?.splitMethod ?? "equal");
    }
  }, [data]);

  // ── Avatar upload ──────────────────────────────────────────────────────────

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setAvatarError(json.error ?? "Upload failed. Please try again.");
      } else {
        await mutate(keys.profile());
      }
    } catch {
      setAvatarError("Upload failed. Please check your connection.");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Avatar remove ──────────────────────────────────────────────────────────

  async function handleAvatarRemove() {
    setAvatarError(null);
    setRemoving(true);

    try {
      const res = await fetch("/api/user/avatar", {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok) {
        setAvatarError(json.error ?? "Remove failed. Please try again.");
      } else {
        await mutate(keys.profile());
      }
    } catch {
      setAvatarError("Remove failed. Please check your connection.");
    } finally {
      setRemoving(false);
    }
  }

  // ── Save profile ───────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          preferences: { currency, splitMethod },
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSaveError(json.error ?? "Save failed. Please try again.");
      } else {
        await mutate(keys.profile());
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError("Save failed. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const user = data?.user;
  const displayedName = user?.displayName || user?.name || "User";

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* ── Avatar section ── */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">
          Profile photo
        </label>

        <div className="flex items-center gap-4">
          {/* Avatar preview */}
          <div className="relative shrink-0">
            <UserAvatar
              name={displayedName}
              avatarUrl={user?.avatarUrl}
              size={80}
              className="ring-2 ring-slate-700"
            />
            {(uploading || removing) && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="size-5 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Upload / Remove buttons */}
          <div className="flex flex-col gap-2">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
              aria-label="Upload profile photo"
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || removing}
              style={{ minHeight: "44px", fontSize: "16px" }}
              className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="size-4 shrink-0" />
              {uploading ? "Uploading…" : "Upload photo"}
            </button>

            {user?.avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploading || removing}
                style={{ minHeight: "44px", fontSize: "16px" }}
                className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="size-4 shrink-0" />
                {removing ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
        </div>

        {/* Avatar error */}
        {avatarError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            <XCircle className="size-4 shrink-0" />
            <span>{avatarError}</span>
          </div>
        )}

        <p className="text-xs text-slate-500">
          JPEG, PNG, or WebP · Max 5 MB · Cropped to 256×256
        </p>
      </div>

      {/* ── Display name ── */}
      <div className="space-y-1.5">
        <label
          htmlFor="displayName"
          className="block text-sm font-medium text-slate-300"
        >
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          placeholder={user?.name ?? "Your display name"}
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <p className="text-xs text-slate-500">
          Shown instead of your account name · {displayName.length}/50
        </p>
      </div>

      {/* ── Bio ── */}
      <div className="space-y-1.5">
        <label
          htmlFor="bio"
          className="block text-sm font-medium text-slate-300"
        >
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="A short bio about yourself…"
          style={{ fontSize: "16px" }}
          className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <p className="text-xs text-slate-500">{bio.length}/200</p>
      </div>

      {/* ── Currency ── */}
      <div className="space-y-1.5">
        <label
          htmlFor="currency"
          className="block text-sm font-medium text-slate-300"
        >
          Default currency
        </label>
        <select
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {CURRENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Pre-selected when you add a new expense
        </p>
      </div>

      {/* ── Split method ── */}
      <div className="space-y-1.5">
        <label
          htmlFor="splitMethod"
          className="block text-sm font-medium text-slate-300"
        >
          Default split method
        </label>
        <select
          id="splitMethod"
          value={splitMethod}
          onChange={(e) => setSplitMethod(e.target.value as "equal" | "percent" | "exact")}
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {SPLIT_METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Pre-selected when you add a new expense
        </p>
      </div>

      {/* ── Save feedback ── */}
      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          <XCircle className="size-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          <CheckCircle className="size-4 shrink-0" />
          <span>Profile saved successfully.</span>
        </div>
      )}

      {/* ── Save button ── */}
      <button
        type="submit"
        disabled={saving}
        style={{ minHeight: "44px", fontSize: "16px" }}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? "Saving…" : "Save changes"}
      </button>

    </form>
  );
}
