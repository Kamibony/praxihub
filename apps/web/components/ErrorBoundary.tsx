"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="card-glass border border-red-500/20 bg-red-500/10 p-8 rounded-3xl max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                <AlertCircle size={32} />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-red-500 mb-2">
                Něco se pokazilo
              </h2>
              <p className="text-sm text-slate-400">
                {this.state.error?.message || "Došlo k neočekávané chybě při načítání této části aplikace."}
              </p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white rounded-xl font-medium transition-colors border border-white/5"
            >
              <RefreshCw size={18} />
              Zkusit znovu
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
