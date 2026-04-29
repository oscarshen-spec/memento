export interface Point {
  x: number;
  y: number;
}

export type RawMaterialStatus = 'drawer' | 'gallery';

export interface RawMaterial {
  id: string;
  image: string;
  status: RawMaterialStatus;
}

export interface Scrap {
  id: string;
  image: string;
  points: Point[];
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
  isGlued: boolean;
  isTorn?: boolean;
  tornEdge?: Point[]; // just the jagged tear line, for edge-only stroke rendering
}

export interface JournalEntry {
  id: string;
  text: string;
  type: 'title' | 'body' | 'date';
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  fontFamily?: string;
  color?: string;
  hasPaperBackground?: boolean;
  paperWidthOverride?: number;
  paperHeightOverride?: number;
}

export interface TapeStrip {
  id: string;
  startPoint: Point;
  endPoint: Point;
  width: number;
  tearSeed: number;
}

export interface ResidueMark {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Envelope {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  style: 'cream' | 'kraft' | 'pink';
  isOpen: boolean;
  contents: Scrap[]; // scraps with x/y relative to envelope interior (origin = top-left of body)
  zIndex: number;
}

export interface ScrapbookPage {
  id: string;
  scraps: Scrap[];
  journalEntries: JournalEntry[];
  tapeStrips: TapeStrip[];
  residueMarks: ResidueMark[];
  envelopes: Envelope[];
  background: string;
}
