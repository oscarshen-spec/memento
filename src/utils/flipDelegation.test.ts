import { describe, it, expect, beforeAll } from 'vitest';
import { buildFlipEvent, extractPointerCoords, PointerCoords } from './flipDelegation';
// React import removed — extractPointerCoords now accepts the native PointerEvent type

const coords = {
  clientX: 100, clientY: 200,
  pageX: 100, pageY: 200,
  screenX: 100, screenY: 200,
  pointerId: 1, width: 1, height: 1,
};

// mockTarget is initialised in beforeAll so document is available (node env polyfill)
let mockTarget: Element;

// Mock MouseEvent and TouchEvent for node environment
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).MouseEvent === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).MouseEvent = class MouseEvent {
      type: string;
      clientX: number;
      clientY: number;
      bubbles: boolean;
      cancelable: boolean;

      constructor(type: string, options?: any) {
        this.type = type;
        this.clientX = options?.clientX ?? 0;
        this.clientY = options?.clientY ?? 0;
        this.bubbles = options?.bubbles ?? false;
        this.cancelable = options?.cancelable ?? false;
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).Touch === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Touch = class Touch {
      identifier: number;
      target: EventTarget;
      clientX: number;
      clientY: number;
      pageX: number;
      pageY: number;
      screenX: number;
      screenY: number;
      radiusX: number;
      radiusY: number;

      constructor(options?: any) {
        this.identifier = options?.identifier ?? 0;
        this.target = options?.target;
        this.clientX = options?.clientX ?? 0;
        this.clientY = options?.clientY ?? 0;
        this.pageX = options?.pageX ?? 0;
        this.pageY = options?.pageY ?? 0;
        this.screenX = options?.screenX ?? 0;
        this.screenY = options?.screenY ?? 0;
        this.radiusX = options?.radiusX ?? 0;
        this.radiusY = options?.radiusY ?? 0;
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).TouchEvent === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).TouchEvent = class TouchEvent {
      type: string;
      changedTouches: any[];
      touches: any[];
      bubbles: boolean;
      cancelable: boolean;

      constructor(type: string, options?: any) {
        this.type = type;
        this.changedTouches = options?.changedTouches ?? [];
        this.touches = options?.touches ?? [];
        this.bubbles = options?.bubbles ?? false;
        this.cancelable = options?.cancelable ?? false;
      }
    };
  }

  // Polyfill document.createElement for the node test environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).document === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = {
      createElement: (tag: string) => ({ tagName: tag.toUpperCase() }),
    };
  }
  mockTarget = document.createElement('div') as unknown as Element;
});

describe('buildFlipEvent — mouse', () => {
  it('creates mousedown for phase down', () => {
    const event = buildFlipEvent('down', 'mouse', coords, mockTarget);
    expect(event instanceof MouseEvent).toBe(true);
    expect(event.type).toBe('mousedown');
    expect((event as MouseEvent).clientX).toBe(100);
    expect((event as MouseEvent).clientY).toBe(200);
  });

  it('creates mousemove for phase move', () => {
    const event = buildFlipEvent('move', 'mouse', coords, mockTarget);
    expect(event.type).toBe('mousemove');
  });

  it('creates mouseup for phase up', () => {
    const event = buildFlipEvent('up', 'mouse', coords, mockTarget);
    expect(event.type).toBe('mouseup');
  });

  it('treats pen as mouse', () => {
    const event = buildFlipEvent('down', 'pen', coords, mockTarget);
    expect(event instanceof MouseEvent).toBe(true);
    expect(event.type).toBe('mousedown');
  });
});

describe('buildFlipEvent -- touch', () => {
  it('builds a touchstart for phase down', () => {
    const target = document.createElement('div');
    const coords: PointerCoords = {
      clientX: 10, clientY: 20,
      pageX: 30, pageY: 40,
      screenX: 50, screenY: 60,
      pointerId: 2,
      width: 8, height: 8,
    };
    const evt = buildFlipEvent('down', 'touch', coords, target) as TouchEvent;
    expect(evt.type).toBe('touchstart');
    expect(evt.touches.length).toBe(1);
    expect(evt.changedTouches[0].clientX).toBe(10);
    expect(evt.changedTouches[0].clientY).toBe(20);
  });

  it('builds a touchend with empty touches array for phase up', () => {
    const target = document.createElement('div');
    const coords: PointerCoords = {
      clientX: 10, clientY: 20,
      pageX: 30, pageY: 40,
      screenX: 50, screenY: 60,
      pointerId: 2,
      width: 8, height: 8,
    };
    const evt = buildFlipEvent('up', 'touch', coords, target) as TouchEvent;
    expect(evt.type).toBe('touchend');
    expect(evt.touches.length).toBe(0);
    expect(evt.changedTouches.length).toBe(1);
  });
});

describe('extractPointerCoords', () => {
  it('extracts all nine coordinate fields', () => {
    const fakeEvent = {
      clientX: 10, clientY: 20,
      pageX: 30, pageY: 40,
      screenX: 50, screenY: 60,
      pointerId: 3, width: 2, height: 4,
      pointerType: 'mouse',
    } as PointerEvent;
    const result = extractPointerCoords(fakeEvent);
    expect(result.clientX).toBe(10);
    expect(result.clientY).toBe(20);
    expect(result.pageX).toBe(30);
    expect(result.pageY).toBe(40);
    expect(result.screenX).toBe(50);
    expect(result.screenY).toBe(60);
    expect(result.pointerId).toBe(3);
    expect(result.width).toBe(2);
    expect(result.height).toBe(4);
  });
});
