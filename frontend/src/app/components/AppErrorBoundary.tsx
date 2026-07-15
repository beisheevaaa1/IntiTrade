import React from "react";
import { reportClientError } from "../../lib/telemetry";
import { Button } from "./ui/button";

type State = { failed: boolean };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportClientError({ type: "frontend_error", message: error.message });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm" role="alert">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-sm text-muted-foreground">The error was recorded without your password, messages, or contact details. Reload the page to continue.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}>Go home</Button>
          </div>
        </section>
      </main>
    );
  }
}
