import { Component} from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
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
    // Оновлюємо стан, щоб наступний рендер показав запасний UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 z-50 relative">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Oops! Critical Error.</h1>
          <div className="bg-slate-800 p-6 rounded-xl border border-red-500/50 max-w-2xl w-full shadow-2xl">
             <p className="mb-2 text-gray-300">The game client crashed due to a rendering error:</p>
             
             {/* Відображаємо текст помилки прямо на екрані */}
             <pre className="bg-black p-4 rounded text-red-400 text-sm overflow-auto font-mono mb-4 max-h-60 border border-slate-700">
                {this.state.error?.toString()}
             </pre>
             
             <button 
               onClick={() => window.location.reload()} 
               className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold w-full transition shadow-lg"
             >
               Reload Game
             </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}