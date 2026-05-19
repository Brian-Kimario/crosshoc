"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Car,
  Building2,
  Gamepad2,
  ShoppingCart,
  HeartPulse,
  Package,
  Check,
  ChevronLeft,
  ChevronRight,
  Camera,
  Paperclip,
  X,
  Receipt,
  Shield,
  Eye,
  Loader2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";
import useSWR from "swr";
import { keys } from "@/lib/swr-keys";
import { globalFetcher } from "@/lib/swr-config";

type SplitType = "equal" | "percentage" | "exact";

interface Member {
  id: string;
  name: string;
}

interface Split {
  userId: string;
  userName: string;
  value: number; // percentage or exact amount
  amount: number; // calculated amount in currency
  checked: boolean;
}

interface AddExpenseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: Member[];
  currency?: SupportedCurrency | string;
  currentUserId?: string;
  onSuccess?: () => void;
}

const categories = [
  { value: "food", label: "Food & Drink", icon: UtensilsCrossed },
  { value: "transport", label: "Transport", icon: Car },
  { value: "accommodation", label: "Accommodation", icon: Building2 },
  { value: "entertainment", label: "Entertainment", icon: Gamepad2 },
  { value: "groceries", label: "Groceries", icon: ShoppingCart },
  { value: "health", label: "Health", icon: HeartPulse },
  { value: "other", label: "Other", icon: Package },
];

const paymentMethods = [
  { value: "cash", label: "Cash", emoji: "💵" },
  { value: "digital", label: "M-Pesa", emoji: "📱" },
  { value: "paypal", label: "PayPal", emoji: "💳" },
  { value: "bank", label: "Bank", emoji: "🏦" },
];

export function AddExpenseWizard({
  open,
  onOpenChange,
  groupId,
  members,
  currency = "USD",
  currentUserId: propUserId,
  onSuccess,
}: AddExpenseWizardProps) {
  // Fetch current user information (fallback if not provided as prop)
  const { data: userData } = useSWR(keys.profile(), globalFetcher);
  const { data: profileData } = useSWR(keys.profile());
  const currentUserId = propUserId || userData?.user?.id;

  const [step, setStep] = useState(1);
  const [prevStep, setPrevStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Details
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fieldErrors, setFieldErrors] = useState<{ description?: string; amount?: string }>({});

  // Step 2: Split
  // Priority: group currency (prop) > user preference > "USD"
  const [activeCurrency, setActiveCurrency] = useState<string>(
    currency ?? profileData?.user?.preferences?.currency ?? "USD"
  );
  const [splitType, setSplitType] = useState<SplitType>(
    (profileData?.user?.preferences?.splitMethod as SplitType) ?? "equal"
  );

  // Sync currency and splitType when profileData loads (SWR may resolve after initial render)
  useEffect(() => {
    if (!currency && profileData?.user?.preferences?.currency) {
      setActiveCurrency(profileData.user.preferences.currency);
    }
    if (profileData?.user?.preferences?.splitMethod) {
      setSplitType(profileData.user.preferences.splitMethod as SplitType);
    }
  }, [profileData, currency]);
  const [splits, setSplits] = useState<Split[]>([]);
  const hasInitializedSplits = useRef(false);

  // Create stable member key for useEffect dependency
  const memberKey = members.map(m => m.id).join(',');

  // Reset splits initialization when group changes (for search bar group switching)
  useEffect(() => {
    hasInitializedSplits.current = false;
    setSplits([]);
  }, [groupId]);

  // Initialize splits only once when dialog opens with members
  useEffect(() => {
    if (open && members.length > 0 && !hasInitializedSplits.current) {
      hasInitializedSplits.current = true;
      setSplits(
        members.map((m) => ({
          userId: m.id,
          userName: m.name,
          value: 0,
          amount: 0,
          // Default to checked: current user if available, otherwise all members
          checked: currentUserId ? m.id === currentUserId : true,
        }))
      );
    }
  }, [open, memberKey, currentUserId]);

  // Step 3: Proof
  const [receiptUrl, setReceiptUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset form when closing
        setStep(1);
        setDescription("");
        setAmount("");
        setCategory("food");
        setDate(new Date().toISOString().split("T")[0]);
        setFieldErrors({});
        setSplitType("equal");
        setReceiptUrl("");
        setIsUploading(false);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );


  // Calculate split amounts
  const calculatedSplits = useMemo(() => {
    const totalAmount = parseFloat(amount) || 0;
    const checkedSplits = splits.filter((s) => s.checked);
    const checkedCount = checkedSplits.length;

    if (checkedCount === 0) return splits;

    return splits.map((split) => {
      if (!split.checked) {
        return { ...split, amount: 0 };
      }

      let calculatedAmount = 0;

      if (splitType === "equal") {
        calculatedAmount = totalAmount / checkedCount;
      } else if (splitType === "percentage") {
        calculatedAmount = (totalAmount * split.value) / 100;
      } else {
        // exact
        calculatedAmount = split.value;
      }

      return {
        ...split,
        amount: Math.round(calculatedAmount * 100) / 100,
      };
    });
  }, [splits, amount, splitType]);

  // Validation helpers
  const validateStep1 = () => {
    const errors: { description?: string; amount?: string } = {};
    if (!description.trim()) {
      errors.description = "Please enter a description";
    }
    if (!amount || parseFloat(amount) <= 0) {
      errors.amount = "Please enter a valid amount";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const totalAmount = parseFloat(amount) || 0;
    const checkedSplits = calculatedSplits.filter((s) => s.checked);
    
    // Ensure at least one participant is selected
    if (checkedSplits.length === 0) {
      toast.error("Please select at least one participant");
      return false;
    }

    const totalSplit = calculatedSplits.reduce((sum, s) => sum + s.amount, 0);

    if (splitType === "percentage") {
      const totalPercent = splits
        .filter((s) => s.checked)
        .reduce((sum, s) => sum + s.value, 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        toast.error(`Percentages must sum to 100% (currently ${totalPercent.toFixed(1)}%)`);
        return false;
      }
    } else if (splitType === "exact") {
      if (Math.abs(totalSplit - totalAmount) > 0.01) {
        toast.error(
          `Split amounts must equal total ($${totalAmount.toFixed(2)}, currently $${totalSplit.toFixed(2)})`
        );
        return false;
      }
    }

    return true;
  };

  // Navigation
  const goToStep = (newStep: number) => {
    setPrevStep(step);
    setStep(newStep);
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      goToStep(2);
    } else if (step === 2 && validateStep2()) {
      goToStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setPrevStep(step);
      setStep(step - 1);
    }
  };

  // Submit
  const handleSubmit = async (skipReceipt = false) => {
    if (!skipReceipt && !receiptUrl) {
      toast.error("Please upload a receipt or click 'Skip & Add'");
      return;
    }

    setIsSubmitting(true);

    try {
      const finalSplits = calculatedSplits
        .filter((s) => s.checked)
        .map((s) => ({
          user: s.userId,
          amount: Math.round(s.amount * 100), // Store in cents
        }));

      if (!currentUserId) {
        toast.error("User not authenticated");
        return;
      }

      // Build customSplits for ALL members (API expects this format)
      // Send display amounts — API converts to cents for exact splits
      const customSplits = calculatedSplits.map((s) => ({
        user: s.userId,
        value: s.amount, // display amount (e.g. 33.33), API handles cents conversion
      }));

      const body: any = {
        groupId,
        description: description.trim(),
        amount: parseFloat(amount), // Send display amount — API converts to cents via toCents()
        category,
        paidBy: currentUserId,
        splitType,
        customSplits, // API expects customSplits for all members
        date,
      };

      if (receiptUrl) {
        body.receiptUrl = receiptUrl;
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add expense");
      }

      const data = await res.json();

      toast.success(
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>
            <strong>{description}</strong> added — {formatCurrency(parseFloat(amount), currency)} split{" "}
            {finalSplits.length} ways
          </span>
        </div>
      );

      handleOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to add expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for split input changes
  const updateSplitValue = (userId: string, value: number) => {
    setSplits((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, value: Math.max(0, value) } : s))
    );
  };

  const toggleSplitChecked = (userId: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, checked: !s.checked } : s))
    );
  };

  // Progress indicator
  const steps = [
    { num: 1, label: "Details" },
    { num: 2, label: "Split" },
    { num: 3, label: "Proof" },
  ];

  const getStepStatus = (stepNum: number) => {
    if (stepNum < step) return "complete";
    if (stepNum === step) return "current";
    return "future";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0F172A] border-[#1E293B] text-slate-100 max-w-lg p-0 overflow-hidden max-h-[95vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="text-xl font-semibold text-white">Add Expense</DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="px-6 py-4 shrink-0">
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    getStepStatus(s.num) === "complete"
                      ? "bg-[#10B981] text-white"
                      : getStepStatus(s.num) === "current"
                      ? "bg-[#10B981]/20 text-[#10B981] border-2 border-[#10B981]"
                      : "bg-[#1E293B] text-slate-500"
                  }`}
                >
                  {getStepStatus(s.num) === "complete" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    s.num
                  )}
                </div>
                <span
                  className={`ml-2 text-xs ${
                    getStepStatus(s.num) === "current" ? "text-[#10B981]" : "text-slate-500"
                  }`}
                >
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div className="w-8 h-px bg-[#334155] mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content - scrollable on mobile */}
        <div className="flex-1 overflow-y-auto px-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: step > prevStep ? 40 : -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: step > prevStep ? -40 : 40 }}
              transition={{ duration: 0.22 }}
              className="pb-4"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">What was this expense?</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (fieldErrors.description) setFieldErrors((p) => ({ ...p, description: undefined }));
                      }}
                      placeholder="Dinner at SeaSalt Cafe"
                      className={`bg-[#1E293B] border-[#334155] text-slate-100 h-12 ${
                        fieldErrors.description ? "border-rose-500" : ""
                      }`}
                      autoFocus
                      autoCapitalize="sentences"
                    />
                    {fieldErrors.description && (
                      <p className="text-xs text-rose-400">{fieldErrors.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <Input
                          id="amount"
                          type="text"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            if (fieldErrors.amount) setFieldErrors((p) => ({ ...p, amount: undefined }));
                          }}
                          placeholder="0.00"
                          className={`bg-[#1E293B] border-[#334155] text-slate-100 h-12 pl-8 ${
                            fieldErrors.amount ? "border-rose-500" : ""
                          }`}
                        />
                      </div>
                      {fieldErrors.amount && (
                        <p className="text-xs text-rose-400">{fieldErrors.amount}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <div className="h-12 px-3 flex items-center bg-[#1E293B] border border-[#334155] rounded-md text-slate-300 text-sm">
                        {currency}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full h-12 rounded-md border border-[#334155] bg-[#1E293B] px-3 text-sm text-slate-100 focus:outline-none focus:border-[#10B981]"
                      >
                        {categories.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-[#1E293B] border-[#334155] text-slate-100 h-12"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {/* Paid by - always the current user */}
                  <div className="space-y-2">
                    <Label>Paid by</Label>
                    <div className="w-full h-12 rounded-md border border-[#334155] bg-[#1E293B] px-3 flex items-center text-sm text-slate-100">
                      You
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="space-y-2">
                    <Label>Split between</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {splits.map((split) => (
                        <label
                          key={split.userId}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1E293B] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={split.checked}
                            onChange={() => toggleSplitChecked(split.userId)}
                            className="w-4 h-4 rounded border-[#334155] bg-[#1E293B] text-[#10B981] focus:ring-[#10B981]/20"
                          />
                          <div className="flex-1 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-xs font-medium text-slate-300">
                              {split.userName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-slate-200">{split.userName}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Split method */}
                  <div className="space-y-2">
                    <Label>Split method</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["equal", "percentage", "exact"] as SplitType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSplitType(type)}
                          className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            splitType === type
                              ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]"
                              : "bg-[#1E293B] text-slate-400 border border-[#334155] hover:border-[#475569]"
                          }`}
                        >
                          {type === "equal" ? "Equal" : type === "percentage" ? "Percent" : "Exact"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live split preview */}
                  <div className="bg-[#1E293B] rounded-xl p-4 space-y-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Live split preview</p>

                    {splitType === "percentage" && (
                      <div className="space-y-2">
                        {calculatedSplits
                          .filter((s) => s.checked)
                          .map((split) => (
                            <div key={split.userId} className="flex items-center gap-3">
                              <span className="flex-1 text-sm text-slate-300">{split.userName}</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={splits.find((s) => s.userId === split.userId)?.value || 0}
                                  onChange={(e) => updateSplitValue(split.userId, parseFloat(e.target.value) || 0)}
                                  className="w-16 h-8 px-2 text-sm bg-[#0F172A] border border-[#334155] rounded text-slate-100 text-center"
                                />
                                <span className="text-slate-500 w-4">%</span>
                                <span className="w-16 text-right text-sm text-slate-400">
                                  ${split.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        <div className="pt-2 border-t border-[#334155] flex items-center justify-between">
                          <span className="text-sm text-slate-400">Sum</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                Math.abs(
                                  splits.filter((s) => s.checked).reduce((sum, s) => sum + s.value, 0) - 100
                                ) > 0.01
                                  ? "text-rose-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {splits.filter((s) => s.checked).reduce((sum, s) => sum + s.value, 0).toFixed(0)}%
                            </span>
                            <span className="w-20 text-right text-sm text-slate-300">
                              ${(parseFloat(amount) || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {splitType === "exact" && (
                      <div className="space-y-2">
                        {calculatedSplits
                          .filter((s) => s.checked)
                          .map((split) => (
                            <div key={split.userId} className="flex items-center gap-3">
                              <span className="flex-1 text-sm text-slate-300">{split.userName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={splits.find((s) => s.userId === split.userId)?.value || 0}
                                  onChange={(e) => updateSplitValue(split.userId, parseFloat(e.target.value) || 0)}
                                  className="w-20 h-8 px-2 text-sm bg-[#0F172A] border border-[#334155] rounded text-slate-100"
                                />
                              </div>
                            </div>
                          ))}
                        <div className="pt-2 border-t border-[#334155] flex items-center justify-between">
                          <span className="text-sm text-slate-400">Total</span>
                          <span
                            className={`text-sm font-medium ${
                              Math.abs(
                                calculatedSplits.reduce((sum, s) => sum + s.amount, 0) - (parseFloat(amount) || 0)
                              ) > 0.01
                                ? "text-rose-400"
                                : "text-emerald-400"
                            }`}
                          >
                            ${calculatedSplits.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
                            {Math.abs(
                              calculatedSplits.reduce((sum, s) => sum + s.amount, 0) - (parseFloat(amount) || 0)
                            ) > 0.01 && " ✗"}
                          </span>
                        </div>
                      </div>
                    )}

                    {splitType === "equal" && (
                      <div className="space-y-2">
                        {calculatedSplits
                          .filter((s) => s.checked)
                          .map((split) => (
                            <div key={split.userId} className="flex items-center justify-between">
                              <span className="text-sm text-slate-300">{split.userName}</span>
                              <span className="text-sm text-slate-400">${split.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        <div className="pt-2 border-t border-[#334155] flex items-center justify-between">
                          <span className="text-sm text-slate-400">Total</span>
                          <span className="text-sm font-medium text-emerald-400">
                            ${calculatedSplits.reduce((sum, s) => sum + s.amount, 0).toFixed(2)} ✓
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Attach a receipt (optional but recommended)</Label>

                    {receiptUrl ? (
                      <div className="relative">
                        <div className="rounded-xl border border-[#334155] overflow-hidden bg-[#1E293B]">
                          <img
                            src={receiptUrl}
                            alt="Receipt"
                            className="w-full h-48 object-contain bg-[#0F172A]"
                          />
                          <button
                            type="button"
                            onClick={() => setReceiptUrl("")}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#0F172A]/80 hover:bg-rose-500/20 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/jpeg,image/png,image/jpg,application/pdf"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            // Validate file size (10MB)
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error("File size exceeds 10MB limit");
                              return;
                            }

                            setIsUploading(true);
                            const formData = new FormData();
                            formData.append("file", file);

                            try {
                              const response = await fetch("/api/upload/receipt", {
                                method: "POST",
                                body: formData,
                              });

                              const result = await response.json();

                              if (!response.ok || !result.success) {
                                throw new Error(result.error || "Upload failed");
                              }

                              setReceiptUrl(result.data.url);
                              toast.success("Receipt uploaded!");
                            } catch (err: any) {
                              console.error("Upload error:", err);
                              toast.error(err.message || "Failed to upload receipt");
                            } finally {
                              setIsUploading(false);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="w-full h-32 rounded-xl border-2 border-dashed border-[#334155] bg-[#1E293B]/50 hover:border-[#10B981]/50 hover:bg-[#1E293B] transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-[#10B981] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span className="text-sm">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-6 h-6" />
                              <span className="text-sm">Click to upload receipt</span>
                              <span className="text-xs text-slate-500">
                                Supports: JPG, PNG, PDF (max 10MB)
                              </span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Why add receipt */}
                  <div className="bg-[#1E293B]/50 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-medium text-slate-300">Why add a receipt?</p>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2 text-xs text-slate-400">
                        <Shield className="w-3 h-3 text-[#10B981]" />
                        Proof if anyone disputes the amount
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-400">
                        <Shield className="w-3 h-3 text-[#10B981]" />
                        Stored securely with the expense forever
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-400">
                        <Eye className="w-3 h-3 text-[#10B981]" />
                        Visible to all group members
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sticky action footer - always visible at bottom on mobile */}
        <div className="px-6 py-4 border-t border-[#1E293B] bg-[#0F172A] shrink-0">
          {step === 1 && (
            <Button
              onClick={handleNext}
              className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl"
            >
              Next: Who splits this?
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 2 && (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-12 border-[#334155] bg-transparent text-slate-300 hover:bg-[#1E293B] rounded-xl"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 h-12 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl"
              >
                Next: Add proof
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="h-12 border-[#334155] bg-transparent text-slate-300 hover:bg-[#1E293B] rounded-xl"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="flex-1 h-12 border-[#334155] bg-transparent text-slate-300 hover:bg-[#1E293B] rounded-xl"
              >
                Skip & Add
              </Button>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || !receiptUrl}
                className="flex-1 h-12 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Paperclip className="w-4 h-4 mr-2" />
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddExpenseWizard;
