declare module 'react-pageflip' {
  import { Component, CSSProperties, ReactNode } from 'react';

  interface HTMLFlipBookProps {
    width: number;
    height: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
    startPage?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
    onFlip?: (e: { data: number }) => void;
    onChangeOrientation?: (e: { data: 'portrait' | 'landscape' }) => void;
    onChangeState?: (e: { data: 'user_fold' | 'fold_corner' | 'flipping' | 'read' }) => void;
    onInit?: (e: { data: unknown }) => void;
    onUpdate?: (e: { data: unknown }) => void;
  }

  export class HTMLFlipBook extends Component<HTMLFlipBookProps> {
    pageFlip(): {
      flipNext: (corner?: 'top' | 'bottom') => void;
      flipPrev: (corner?: 'top' | 'bottom') => void;
      flip: (pageNum: number, corner?: 'top' | 'bottom') => void;
      turnToPage: (pageNum: number) => void;
      turnToNextPage: () => void;
      turnToPrevPage: () => void;
      getCurrentPageIndex: () => number;
      getPageCount: () => number;
      getOrientation: () => 'portrait' | 'landscape';
      destroy: () => void;
    };
  }
}
