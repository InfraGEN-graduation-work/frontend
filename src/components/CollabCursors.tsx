import React, { useEffect, useRef, useSyncExternalStore } from 'react';

export interface CursorPoint {
  x: number;
  y: number;
}

export interface RemoteCursor {
  cursorId: string;
  actorMemberId: number;
  x: number;
  y: number;
  lastSeen: number;
  since: number;
}

export type CursorPayload = { visible: true; x: number; y: number } | { visible: false };

export const CURSOR_MOVE_INTERVAL_MS = 80;
export const CURSOR_KEEPALIVE_MS = 3000;
export const CURSOR_EXPIRE_MS = 10000;
const CURSOR_SWEEP_MS = 1000;
const CURSOR_COORD_LIMIT = 9999999.999;

export type CursorRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface CursorAppearance {
  color: string;
  label?: string;
}

export const CURSOR_ROLE_COLORS: Record<CursorRole, string> = {
  OWNER: '#e5484d',
  EDITOR: '#8e4ec6',
  VIEWER: '#f76b15'
};
export const CURSOR_UNKNOWN_COLOR = '#8b8d98';
const LOCAL_CURSOR_COLOR = '#1a1a1a';

const TEXT_FIELD_SELECTOR = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"])',
  'textarea'
].join(', ');

const NATIVE_CURSOR_SELECTOR = `${TEXT_FIELD_SELECTOR}, .resizer`;

const LOCAL_CURSOR_CLASS = 'collab-local-cursor';

const svgCursor = (svg: string, hotX: number, hotY: number, fallback: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;

const TEXT_CURSOR = svgCursor(
  `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='24' viewBox='0 0 16 24'>`
  + `<path d='M5 3.5h6M8 3.5v17M5 20.5h6' fill='none' stroke='white' stroke-width='3.6' stroke-linecap='round'/>`
  + `<path d='M5 3.5h6M8 3.5v17M5 20.5h6' fill='none' stroke='${LOCAL_CURSOR_COLOR}' stroke-width='1.6' stroke-linecap='round'/>`
  + `</svg>`,
  8, 12, 'text'
);

const COL_RESIZE_CURSOR = svgCursor(
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>`
  + `<path d='M1.5 12 L6.5 7 L6.5 10.2 L17.5 10.2 L17.5 7 L22.5 12 L17.5 17 L17.5 13.8 L6.5 13.8 L6.5 17 Z' fill='${LOCAL_CURSOR_COLOR}' stroke='white' stroke-width='1.5' stroke-linejoin='round'/>`
  + `</svg>`,
  12, 12, 'col-resize'
);

const LOCAL_CURSOR_STYLE = `
  body.${LOCAL_CURSOR_CLASS}:not([style*="cursor"]),
  body.${LOCAL_CURSOR_CLASS}:not([style*="cursor"]) *:not(:is(${NATIVE_CURSOR_SELECTOR})) {
    cursor: none !important;
  }
  body.${LOCAL_CURSOR_CLASS} :is(${TEXT_FIELD_SELECTOR}) {
    cursor: ${TEXT_CURSOR} !important;
  }
  body.${LOCAL_CURSOR_CLASS} .resizer,
  body.${LOCAL_CURSOR_CLASS}[style*="col-resize"],
  body.${LOCAL_CURSOR_CLASS}[style*="col-resize"] :is(*, ${TEXT_FIELD_SELECTOR}) {
    cursor: ${COL_RESIZE_CURSOR} !important;
  }
`;

const usesNativeCursor = (e: PointerEvent) => {
  if (document.body.style.cursor) return true;
  const target = e.target;
  if (!(target instanceof Element)) return false;
  if (target.closest(NATIVE_CURSOR_SELECTOR)) return true;
  if (target instanceof HTMLElement) {
    const overVerticalScrollbar = target.scrollHeight > target.clientHeight && e.offsetX > target.clientWidth;
    const overHorizontalScrollbar = target.scrollWidth > target.clientWidth && e.offsetY > target.clientHeight;
    if (overVerticalScrollbar || overHorizontalScrollbar) return true;
  }
  return false;
};

const CursorArrow: React.FC<{ color: string }> = ({ color }) => (
  <svg width="16" height="18" viewBox="0 0 16 18" style={{ display: 'block', overflow: 'visible', margin: '-1.5px 0 0 -1.5px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
    <path d="M1.5 1.5 L1.5 15.5 L5.8 11.6 L13.5 11.6 Z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const isValidCoord = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= CURSOR_COORD_LIMIT;

const roundCoord = (value: number) => Math.round(value * 10) / 10;

export class CursorSender {
  private publish: (payload: CursorPayload) => boolean;
  private latest: CursorPoint | null = null;
  private sent: CursorPoint | null = null;
  private shown = false;
  private lastSentAt = -Infinity;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
  private active = true;
  private disabled = false;

  constructor(publish: (payload: CursorPayload) => boolean) {
    this.publish = publish;
  }

  move(point: CursorPoint | null) {
    if (!point) {
      this.latest = null;
      this.hide();
      return;
    }
    if (!isValidCoord(point.x) || !isValidCoord(point.y)) return;
    this.latest = { x: roundCoord(point.x), y: roundCoord(point.y) };
    this.schedule();
  }

  hide() {
    this.clearTimers();
    const wasShown = this.shown;
    this.shown = false;
    this.sent = null;
    if (wasShown && !this.disabled) this.publish({ visible: false });
  }

  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    if (active) this.schedule();
    else this.hide();
  }

  connectionReady() {
    this.disabled = false;
    this.shown = false;
    this.sent = null;
    this.schedule();
  }

  connectionLost() {
    this.clearTimers();
    this.shown = false;
    this.sent = null;
  }

  disable() {
    this.clearTimers();
    this.disabled = true;
    this.shown = false;
    this.sent = null;
  }

  isDisabled() {
    return this.disabled;
  }

  dispose() {
    this.clearTimers();
  }

  private canSend() {
    return this.active && !this.disabled;
  }

  private schedule() {
    if (!this.latest || !this.canSend() || this.moveTimer !== null) return;
    const wait = CURSOR_MOVE_INTERVAL_MS - (Date.now() - this.lastSentAt);
    if (wait <= 0) {
      this.flush(false);
      return;
    }
    this.moveTimer = setTimeout(() => {
      this.moveTimer = null;
      this.flush(false);
    }, wait);
  }

  private flush(force: boolean) {
    const point = this.latest;
    if (!point || !this.canSend()) return;
    if (!force && this.shown && this.sent && this.sent.x === point.x && this.sent.y === point.y) return;
    if (!this.publish({ visible: true, x: point.x, y: point.y })) {
      this.shown = false;
      this.sent = null;
      return;
    }
    this.sent = point;
    this.shown = true;
    this.lastSentAt = Date.now();
    this.armKeepAlive();
  }

  private armKeepAlive() {
    if (this.keepAliveTimer !== null) clearTimeout(this.keepAliveTimer);
    this.keepAliveTimer = setTimeout(() => {
      this.keepAliveTimer = null;
      this.flush(true);
    }, CURSOR_KEEPALIVE_MS);
  }

  private clearTimers() {
    if (this.moveTimer !== null) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
    if (this.keepAliveTimer !== null) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}

export class RemoteCursorStore {
  private cursors = new Map<string, RemoteCursor>();
  private actorSince = new Map<number, number>();
  private snapshot: RemoteCursor[] = [];
  private listeners = new Set<() => void>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  receive(message: any, myMemberId: number) {
    if (!message || typeof message.cursorId !== 'string' || message.cursorId === '') return;
    const actorMemberId = Number(message.actorMemberId);
    if (!Number.isFinite(actorMemberId) || actorMemberId === myMemberId) return;

    if (message.visible === false) {
      if (this.cursors.delete(message.cursorId)) this.emit();
      return;
    }
    if (message.visible !== true || !isValidCoord(message.x) || !isValidCoord(message.y)) return;

    const now = Date.now();
    if (!this.actorSince.has(actorMemberId)) this.actorSince.set(actorMemberId, now);
    this.cursors.set(message.cursorId, {
      cursorId: message.cursorId,
      actorMemberId,
      x: message.x,
      y: message.y,
      lastSeen: now,
      since: this.actorSince.get(actorMemberId) as number
    });
    this.emit();
    this.ensureSweep();
  }

  sweep(now = Date.now()) {
    let changed = false;
    this.cursors.forEach((cursor, cursorId) => {
      if (now - cursor.lastSeen > CURSOR_EXPIRE_MS) {
        this.cursors.delete(cursorId);
        changed = true;
      }
    });
    if (changed) this.emit();
    if (this.cursors.size === 0) this.stopSweep();
  }

  clear() {
    this.stopSweep();
    if (this.cursors.size === 0) return;
    this.cursors.clear();
    this.emit();
  }

  reset() {
    this.actorSince.clear();
    this.clear();
  }

  private emit() {
    this.snapshot = Array.from(this.cursors.values());
    this.listeners.forEach(listener => listener());
  }

  private ensureSweep() {
    if (this.sweepTimer !== null) return;
    this.sweepTimer = setInterval(() => this.sweep(), CURSOR_SWEEP_MS);
  }

  private stopSweep() {
    if (this.sweepTimer === null) return;
    clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }
}

interface CollabCursorLayerProps {
  store: RemoteCursorStore;
  zoom: number;
  describe: (cursor: RemoteCursor) => CursorAppearance;
}

export const CollabCursorLayer: React.FC<CollabCursorLayerProps> = ({ store, zoom, describe }) => {
  const cursors = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (cursors.length === 0) return null;
  const inverseZoom = 1 / (zoom || 1);

  return (
    <div
      className="collab-cursor-layer"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 30 }}
    >
      {cursors.map(cursor => {
        const { color, label } = describe(cursor);
        return (
          <div
            key={cursor.cursorId}
            className="collab-cursor"
            data-cursor-id={cursor.cursorId}
            data-member-id={cursor.actorMemberId}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${inverseZoom})`,
              transformOrigin: '0 0',
              transition: 'transform 0.12s linear',
              willChange: 'transform'
            }}
          >
            <CursorArrow color={color} />
            {label && (
              <div
                className="collab-cursor-label"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 14,
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  background: color,
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: '18px',
                  padding: '1px 8px',
                  borderRadius: 9,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              >
                {label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const LocalCursor: React.FC = () => {
  const pointerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = document.body;
    body.classList.add(LOCAL_CURSOR_CLASS);

    const setVisible = (visible: boolean) => {
      if (pointerRef.current) pointerRef.current.style.opacity = visible ? '1' : '0';
    };
    const handlePointer = (e: PointerEvent) => {
      const el = pointerRef.current;
      if (!el) return;
      if (e.pointerType === 'touch') {
        setVisible(false);
        return;
      }
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      setVisible(!usesNativeCursor(e));
    };
    const handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) setVisible(false);
    };
    const handleDragStart = (e: DragEvent) => {
      if (!e.defaultPrevented) setVisible(false);
    };

    window.addEventListener('pointermove', handlePointer, true);
    window.addEventListener('pointerdown', handlePointer, true);
    document.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('dragstart', handleDragStart);
    return () => {
      body.classList.remove(LOCAL_CURSOR_CLASS);
      window.removeEventListener('pointermove', handlePointer, true);
      window.removeEventListener('pointerdown', handlePointer, true);
      document.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  return (
    <>
      <style>{LOCAL_CURSOR_STYLE}</style>
      <div
        ref={pointerRef}
        className="collab-local-cursor-pointer"
        style={{ position: 'fixed', left: 0, top: 0, zIndex: 2147483647, pointerEvents: 'none', opacity: 0, willChange: 'transform' }}
      >
        <CursorArrow color={LOCAL_CURSOR_COLOR} />
      </div>
    </>
  );
};