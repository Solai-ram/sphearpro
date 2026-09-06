import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SPHEAR render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg w-full rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">{this.state.error.message}</p>
          <button
            className="btn-primary mt-4"
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign('/login');
            }}
          >
            Reload login
          </button>
        </div>
      </div>
    );
  }
}
