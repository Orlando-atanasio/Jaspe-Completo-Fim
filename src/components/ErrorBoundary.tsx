import { Component, ReactNode } from 'react';

interface Props { tab: string; children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[JASPE] crash na aba ${this.props.tab}:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 m-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-left space-y-2">
          <h4 className="text-sm font-bold text-red-400">Esta aba falhou, mas o app continua aberto.</h4>
          <p className="text-[11px] text-zinc-300">
            Aba: <strong>{this.props.tab}</strong> — {this.state.error.message}
          </p>
          <p className="text-[10px] text-zinc-500">
            Geralmente é um erro inesperado no backup/localStorage. Restaure um backup válido ou limpe a coleção dessa aba.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
