import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";
import { Button } from "../ui";

interface Props {
  children: ReactNode;
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
    console.error(
      "Uncaught runtime error caught by ErrorBoundary:",
      error,
      errorInfo,
    );
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-surface border border-error-border rounded-lg m-6">
          <div className="w-14 h-14 rounded-lg bg-error-bg border border-error-border flex items-center justify-center text-error mb-5">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-text tracking-tight mb-2">
            Something went wrong
          </h2>
          <p className="text-xs text-text-secondary max-w-md mb-6 leading-relaxed">
            An unexpected error occurred while rendering this view. Your session
            and data are safe.
          </p>
          {this.state.error && (
            <pre className="text-[11px] font-mono text-error bg-error-bg border border-error-border p-3 rounded-lg max-w-xl overflow-x-auto text-left mb-6">
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
