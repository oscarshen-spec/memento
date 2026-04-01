export interface Point {
  x: number;
  y: number;
}

export interface RawMaterial {
  id: string;
  image: string;
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

export interface ScrapbookPage {
  id: string;
  scraps: Scrap[];
  journalEntries: JournalEntry[];
  tapeStrips: TapeStrip[];
  residueMarks: ResidueMark[];
  background: string;
}
