import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  handleCopy = () => {
    const errorText = `Error: ${this.state.error?.message || 'Unknown Error'}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const requestId = (this.state.error as any)?.requestId;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" id="error-boundary-fallback">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 mb-4">
              DentalCore encountered an unexpected issue while displaying this page. Your data is safe.
            </p>

            {requestId && (
              <div className="bg-slate-100 rounded-lg p-2.5 mb-4 text-xs font-mono text-slate-700 flex items-center justify-between border border-slate-200" id="error-request-id-container">
                <span>Error ID: <span className="font-semibold text-slate-900" id="error-request-id">{requestId}</span></span>
                <button
                  type="button"
                  onClick={this.handleCopy}
                  className="text-slate-500 hover:text-slate-700 p-1 rounded transition-colors"
                  title="Copy Error ID"
                  id="copy-error-id-btn"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                id="reload-page-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
