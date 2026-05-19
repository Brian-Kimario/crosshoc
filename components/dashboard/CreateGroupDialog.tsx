"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, X, CheckCircle, Users, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { mutate } from "swr";
import { keys } from "@/lib/swr-keys";
import { invalidateGroups } from "@/lib/invalidate";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ groupId: string; groupName: string } | null>(null);
  const router = useRouter();

  const handleAddMember = () => {
    if (memberInput.trim() && !members.includes(memberInput.trim())) {
      setMembers([...members, memberInput.trim()]);
      setMemberInput("");
    }
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    // Create optimistic group
    const optimisticGroup = {
      _id: `temp-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      members: [{ _id: "current-user", name: "You", email: "" }],
      myBalance: 0,
      expenseCount: 0,
      currency: "USD",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Optimistically add to dashboard
    await mutate(
      keys.dashboardOverview(),
      (current: any) => ({
        ...current,
        groups: [optimisticGroup, ...(current?.groups ?? [])],
      }),
      { revalidate: false }
    );

    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Roll back optimistic update
        await mutate(
          keys.dashboardOverview(),
          (current: any) => ({
            ...current,
            groups: (current?.groups ?? []).filter(
              (g: any) => g._id !== optimisticGroup._id
            ),
          }),
          { revalidate: false }
        );
        toast.error(data.error || "Failed to create group");
        setLoading(false);
        return;
      }

      // Revalidate to get real data
      await invalidateGroups();

      const groupId = data.data?.group?.id || data.data?._id;
      const groupName = data.data?.group?.name || data.data?.name;

      // Send email invites to all added members (fire-and-forget, don't block success)
      if (members.length > 0 && groupId) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailInvites = members.filter((m) => emailRegex.test(m));
        for (const email of emailInvites) {
          fetch(`/api/groups/${groupId}/invite/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipientEmail: email }),
          }).catch(() => {
            // Silently ignore invite failures — group was still created
          });
        }
        if (emailInvites.length > 0) {
          toast.success(`Invite${emailInvites.length > 1 ? "s" : ""} sent to ${emailInvites.length} ${emailInvites.length > 1 ? "people" : "person"}`);
        }
        const nonEmails = members.filter((m) => !emailRegex.test(m));
        if (nonEmails.length > 0) {
          toast.info(`Note: "${nonEmails.join(", ")}" — invites can only be sent to email addresses. Share the group link with them instead.`);
        }
      }

      setSuccess({ groupId, groupName });
      toast.success("Group created successfully!");

      // Redirect after delay
      setTimeout(() => {
        onOpenChange(false);
        if (groupId) {
          router.push(`/groups/${groupId}`);
        }
      }, 1500);
    } catch (err: any) {
      // Roll back optimistic update
      await mutate(
        keys.dashboardOverview(),
        (current: any) => ({
          ...current,
          groups: (current?.groups ?? []).filter(
            (g: any) => g._id !== optimisticGroup._id
          ),
        }),
        { revalidate: false }
      );
      toast.error(err.message || "An error occurred");
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setMemberInput("");
    setMembers([]);
    setSuccess(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0F172A] border-[#1E293B] text-slate-100 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-teal-400" />
            Create New Group
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Start a new group to split expenses with friends
          </DialogDescription>
        </DialogHeader>

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
                Group created!
              </h3>
              <p className="text-slate-400">
                <span className="text-teal-400">{success.groupName}</span> is ready to go
              </p>
              <p className="text-sm text-slate-500 mt-2">Redirecting...</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-5 mt-4"
            >
              {/* Group Name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Group name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bali Trip 2025"
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all"
                  disabled={loading}
                  autoCapitalize="words"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Description <span className="text-slate-600">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this group for?"
                  rows={2}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all resize-none"
                  disabled={loading}
                  autoCapitalize="sentences"
                />
              </div>

              {/* Members */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Invite members <span className="text-slate-600">(optional — email addresses only)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMember();
                      }
                    }}
                    placeholder="friend@email.com"
                    className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!memberInput.trim()}
                    className="px-4 py-2.5 bg-[#334155] hover:bg-[#475569] text-slate-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                {/* Member tags */}
                <AnimatePresence>
                  {members.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap gap-2 mt-3"
                    >
                      {members.map((member, index) => (
                        <motion.span
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B98120] border border-[#10B98140] text-teal-300 text-sm rounded-full"
                        >
                          <Tag className="w-3 h-3" />
                          {member}
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(index)}
                            className="ml-1 text-teal-400 hover:text-teal-200"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading || !name.trim()}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 px-4 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Group
                  </>
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
