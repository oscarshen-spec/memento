import React from 'react';

export type FlipPhase = 'down' | 'move' | 'up';

export interface PointerCoords {
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  pointerId: number;
  width: number;
  height: number;
}

const MOUSE_TYPE: Record<FlipPhase, string> = {
  down: 'mousedown',
  move: 'mousemove',
  up: 'mouseup',
};

const TOUCH_TYPE: Record<FlipPhase, string> = {
  down: 'touchstart',
  move: 'touchmove',
  up: 'touchend',
};

/**
 * Builds a synthetic MouseEvent or TouchEvent for forwarding to StPageFlip.
 * StPageFlip listens to mouse* and touch* events internally.
 * pointerType 'touch' → TouchEvent; everything else → MouseEvent.
 */
export function buildFlipEvent(
  phase: FlipPhase,
  pointerType: string,
  coords: PointerCoords,
  target: EventTarget,
): MouseEvent | TouchEvent {
  if (pointerType === 'touch') {
    const touch = new Touch({
      identifier: coords.pointerId,
      target: target as EventTarget & Element,
      clientX: coords.clientX,
      clientY: coords.clientY,
      pageX: coords.pageX,
      pageY: coords.pageY,
      screenX: coords.screenX,
      screenY: coords.screenY,
      radiusX: coords.width / 2,
      radiusY: coords.height / 2,
    });
    return new TouchEvent(TOUCH_TYPE[phase], {
      changedTouches: [touch],
      touches: phase === 'up' ? [] : [touch],
      bubbles: true,
      cancelable: true,
    });
  }

  return new MouseEvent(MOUSE_TYPE[phase], {
    clientX: coords.clientX,
    clientY: coords.clientY,
    bubbles: true,
    cancelable: true,
  });
}

/** Pull the coords needed by buildFlipEvent out of a React PointerEvent. */
export function extractPointerCoords(e: React.PointerEvent): PointerCoords {
  return {
    clientX: e.clientX,
    clientY: e.clientY,
    pageX: e.pageX,
    pageY: e.pageY,
    screenX: e.screenX,
    screenY: e.screenY,
    pointerId: e.pointerId,
    width: e.width,
    height: e.height,
  };
}
