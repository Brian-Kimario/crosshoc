"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ExportCsvButtonProps {
  groupId: string;
  groupName: string;
}

export function ExportCsvButton({ groupId, groupName }: ExportCsvButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/export-csv`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to export CSV");
        return;
      }

      // Stream the blob and trigger a browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `${groupName}_expenses.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={exporting}
      className="rounded-3xl border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white gap-2"
    >
      <Download className="size-4" />
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
