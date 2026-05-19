"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ChevronRight, Loader2, Receipt, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/lib/store/ui-store";

interface Group {
  _id: string;
  name: string;
  currency: string;
  memberCount: number;
}

interface GroupSelectionDialogProps {
  groups?: Array<{ _id: string; name: string; color?: string }>;
}

export function GroupSelectionDialog({ groups: initialGroups }: GroupSelectionDialogProps) {
  const { groupSelectOpen, setGroupSelectOpen, openAddExpense } = useUIStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transform and set groups when provided or when dialog opens
  useEffect(() => {
    if (initialGroups && initialGroups.length > 0) {
      console.log("GroupSelectionDialog - using initial groups:", initialGroups);
      // Transform the layout groups to our Group interface
      const transformedGroups = initialGroups.map((g: any) => ({
        _id: g._id,
        name: g.name,
        currency: "USD", // Default currency, will be updated from API if needed
        memberCount: 1, // Default member count, will be updated from API if needed
      }));
      console.log("GroupSelectionDialog - transformed initial groups:", transformedGroups);
      setGroups(transformedGroups);
      setLoading(false);
      return;
    }
    
    if (!groupSelectOpen) return;

    async function fetchGroups() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/groups");
        if (!res.ok) throw new Error("Failed to fetch groups");
        const data = await res.json();
        console.log("GroupSelectionDialog - API response:", data);
        // Transform the API response to our Group interface
        const transformedGroups = (data.groups || []).map((g: any) => {
          console.log("GroupSelectionDialog - processing group:", g);
          return {
            _id: g.id || g._id,
            name: g.name,
            currency: g.currency,
            memberCount: g.members?.length || 0,
          };
        });
        console.log("GroupSelectionDialog - transformed groups:", transformedGroups);
        console.log("GroupSelectionDialog - groups length:", transformedGroups.length);
        setGroups(transformedGroups);
      } catch (err) {
        console.error("GroupSelectionDialog - error fetching groups:", err);
        setError("Could not load your groups");
      } finally {
        setLoading(false);
      }
    }

    fetchGroups();
  }, [groupSelectOpen, initialGroups]);

  async function handleSelectGroup(group: Group) {
    // Fetch members for the selected group
    try {
      const res = await fetch(`/api/groups/${group._id}`);
      if (!res.ok) throw new Error("Failed to fetch group details");
      const data = await res.json();

      // Transform members to the format expected by AddExpenseWizard
      const members = (data.group?.members || []).map((m: any) => ({
        id: m.user._id || m.user.id,
        name: m.user.name,
      }));

      // Close group selection and open add expense
      setGroupSelectOpen(false);
      openAddExpense({
        id: group._id,
        name: group.name,
        currency: data.group?.currency || group.currency || "USD",
        members,
      });
    } catch (err) {
      setError("Could not load group members");
    }
  }

  return (
    <Dialog open={groupSelectOpen} onOpenChange={setGroupSelectOpen}>
      <DialogContent className="sm:max-w-md bg-[#0F172A] border-[#1E293B] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#10B981]" />
            Add an Expense
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-400 mb-4">
          Select a group to add this expense to:
        </p>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#10B981]" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 py-4 px-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm">
            <X className="w-4 h-4" />
            {error}
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">You&apos;re not in any groups yet</p>
            <p className="text-slate-500 text-xs mt-1">
              Create or join a group first to add expenses
            </p>
          </div>
        )}

        <AnimatePresence>
          {!loading && !error && groups.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 max-h-[60vh] overflow-y-auto"
            >
              {groups.map((group, index) => (
                <motion.button
                  key={group._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectGroup(group)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] hover:border-[#475569] transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-white">
                      {group.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
