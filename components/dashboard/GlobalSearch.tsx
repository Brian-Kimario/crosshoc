"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  Receipt,
  X,
  PlusCircle,
  UserPlus,
  Loader2,
  ChevronRight,
  Command,
} from "lucide-react";
import { useUIStore } from "@/lib/store/ui-store";
import { formatMoney } from "@/lib/money-utils";

interface SearchResult {
  type: "group" | "expense" | "action";
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  action?: () => void;
  amount?: number;
  currency?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { setCreateGroupOpen, setJoinGroupOpen, setGroupSelectOpen } = useUIStore();

  // Static quick actions (always shown when no query)
  const quickActions: SearchResult[] = [
    {
      type: "action",
      id: "create-group",
      title: "Create a group",
      subtitle: "Start splitting with friends",
      action: () => {
        close();
        setCreateGroupOpen(true);
      },
    },
    {
      type: "action",
      id: "join-group",
      title: "Join a group",
      subtitle: "Paste a link or scan QR",
      action: () => {
        close();
        setJoinGroupOpen(true);
      },
    },
    {
      type: "action",
      id: "add-expense",
      title: "Add an expense",
      subtitle: "Quickly log a new expense",
      action: () => {
        close();
        // Longer delay to ensure dialog opens after any navigation completes
        setTimeout(() => {
          console.log("GlobalSearch: Opening group selection dialog");
          setGroupSelectOpen(true);
        }, 300);
      },
    },
  ];

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => runSearch(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function runSearch(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();

      const mapped: SearchResult[] = [];

      // Groups
      (data.groups ?? []).forEach((g: any) => {
        mapped.push({
          type: "group",
          id: g._id,
          title: g.name,
          subtitle: `${g.memberCount} members · ${g.expenseCount} expenses`,
          href: `/groups/${g._id}`,
        });
      });

      // Expenses
      (data.expenses ?? []).forEach((e: any) => {
        mapped.push({
          type: "expense",
          id: e._id,
          title: e.description,
          subtitle: `${e.groupName} · ${
            e.amount ? formatMoney(e.amount, e.currency) : ""
          }`,
          href: `/groups/${e.groupId}`,
          amount: e.amount,
          currency: e.currency,
        });
      });

      setResults(mapped);
      setSelected(0);
    } finally {
      setLoading(false);
    }
  }

  // Keyboard navigation
  const displayed = query.trim() ? results : quickActions;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, displayed.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter" && displayed[selected]) {
      handleSelect(displayed[selected]);
    }
  }

  function handleSelect(item: SearchResult) {
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
      close();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 bg-[#1E293B]
          border border-[#334155] rounded-xl px-4 py-2
          text-slate-500 text-sm hover:border-[#475569]
          transition-colors w-full max-w-sm"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search groups, expenses...</span>
        <div className="flex items-center gap-1 text-xs text-slate-600 bg-[#0F172A] px-1.5 py-0.5 rounded">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
        onClick={close}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="w-[calc(100%-2rem)] max-w-lg bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input row */}
          <div className="flex items-center gap-3 p-4 border-b border-[#1E293B]">
            <Search className="w-5 h-5 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search groups, expenses..."
              className="flex-1 bg-transparent text-slate-200 text-sm placeholder-slate-600 outline-none"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
            {query && !loading && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-600 hover:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!query.trim() && (
              <>
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Quick actions
                  </p>
                </div>
                {quickActions.map((item, i) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    active={selected === i}
                    onHover={() => setSelected(i)}
                    onClick={() => handleSelect(item)}
                  />
                ))}
              </>
            )}

            {query.trim() && results.length === 0 && !loading && (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  No results for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}

            {query.trim() && results.length > 0 && (
              <>
                {results.some((r) => r.type === "group") && (
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Groups
                    </p>
                  </div>
                )}
                {results
                  .filter((r) => r.type === "group")
                  .map((item, i) => (
                    <ResultRow
                      key={item.id}
                      item={item}
                      active={selected === i}
                      onHover={() => setSelected(i)}
                      onClick={() => handleSelect(item)}
                    />
                  ))}

                {results.some((r) => r.type === "expense") && (
                  <div className="px-4 pt-3 pb-2 border-t border-[#1E293B]">
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Expenses
                    </p>
                  </div>
                )}
                {results
                  .filter((r) => r.type === "expense")
                  .map((item, i) => {
                    const idx =
                      results.filter((r) => r.type === "group").length + i;
                    return (
                      <ResultRow
                        key={item.id}
                        item={item}
                        active={selected === idx}
                        onHover={() => setSelected(idx)}
                        onClick={() => handleSelect(item)}
                      />
                    );
                  })}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="hidden md:flex items-center justify-end gap-4 px-4 py-2 border-t border-[#1E293B] text-xs text-slate-600">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ResultRow({
  item,
  active,
  onHover,
  onClick,
}: {
  item: SearchResult;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const icons = {
    group: <Users className="w-4 h-4 text-[#10B981]" />,
    expense: <Receipt className="w-4 h-4 text-blue-400" />,
    action: <PlusCircle className="w-4 h-4 text-violet-400" />,
  };

  return (
    <div
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        active ? "bg-[#1E293B]" : "hover:bg-[#1E293B]/50"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-[#1E293B] border border-[#334155] flex items-center justify-center shrink-0">
        {icons[item.type]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {item.title}
        </p>

        {item.subtitle && (
          <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
        )}
      </div>

      {item.amount != null && (
        <span className="text-sm font-medium text-slate-300 shrink-0">
          {formatMoney(item.amount, item.currency)}
        </span>
      )}

      {active && <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
    </div>
  );
}
