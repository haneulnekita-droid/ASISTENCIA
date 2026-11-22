import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Error inesperado en la aplicación.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white rounded-3xl border-2 border-[#DECFFA] p-6 text-center space-y-4 shadow-md">
            <h1 className="text-xl font-bold text-[#241B35]">
              Ocurrió un problema al cargar la vista
            </h1>
            <p className="text-sm text-[#5A4E73]">
              Recarga la pantalla para reconectar con la base de datos en la nube.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-5 py-2.5 rounded-xl bg-[#5B3FD9] text-white text-sm font-semibold cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
