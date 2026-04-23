"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InviteGroup {
  id: string;
  name: string;
}

export default function JoinConfirmationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<InviteGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const checkInvite = async () => {
      try {
        const meResponse = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!meResponse.ok) {
          router.replace(`/register?redirect=/join/${params.token}`);
          return;
        }

        const inviteResponse = await fetch(`/api/groups/join/${params.token}`);
        const inviteData = await inviteResponse.json();

        if (!inviteResponse.ok) {
          toast.error(inviteData.error || "Invite link is invalid");
          router.replace("/");
          return;
        }

        setGroup(inviteData.data.group);
      } catch {
        toast.error("Could not load invitation");
      } finally {
        setLoading(false);
      }
    };

    checkInvite();
  }, [params.token, router]);

  const acceptInvite = async () => {
    setJoining(true);
    try {
      const response = await fetch(`/api/groups/join/${params.token}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Could not join group");
        return;
      }

      toast.success(`You joined ${data.data.group.name}`);
      router.push(`/groups/${data.data.group.id}`);
    } catch {
      toast.error("Could not join group");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-300 flex items-center justify-center">
        Loading invite...
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg rounded-3xl bg-slate-800 border-slate-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">You&apos;ve been invited to join {group.name}</CardTitle>
          <CardDescription className="text-slate-300">
            Accept this invitation to join the group and start splitting expenses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={acceptInvite}
            disabled={joining}
            className="w-full rounded-3xl bg-emerald-500 hover:bg-emerald-600"
          >
            {joining ? "Joining..." : "Accept & Join"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
