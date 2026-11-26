import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Catches render errors in child components and shows a readable error
 * instead of a full blank page. Reset happens on navigation or manual retry.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-5">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Page Error</h2>
          <p className="text-sm text-slate-500 mb-4 max-w-md">
            This page crashed. Error:
          </p>
          <pre className="text-xs bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 max-w-lg text-left overflow-auto mb-6">
            {msg}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-primary gap-2"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
