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
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#0d1117' }}>
        <div className="text-center">
          <p className="text-gray-400 mb-1">
            Session {sessionStatus === 'failed' ? 'failed' : 'ended'}.
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Resume picks up Claude's conversation history if available,
            otherwise starts fresh with project context.
          </p>
          <div className="flex items-center gap-3 justify-center">
            {onResumeSession && (
              <button
                onClick={onResumeSession}
                disabled={isResuming}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {isResuming ? 'Resuming...' : 'Resume Session'}
              </button>
            )}
            {onNewSession && (
              <button
                onClick={onNewSession}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
              >
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
