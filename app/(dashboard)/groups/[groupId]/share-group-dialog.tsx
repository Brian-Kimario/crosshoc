"use client";

import { useMemo } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

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
  inviteToken: string;
}

export function ShareGroupDialog({ inviteToken }: ShareGroupDialogProps) {
  const magicLink = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/join/${inviteToken}`;
  }, [inviteToken]);

  const copyLink = async () => {
    if (!magicLink) return;

    try {
      await navigator.clipboard.writeText(magicLink);
      toast.success("Magic link copied");
    } catch {
      toast.error("Failed to copy magic link");
    }
  };

  return (
    <Dialog>
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
          <Input
            readOnly
            value={magicLink}
            className="bg-slate-950 border-slate-700 text-slate-200"
          />
          <Button onClick={copyLink} className="w-full rounded-3xl bg-emerald-500 hover:bg-emerald-600">
            Copy Magic Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
