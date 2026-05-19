"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { GroupSelectionDialog } from "./GroupSelectionDialog";
import { AddExpenseWizard } from "./AddExpenseWizard";
import { useCallback } from "react";

interface GlobalDialogsProps {
  groups?: Array<{ _id: string; name: string; color?: string }>;
  currentUserId?: string;
}

export function GlobalDialogs({ groups, currentUserId }: GlobalDialogsProps) {
  const { 
    addExpenseOpen, 
    setAddExpenseOpen, 
    groupSelectOpen,
    setGroupSelectOpen,
    selectedGroup,
    setSelectedGroup 
  } = useUIStore();

  const handleExpenseSuccess = useCallback(() => {
    setAddExpenseOpen(false);
    setSelectedGroup(null);
    // Refresh the page to show new expense
    window.location.reload();
  }, [setAddExpenseOpen, setSelectedGroup]);

  return (
    <>
      {/* Group Selection Dialog */}
      <GroupSelectionDialog groups={groups} />

      {/* Add Expense Wizard - opens after group selection */}
      {selectedGroup && (
        <AddExpenseWizard
          key={selectedGroup.id}
          open={addExpenseOpen}
          onOpenChange={(open) => {
            setAddExpenseOpen(open);
            if (!open) setSelectedGroup(null);
          }}
          groupId={selectedGroup.id}
          members={selectedGroup.members}
          currency={selectedGroup.currency}
          currentUserId={currentUserId}
          onSuccess={handleExpenseSuccess}
        />
      )}
    </>
  );
}
