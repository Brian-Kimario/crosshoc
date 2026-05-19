import { Receipt } from "lucide-react";
import { ExpensesFeed } from "@/components/expenses/ExpensesFeed";

export const metadata = {
  title: "Expenses — SplitEasy",
  description: "All expenses across your groups",
};

export default function ExpensesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="size-5 text-emerald-400" />
            <h1 className="text-xl font-semibold text-slate-100">Your Expenses</h1>
          </div>
          <p className="text-sm text-slate-500">
            All expenses across your groups
          </p>
        </div>
      </div>

      {/* Feed — client component handles data fetching + infinite scroll */}
      <ExpensesFeed />
    </div>
  );
}
