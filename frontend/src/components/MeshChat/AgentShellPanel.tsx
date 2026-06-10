'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, Terminal } from 'lucide-react';

const STORAGE_KEY = 'sb_agent_shell_dims';
const SHELL_FONT_PX = 14;
const MIN_SHELL_WIDTH = 300;
const MIN_SHELL_HEIGHT = 220;
const STRETCH_WIDTH_RATIO = 2.15;
const STRETCH_MIN_WIDTH = 520;

type ShellSize = { w: number; h: number };

function readStoredSize(): ShellSize | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShellSize;
    if (
      typeof parsed?.w === 'number' &&
      typeof parsed?.h === 'number' &&
      parsed.w >= MIN_SHELL_WIDTH &&
      parsed.h >= MIN_SHELL_HEIGHT
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredSize(size: ShellSize) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch {
    /* ignore */
  }
}

function clampSize(size: ShellSize, anchorLeft: number): ShellSize {
  const maxW = Math.max(MIN_SHELL_WIDTH, window.innerWidth - anchorLeft - 12);
  const maxH = Math.max(MIN_SHELL_HEIGHT, window.innerHeight - 12);
  return {
    w: Math.min(Math.max(size.w, MIN_SHELL_WIDTH), maxW),
    h: Math.min(Math.max(size.h, MIN_SHELL_HEIGHT), maxH),
  };
}

function defaultStretchedSize(anchor: DOMRect): ShellSize {
  const stretchedW = Math.max(anchor.width * STRETCH_WIDTH_RATIO, STRETCH_MIN_WIDTH);
  return clampSize({ w: stretchedW, h: anchor.height }, anchor.left);
}

type Props = {
  anchorRef: React.RefObject<HTMLElement | null>;
  active: boolean;
};

export default function AgentShellPanel({ anchorRef, active }: Props) {
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [size, setSize] = useState<ShellSize>({ w: STRETCH_MIN_WIDTH, h: 360 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [userResized, setUserResized] = useState(Boolean(readStoredSize()));
  const resizeRef = useRef<{
    edge: 'e' | 's' | 'se';
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const measureAnchor = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchorRect(rect);
    setPos({ x: rect.left, y: rect.top });

    if (!userResized) {
      setSize(defaultStretchedSize(rect));
      return;
    }

    const stored = readStoredSize();
    if (stored) {
      setSize(clampSize(stored, rect.left));
    } else {
      setSize(defaultStretchedSize(rect));
    }
  }, [anchorRef, userResized]);

  useEffect(() => {
    if (!active) return;
    measureAnchor();

    const el = anchorRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => measureAnchor());
    observer.observe(el);

    const onWindowChange = () => measureAnchor();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [active, anchorRef, measureAnchor]);

  useEffect(() => {
    if (!active || userResized) return;
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const base = { w: rect.width, h: rect.height };
    setSize(base);
    setPos({ x: rect.left, y: rect.top });

    const frame = window.requestAnimationFrame(() => {
      setSize(defaultStretchedSize(rect));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, anchorRef, userResized]);

  const beginResize = (edge: 'e' | 's' | 'se') => (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      origW: size.w,
      origH: size.h,
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      const { edge: ed, origW, origH } = resizeRef.current;
      const anchorLeft = anchorRef.current?.getBoundingClientRect().left ?? pos.x;
      const next: ShellSize = {
        w: ed === 's' ? origW : origW + dx,
        h: ed === 'e' ? origH : origH + dy,
      };
      setUserResized(true);
      setSize(clampSize(next, anchorLeft));
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSize((current) => {
        writeStoredSize(current);
        return current;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const snapToStretchedDefault = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setUserResized(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPos({ x: rect.left, y: rect.top });
    setSize(defaultStretchedSize(rect));
  };

  if (!mounted || !active || !anchorRect) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-6 text-center border-l-2 border-cyan-800/20">
        <Terminal size={18} className="text-cyan-400 mb-2" />
        <div className="text-sm font-mono tracking-[0.2em] text-cyan-300">AGENT SHELL</div>
        <div className="mt-2 text-[13px] font-mono text-[var(--text-secondary)] leading-relaxed">
          Expand Mesh Chat to open the local agent shell.
        </div>
      </div>
    );
  }

  const shell = (
    <div
      className="pointer-events-auto z-[250] flex flex-col border border-cyan-800/50 bg-[#05080c]/96 shadow-[0_18px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(34,211,238,0.08)] backdrop-blur-sm"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        transition: userResized ? undefined : 'width 180ms ease-out',
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-cyan-900/40 px-3 py-2 shrink-0 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal size={13} className="text-cyan-400 shrink-0" />
          <span className="text-[13px] font-mono tracking-[0.18em] text-cyan-300">AGENT SHELL</span>
          <span className="hidden sm:inline text-[12px] font-mono text-slate-500 truncate">
            local CLI · user cwd
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={snapToStretchedDefault}
            className="px-2 py-1 text-[12px] font-mono tracking-[0.14em] text-cyan-300/80 border border-cyan-800/40 hover:bg-cyan-950/30 transition-colors"
            title="Reset size to default stretch from Mesh Chat panel"
          >
            SNAP
          </button>
          <GripHorizontal size={14} className="text-cyan-600/60" />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto styled-scrollbar px-3 py-2 font-mono text-cyan-100/90"
        style={{ fontSize: SHELL_FONT_PX, lineHeight: 1.55 }}
      >
        <div className="text-slate-400">ShadowBroker agent shell (PTY wiring next)</div>
        <div className="text-slate-500 mt-1">Working directory: set your own path in Settings.</div>
        <div className="mt-3 text-emerald-300/90">$ openclaw</div>
        <div className="text-slate-500">$ codex</div>
        <div className="text-slate-500">$ gemini</div>
        <div className="mt-3 text-cyan-300/80 animate-pulse">█</div>
      </div>

      <div className="border-t border-cyan-900/30 px-3 py-1.5 text-[12px] font-mono text-slate-500 shrink-0">
        Drag right/bottom edges to resize · {Math.round(size.w)}×{Math.round(size.h)}px · {SHELL_FONT_PX}px font
      </div>

      <div
        className="absolute top-2 bottom-2 right-0 w-1.5 cursor-e-resize"
        onMouseDown={beginResize('e')}
        aria-hidden
      />
      <div
        className="absolute left-2 right-2 bottom-0 h-1.5 cursor-s-resize"
        onMouseDown={beginResize('s')}
        aria-hidden
      />
      <div
        className="absolute right-0 bottom-0 h-3 w-3 cursor-se-resize"
        onMouseDown={beginResize('se')}
        aria-hidden
      />
    </div>
  );

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-3 py-4 text-center border-l-2 border-cyan-800/20">
        <div className="text-[12px] font-mono tracking-[0.16em] text-cyan-500/80">SHELL ACTIVE</div>
        <div className="mt-1 text-[13px] font-mono text-[var(--text-secondary)] leading-relaxed">
          Panel stretched from Mesh Chat. Drag edges on the shell to resize.
        </div>
      </div>
      {createPortal(shell, document.body)}
    </>
  );
}
