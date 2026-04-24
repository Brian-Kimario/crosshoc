import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ExpiredPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function ExpiredInvitePage({ searchParams }: ExpiredPageProps) {
  const { reason } = await searchParams;

  const messages: Record<string, string> = {
    EXPIRED: "This invite link has expired. Links are valid for 72 hours.",
    USED: "This invite link has already been used and is single-use only.",
    NOT_FOUND: "This invite link doesn't exist or has been deleted.",
  };

  const message = messages[reason || ""] || "This invite link is no longer valid.";

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-3xl bg-slate-800 border-rose-500/30 text-white text-center">
        <CardHeader className="space-y-4">
          <div className="w-16 h-16 bg-rose-500/20 rounded-3xl flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-rose-400" />
          </div>
          <CardTitle className="text-2xl text-rose-400">Link Expired</CardTitle>
          <CardDescription className="text-slate-300 text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            Ask the person who sent it to generate a new invite link.
          </p>
          <Link href="/">
            <Button
              variant="outline"
              className="w-full rounded-2xl border-slate-600 bg-transparent hover:bg-slate-700 text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
