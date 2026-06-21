import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

function generateErrorId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: generateErrorId() };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error });
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyDetails = async () => {
    const { error, errorId } = this.state;
    const details = [
      `Error ID: ${errorId}`,
      `Message: ${error?.message ?? "Unknown error"}`,
      `Stack: ${error?.stack ?? "No stack trace available"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(details);
    } catch (err) {
      console.error("[ErrorBoundary] Failed to copy error details", err);
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-root p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              Pragma encountered an unexpected error. We have logged the details so you can report
              the issue if it keeps happening.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-ui-sm text-fg-default">
              Error ID: <code className="font-mono text-fg-subtle">{this.state.errorId}</code>
            </p>
            <p className="text-ui-xs text-fg-muted">
              {this.state.error?.message ?? "No additional information is available."}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={this.handleCopyDetails}>
              Copy details
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              Reload Pragma
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
}
