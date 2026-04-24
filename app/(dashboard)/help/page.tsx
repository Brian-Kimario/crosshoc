import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#0B1221] p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <CardTitle className="text-white">Help Center</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400">
              Support center for Wasakatonge and SplitEasy partners is coming soon. 
              Please contact system admin for immediate assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
