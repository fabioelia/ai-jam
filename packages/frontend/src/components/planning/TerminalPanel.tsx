import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getSocket, attachPty, detachPty, sendPtyInput, resizePty } from '../../api/socket.js';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  sessionId: string;
  sessionStatus?: string;
  onNewSession?: () => void;
  onResumeSession?: () => void;
  isResuming?: boolean;
}

export default function TerminalPanel({ sessionId, sessionStatus, onNewSession, onResumeSession, isResuming }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const isDead = sessionStatus === 'completed' || sessionStatus === 'failed';

  useEffect(() => {
    if (isDead || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d364',
        brightWhite: '#f0f6fc',
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Attach to the PTY session
    attachPty(sessionId);

    // Send initial terminal dimensions
    resizePty(sessionId, term.cols, term.rows);

    // Forward user input to the PTY
    const inputDisposable = term.onData((data) => {
      sendPtyInput(sessionId, data);
    });

    // Receive PTY output from the server
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      term.writeln('\r\n\x1b[31mFailed to connect to server\x1b[0m');
      return;
    }

    let receivedData = false;
    const onPtyData = (payload: { sessionId: string; data: string }) => {
      if (payload.sessionId === sessionId) {
        receivedData = true;
        term.write(payload.data);
      }
    };

    socket.on('pty:data', onPtyData);

    // If no data after 8 seconds, show a hint (session may be stale)
    const staleTimer = setTimeout(() => {
      if (!receivedData) {
        term.writeln('\r\n\x1b[33mWaiting for Claude CLI to start...\x1b[0m');
        term.writeln('\x1b[33mIf nothing appears, try creating a new session.\x1b[0m');
      }
    }, 8000);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      resizePty(sessionId, term.cols, term.rows);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(staleTimer);
      inputDisposable.dispose();
      socket.off('pty:data', onPtyData);
      detachPty(sessionId);
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, isDead]);

  if (isDead) {
    const isFailed = sessionStatus === 'failed';
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#0d1117' }}>
        <div className="text-center max-w-md px-6">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isFailed ? 'bg-red-500/20' : 'bg-gray-800'}`}>
            {isFailed ? (
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isFailed ? 'text-red-400' : 'text-gray-300'}`}>
            Session {sessionStatus}
          </h3>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Resume picks up where you left off with conversation history, otherwise starts fresh with project context.
          </p>
          <div className="flex items-center gap-3 justify-center flex-wrap">
            {onResumeSession && (
              <button
                onClick={onResumeSession}
                disabled={isResuming}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 active:scale-[0.98] flex items-center gap-2"
              >
                {isResuming ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resuming...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Resume Session
                  </>
                )}
              </button>
            )}
            {onNewSession && (
              <button
                onClick={onNewSession}
                className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-gray-500/20 active:scale-[0.98] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Session
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ backgroundColor: '#0d1117' }}
    />
  );
}
