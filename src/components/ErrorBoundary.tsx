import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1e1e1e] text-white p-10 text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-500">Ups, niečo sa pokazilo</h1>
          <p className="text-[#858585] mb-6">Aplikácia narazila na neočakávanú chybu.</p>
          <div className="bg-[#252526] p-4 rounded border border-[#333] font-mono text-xs text-left max-w-2xl overflow-auto mb-6">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Reštartovať aplikáciu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
