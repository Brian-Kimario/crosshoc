"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/5 p-10 text-center gap-4">
          <AlertTriangle className="size-10 text-rose-400" />
          <div>
            <p className="text-white font-semibold text-lg">Something went wrong</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">
              {this.state.message || "An unexpected error occurred. Please try refreshing."}
            </p>
          </div>
          <Button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.reload();
            }}
            className="rounded-2xl bg-emerald-500 hover:bg-emerald-600"
          >
            Reload page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
