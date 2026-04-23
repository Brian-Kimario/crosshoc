"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface CopyMagicLinkButtonProps {
  inviteToken: string;
}

export function CopyMagicLinkButton({ inviteToken }: CopyMagicLinkButtonProps) {
  const copyMagicLink = async () => {
    const inviteUrl = `${window.location.origin}/join/${inviteToken}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Magic link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button onClick={copyMagicLink} className="bg-emerald-500 hover:bg-emerald-600">
      <Copy className="size-4 mr-2" />
      Copy Magic Link
    </Button>
  );
}
