/*
 * Vendored from React Bits — https://reactbits.dev · https://github.com/DavidHDev/react-bits
 * Component: PromptBar (TS + Tailwind variant), fetched 2026-10-10 from the @react-bits registry.
 * Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0 — see ./LICENSE.md.
 * Used as part of this application only; these components are not redistributed on their own.
 * Local changes: removed the @-source, /-command, model and effort menus, attachments and the
 * spark canvas; single-row layout; added a controlled draft (`value`/`onValueChange`), a
 * `trailing` slot (microphone), `maxLength`, `disabled`, `inputRef`, `id` and `ariaLabel`.
 * Kept: autosizing textarea, Enter-to-send, the arrow→stop morph while busy, press feedback.
 */
'use client';

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref
} from 'react';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';

export interface PromptBarProps {
  placeholder?: string;
  busy?: boolean;
  disabled?: boolean;
  onSend?: (text: string) => void;
  onStop?: () => void;
  value?: string;
  onValueChange?: (value: string) => void;
  trailing?: ReactNode;
  maxLength?: number;
  background?: string;
  color?: string;
  width?: number;
  radius?: number;
  maxRows?: number;
  lineHeight?: number;
  morphDuration?: number;
  squash?: number;
  tilt?: number;
  pressScale?: number;
  inputRef?: Ref<HTMLTextAreaElement>;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

interface SendGlyphProps {
  busy: boolean;
  morphDuration: number;
  squash: number;
  tilt: number;
}

const ARROW_UP = [12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11];
const SQUARE = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pathAt = (a: number[], b: number[], t: number) => {
  let d = '';
  for (let i = 0; i < a.length; i += 2) {
    d += `${i ? 'L' : 'M'}${mix(a[i], b[i], t).toFixed(2)} ${mix(a[i + 1], b[i + 1], t).toFixed(2)}`;
  }
  return `${d}Z`;
};

function SendGlyph({ busy, morphDuration, squash, tilt }: SendGlyphProps) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dir = useRef(busy ? 1 : -1);
  const t = useMotionValue(busy ? 1 : 0);

  useEffect(() => {
    const target = busy ? 1 : 0;
    dir.current = busy ? 1 : -1;
    if (t.get() === target) return undefined;
    const controls = animate(
      t,
      target,
      reduce ? { duration: 0 } : { duration: morphDuration / 1000, ease: EASE_IN_OUT }
    );
    return () => controls.stop();
  }, [busy, morphDuration, reduce, t]);

  useMotionValueEvent(t, 'change', v => {
    pathRef.current?.setAttribute('d', pathAt(ARROW_UP, SQUARE, v));
    const goo = reduce ? 0 : Math.sin(v * Math.PI);
    const sx = 1 - squash * goo;
    if (svgRef.current) {
      svgRef.current.style.transform = goo ? `rotate(${dir.current * tilt * goo}deg) scale(${sx}, ${1 / sx})` : '';
    }
  });

  return (
    <svg
      ref={svgRef}
      className="block h-4 w-4 origin-center"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path ref={pathRef} d={pathAt(ARROW_UP, SQUARE, t.get())} />
    </svg>
  );
}

const PromptBar: React.FC<PromptBarProps> = ({
  placeholder = 'Ask anything',
  busy = false,
  disabled = false,
  onSend,
  onStop,
  value,
  onValueChange,
  trailing,
  maxLength,
  background = '#27272a',
  color = '#f5f5f5',
  width = 640,
  radius = 20,
  maxRows = 6,
  lineHeight = 24,
  morphDuration = 240,
  squash = 0.12,
  tilt = 8,
  pressScale = 0.96,
  inputRef: externalRef,
  id,
  ariaLabel = 'Prompt',
  className = ''
}) => {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ onSend, onStop, onValueChange });
  latest.current = { onSend, onStop, onValueChange };

  const [inner, setInner] = useState('');
  const draft = value ?? inner;
  const setDraft = (next: string) => {
    if (value === undefined) setInner(next);
    latest.current.onValueChange?.(next);
  };
  const [pressed, setPressed] = useState(false);

  const canSend = draft.trim().length > 0 && !disabled;
  const armed = busy || canSend;

  const assignRef = (el: HTMLTextAreaElement | null) => {
    ownRef.current = el;
    if (typeof externalRef === 'function') externalRef(el);
    else if (externalRef) (externalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };
  const focusInput = () => ownRef.current?.focus({ preventScroll: true });

  useLayoutEffect(() => {
    const el = ownRef.current;
    if (!el) return;
    el.style.height = '0px';
    const max = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [draft, maxRows, lineHeight]);

  const send = () => {
    if (!canSend || busy) return;
    latest.current.onSend?.(draft.trim());
    setDraft('');
    focusInput();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !armed) return;
    setPressed(true);
  };
  const up = () => setPressed(false);

  return (
    <div
      className={`group relative [width:min(var(--pb-w),100%)] [color:var(--pb-ink)]${className ? ` ${className}` : ''}`}
      data-busy={busy ? '' : undefined}
      style={
        {
          '--pb-bg': background,
          '--pb-ink': color,
          '--pb-w': `${width}px`,
          '--pb-radius': `${radius}px`,
          '--pb-press': pressScale,
          '--pb-line': `${lineHeight}px`
        } as CSSProperties
      }
    >
      <div
        className="relative isolate flex cursor-text items-end gap-2 py-3 pr-3 pl-5 [background:var(--pb-bg)] [border-radius:var(--pb-radius)]"
        role="presentation"
        onClick={focusInput}
      >
        <textarea
          ref={assignRef}
          id={id}
          className="block min-h-[var(--pb-line)] flex-auto resize-none self-center border-0 bg-transparent p-0 text-[16px] leading-[var(--pb-line)] text-inherit outline-none [font:inherit] [overflow-wrap:anywhere] placeholder:[color:color-mix(in_srgb,var(--pb-ink)_45%,transparent)] disabled:cursor-not-allowed"
          rows={1}
          value={draft}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {trailing}
        <button
          type="button"
          className="relative inline-grid h-9 w-9 flex-none cursor-pointer touch-manipulation place-items-center rounded-full border-0 p-0 outline-none select-none [background:color-mix(in_srgb,var(--pb-ink)_12%,var(--pb-bg))] [color:color-mix(in_srgb,var(--pb-ink)_55%,var(--pb-bg))] [font:inherit] [-webkit-tap-highlight-color:transparent] [transition:background-color_200ms_ease,color_200ms_ease,transform_160ms_cubic-bezier(0.23,1,0.32,1)] disabled:cursor-default data-[armed]:[background:var(--pb-ink)] data-[armed]:[color:var(--pb-bg)] data-[pressed]:[transform:scale(var(--pb-press))] motion-reduce:data-[pressed]:[transform:none]"
          disabled={!armed}
          aria-label={busy ? 'Stop' : 'Send'}
          data-armed={armed ? '' : undefined}
          data-pressed={pressed ? '' : undefined}
          onMouseDown={e => e.preventDefault()}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          onClick={e => {
            e.stopPropagation();
            if (busy) latest.current.onStop?.();
            else send();
          }}
        >
          <SendGlyph busy={busy} morphDuration={morphDuration} squash={squash} tilt={tilt} />
        </button>
      </div>
    </div>
  );
};

export default PromptBar;
