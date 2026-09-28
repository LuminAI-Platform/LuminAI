import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";
import { Button } from "../ui";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-zinc-950 border border-red-500/20 rounded-xl m-6">
          <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 shadow-lg shadow-red-500/10">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight mb-2">
            Something went wrong
          </h2>
          <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
            An unexpected error occurred while rendering this view. Your session and
            data are safe.
          </p>
          {this.state.error && (
            <pre className="text-[11px] font-mono text-red-300 bg-red-950/20 border border-red-900/40 p-3 rounded-lg max-w-xl overflow-x-auto text-left mb-6">
              {this.state.error.message}
            </pre>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={this.handleReset}
          >
            Reload Interface
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
