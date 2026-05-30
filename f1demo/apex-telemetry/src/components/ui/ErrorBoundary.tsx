import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface errors to the dev console so issues surface during development.
    // In production this would feed into a logger of choice.
    // eslint-disable-next-line no-console
    console.error('Apex Telemetry crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 carbon-card rounded-lg p-8 max-w-2xl mx-auto">
        <h2 className="font-sans font-black text-base text-f1-red uppercase">Race Control offline</h2>
        <p className="font-mono text-xs text-on-surface-variant mt-3 leading-relaxed">
          A panel encountered an unexpected error. The rest of the app keeps running. Reload to retry.
        </p>
        <pre className="font-mono text-[10px] text-on-surface-variant mt-4 bg-black/40 rounded p-3 overflow-auto max-h-48">
          {this.state.error.stack || this.state.error.message}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 bg-f1-red text-white font-mono text-[10px] uppercase font-bold px-3 py-2 rounded"
        >
          Reset Panel
        </button>
      </div>
    );
  }
}
