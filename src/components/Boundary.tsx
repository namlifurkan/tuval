import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { t } from '../i18n'

interface State { error: Error | null }

// A component throwing used to unmount the whole tree and leave a blank page: no board, no
// message, nothing to act on. The work itself is never what breaks, so the first thing this
// says is that the board is still there.
export class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[tuval]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      // Fixed rather than in flow: inside the board this sits under an absolutely positioned
      // canvas, which paints over anything that is not positioned itself.
      <div className="fixed inset-0 z-[100] grid place-items-center overflow-auto bg-[#F2EFE9] px-5 py-12">
        <div className="w-full max-w-[440px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8452D]">
            {t('Something broke')}
          </span>
          <h1 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.015em] text-[#141310]">
            {t('This part of the page stopped working.')}
          </h1>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[#4A463E]">
            {t('Your board is not affected. It is kept in this browser and, when you are signed in, on the server as well.')}
          </p>

          <pre className="mt-5 max-h-40 overflow-auto rounded-lg border border-[#E2DED5] bg-[#FCFBF8] p-3 font-mono text-[11px] leading-relaxed text-[#4A463E]">
            {error.message || String(error)}
          </pre>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => location.reload()}
              className="rounded-lg bg-[#C8452D] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
            >
              {t('Reload')}
            </button>
            <button
              type="button"
              onClick={() => { location.href = '/dashboard' }}
              className="rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm font-semibold text-[#141310] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
            >
              {t('Your boards')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
