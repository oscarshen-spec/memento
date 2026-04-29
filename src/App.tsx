import React, { useState, useRef } from 'react';
import type { PanInfo } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { partitionScraps, tapeTouchesScrap } from './utils/scrapUtils';
import confetti from 'canvas-confetti';
import { Scrap, Point, RawMaterial, ScrapbookPage, JournalEntry, TapeStrip, ResidueMark, Envelope, ScrapbookMeta } from './types';
import { HomeView } from './components/HomeView';
import { CameraView } from './components/CameraView';
import { CuttingRoom } from './components/CuttingRoom';
import { Scrapbook } from './components/Scrapbook';
import { MaterialDrawer } from './components/MaterialDrawer';
import { JournalModal } from './components/JournalModal';
import { PaperScrapInput } from './components/PaperScrapInput';
import { GlueAnimation } from './components/GlueAnimation';
import type { GlueRect } from './components/GlueAnimation';
import { ScissorsCutView } from './components/ScissorsCutView';
import { TearCutView } from './components/TearCutView';
import { playSound } from './services/soundService';
import { partitionByStatus, reclassify } from './utils/materialStatus';
import { Gallery } from './components/Gallery';
import { WindowLight } from './components/WindowLight';
import { rasterizePolygon } from './utils/rasterizePolygon';
import { compressImage } from './utils/compressImage';
import { PaperTearBorderEffect, applyTornEdgeFringe } from './effects/PaperTearBorderEffect';
import { bakePaperTearPiece } from './services/webglTearEffect';

const noop = () => {};

const INITIAL_PAGE: ScrapbookPage = {
  id: 'page-1',
  scraps: [],
  journalEntries: [],
  tapeStrips: [],
  residueMarks: [],
  envelopes: [],
  background: '#fdfaf3',
};

export default function App() {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([
    { id: 'sample-3', image: '/Europe-scraps/Group 6.png', status: 'drawer' },
    { id: 'sample-palace', image: '/palace.png', status: 'drawer' },
    { id: 'europe-2242', image: '/Europe_2242.png', status: 'drawer' },
    { id: 'europe-2288', image: '/Europe_2288.png', status: 'drawer' },
    { id: 'europe-2321', image: '/Europe_2321.png', status: 'drawer' },
    { id: 'vatican-scrap', image: '/Europe-scraps/Vatican-scrap.png', status: 'drawer' },
  ]);
  // Compress any static-URL images (e.g. large photos) down to a drawable size on mount.
  // Static paths start with '/' and haven't been through canvas yet.
  React.useEffect(() => {
    setRawMaterials(prev => {
      const toCompress = prev.filter(m => m.image.startsWith('/'));
      if (toCompress.length === 0) return prev;
      toCompress.forEach(m => {
        compressImage(m.image).then(compressed => {
          setRawMaterials(cur => cur.map(r => r.id === m.id ? { ...r, image: compressed } : r));
        });
      });
      return prev;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { drawer: drawerMaterials, gallery: galleryMaterials } = React.useMemo(
    () => partitionByStatus(rawMaterials),
    [rawMaterials],
  );

  const [pages, setPages] = useState<ScrapbookPage[]>([INITIAL_PAGE]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [appScreen, setAppScreen] = useState<'home' | 'editor'>('home');
  const [scrapbooks, setScrapbooks] = useState<ScrapbookMeta[]>([
    { id: 'book-1', name: 'My Scrapbook' },
  ]);
  const [view, setView] = useState<'scrapbook' | 'camera' | 'cutting' | 'drawer' | 'journal'>('scrapbook');
  const drawerAreaRef = useRef<HTMLDivElement>(null);
  const handleCardDragging = React.useCallback((dragging: boolean) => {
    const el = drawerAreaRef.current;
    if (el) {
      el.style.overflow = dragging ? 'visible' : 'hidden';
      el.style.zIndex = dragging ? '9999' : '20';
    }
  }, []);
  const [currentMaterial, setCurrentMaterial] = useState<RawMaterial | null>(null);
  const [activeTool, setActiveTool] = useState<'tape' | 'text' | 'glue' | null>(null);
  const [fallingOff, setFallingOff] = useState<{ direction: 'prev' | 'next'; scrapIds: string[] } | null>(null);
  const [drawerBounce, setDrawerBounce] = useState(false);
  const [selectedScrapId, setSelectedScrapId] = useState<string | null>(null);
  const [gluingScrapId, setGluingScrapId] = useState<string | null>(null);
  const [isGlueBottleAway, setIsGlueBottleAway] = useState(false);
  const [glueAnimRect, setGlueAnimRect] = useState<GlueRect | null>(null);
  const [glueToolRect, setGlueToolRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [scissorTarget, setScissorTarget] = useState<Scrap | null>(null);
  const [tearTarget, setTearTarget] = useState<Scrap | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editingGalleryMaterial, setEditingGalleryMaterial] = useState<RawMaterial | null>(null);
  const glueButtonRef = useRef<HTMLButtonElement>(null);
  const galleryRectRef = React.useRef<DOMRect | null>(null);

  const handleReclassify = React.useCallback((id: string, status: 'drawer' | 'gallery') => {
    setRawMaterials(prev => reclassify(prev, id, status));
  }, []);

  const handleGalleryCut = async (
    points: Point[],
    _isTorn: boolean | undefined,
    secondPoints?: Point[],
  ) => {
    if (!editingGalleryMaterial) return;
    // CuttingRoom produces polygons whose extreme x/y equal the cutting-room
    // canvas width/height by construction (corners pinned to 0/cw and 0/ch).
    // Derive the canvas dimensions from the polygon bounds so the rasterizer
    // reproduces the same object-fit: contain draw.
    const allPoints = secondPoints ? [...points, ...secondPoints] : points;
    const canvasW = Math.max(...allPoints.map(p => p.x));
    const canvasH = Math.max(...allPoints.map(p => p.y));
    try {
      const firstUrl = await rasterizePolygon(
        editingGalleryMaterial.image, points, canvasW, canvasH,
      );
      const leftovers: RawMaterial[] = [];
      if (secondPoints) {
        const secondUrl = await rasterizePolygon(
          editingGalleryMaterial.image, secondPoints, canvasW, canvasH,
        );
        leftovers.push({
          id: Math.random().toString(36).substr(2, 9),
          image: secondUrl,
          status: 'gallery',
        });
      }
      setRawMaterials(prev => {
        const replaced = prev.map(m =>
          m.id === editingGalleryMaterial.id ? { ...m, image: firstUrl } : m,
        );
        return [...leftovers, ...replaced];
      });
    } catch (err) {
      console.error('Gallery cut rasterization failed:', err);
    } finally {
      setEditingGalleryMaterial(null);
    }
  };

  const currentPage = pages[currentPageIndex];

  // Calculate scrapbook dimensions — constrained to the 430px container cap
  const getScrapbookDimensions = () => {
    const containerWidth = window.innerWidth;
    const deskHeight = window.innerHeight * 0.8;
    const verticalPadding = 60;
    const topBarHeight = 64;

    return {
      width: containerWidth,
      height: deskHeight - verticalPadding - topBarHeight,
    };
  };

  const [bookDims, setBookDims] = useState(getScrapbookDimensions());
  const bookPageRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleResize = () => setBookDims(getScrapbookDimensions());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCapture = (image: string) => {
    const newMaterial: RawMaterial = {
      id: Math.random().toString(36).substr(2, 9),
      image,
      status: 'gallery',
    };
    setRawMaterials(prev => [newMaterial, ...prev]);
    setSelectedScrapId(null);
    if (!galleryOpen) setView('drawer');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 400;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        handleCapture(canvas.toDataURL('image/jpeg', 0.85));
      }
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const handleCut = (points: Point[], isTorn?: boolean, secondPoints?: Point[]) => {
    if (!currentMaterial) return;

    const centerX = (bookDims.width - 68) / 2;
    const centerY = bookDims.height / 2;

    const baseProps = {
      image: currentMaterial.image,
      rotation: (Math.random() - 0.5) * 20,
      scale: 0.5,
      isGlued: false,
      isTorn: isTorn ?? false,
    };

    const scraps: Scrap[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        points,
        x: secondPoints ? centerX - 60 : centerX - 100,
        y: secondPoints ? centerY - 80 : centerY - 100,
        zIndex: currentPage.scraps.length,
        ...baseProps,
      },
    ];

    if (secondPoints) {
      scraps.push({
        id: Math.random().toString(36).substr(2, 9),
        points: secondPoints,
        x: centerX + 60,
        y: centerY + 80,
        zIndex: currentPage.scraps.length + 1,
        ...baseProps,
      });
    }

    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps.push(...scraps);
    setPages(updatedPages);
    setRawMaterials(prev => prev.filter(m => m.id !== currentMaterial!.id));
    setCurrentMaterial(null);
    setView('scrapbook');

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#e8d5b8', '#d4aa50', '#c4704b'],
    });

    if (isTorn) {
      const pageIdx = currentPageIndex;
      const srcImage = currentMaterial.image;

      const bakeTornPiece = async (scrapId: string, polygon: Point[]) => {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('Image load failed'));
            el.src = srcImage;
          });

          const xs = polygon.map(p => p.x);
          const ys = polygon.map(p => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const bboxW = (Math.max(...xs) - minX) || 1;
          const bboxH = (Math.max(...ys) - minY) || 1;

          const srcCanvas = document.createElement('canvas');
          srcCanvas.width = bboxW;
          srcCanvas.height = bboxH;
          const ctx = srcCanvas.getContext('2d')!;
          ctx.save();
          ctx.beginPath();
          polygon.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x - minX, p.y - minY);
            else ctx.lineTo(p.x - minX, p.y - minY);
          });
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, -minX, -minY);
          ctx.restore();

          const normalizedPolygon = polygon.map(p => ({
            x: (p.x - minX) / bboxW,
            y: (p.y - minY) / bboxH,
          }));

          const bakedUrl = await new PaperTearBorderEffect([normalizedPolygon]).processImage(srcCanvas);

          setPages(prev => prev.map((page, i) =>
            i !== pageIdx ? page : {
              ...page,
              scraps: page.scraps.map(s =>
                s.id === scrapId ? { ...s, image: bakedUrl, points: [] } : s,
              ),
            },
          ));
        } catch (err) {
          console.error('Tear effect baking failed:', err);
        }
      };

      bakeTornPiece(scraps[0].id, points);
      if (secondPoints) bakeTornPiece(scraps[1].id, secondPoints);
    }
  };

  const handleDragMaterial = React.useCallback((material: RawMaterial, info: PanInfo) => {
    const rect = bookPageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropX = info.point.x - rect.left;
    const dropY = info.point.y - rect.top;
    if (dropX < 0 || dropY < 0 || dropX > rect.width || dropY > rect.height) return;

    const img = new window.Image();
    img.onload = () => {
      const MAX_DIM = 280;
      const naturalMax = Math.max(img.naturalWidth, img.naturalHeight);
      const scale = Math.min(1, MAX_DIM / naturalMax);

      setPages(prev => {
        const newScrap: Scrap = {
          id: Math.random().toString(36).substr(2, 9),
          image: material.image,
          points: [],
          x: dropX,
          y: dropY,
          rotation: (Math.random() - 0.5) * 10,
          scale,
          zIndex: prev[currentPageIndex].scraps.length,
          isGlued: false,
        };
        return prev.map((p, i) =>
          i === currentPageIndex ? { ...p, scraps: [...p.scraps, newScrap] } : p
        );
      });
      setRawMaterials(prev => prev.filter(m => m.id !== material.id));
    };
    img.src = material.image;
  }, [currentPageIndex]);

  const handleAddJournal = (text: string, type: 'title' | 'body' | 'date') => {
    const newEntry: JournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
      x: (bookDims.width - 68) / 2 - 100,
      y: bookDims.height / 2 - 100,
      rotation: (Math.random() - 0.5) * 5,
      fontSize: type === 'title' ? 48 : type === 'date' ? 14 : 24,
    };

    const updatedPages = [...pages];
    updatedPages[currentPageIndex].journalEntries.push(newEntry);
    setPages(updatedPages);
  };

  const handleReturnScrap = (scrap: Scrap) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps = updatedPages[currentPageIndex].scraps.filter(s => s.id !== scrap.id);
    setPages(updatedPages);
    setRawMaterials(prev => [{ id: Math.random().toString(36).substr(2, 9), image: scrap.image, status: 'drawer' }, ...prev]);
    setSelectedScrapId(null);
    setView('drawer');
  };

  const handleAddTapeStrip = (strip: TapeStrip) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].tapeStrips.push(strip);
    updatedPages[currentPageIndex].scraps = updatedPages[currentPageIndex].scraps.map(s =>
      !s.isGlued && tapeTouchesScrap(strip, s) ? { ...s, isGlued: true } : s
    );
    setPages(updatedPages);
  };

  const handleAddText = (text: string) => {
    const newEntry: JournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type: 'body',
      x: (bookDims.width - 68) / 2 - 100,
      y: bookDims.height / 2 - 50,
      rotation: (Math.random() - 0.5) * 5,
      fontSize: 18,
      fontFamily: 'IM Fell English',
      color: '#3a2a1a',
      hasPaperBackground: true,
    };
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].journalEntries.push(newEntry);
    setPages(updatedPages);
    setActiveTool(null);
  };

  const updateScrap = (id: string, attrs: Partial<Scrap>) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps = updatedPages[currentPageIndex].scraps.map(s => 
      s.id === id ? { ...s, ...attrs } : s
    );
    setPages(updatedPages);
  };

  const updateEntry = (id: string, attrs: Partial<JournalEntry>) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].journalEntries = updatedPages[currentPageIndex].journalEntries.map(e =>
      e.id === id ? { ...e, ...attrs } : e
    );
    setPages(updatedPages);
  };

  const updateEnvelope = (id: string, attrs: Partial<Envelope>) => {
    setPages(prev => prev.map((p, i) =>
      i !== currentPageIndex ? p : {
        ...p,
        envelopes: (p.envelopes ?? []).map(e => e.id === id ? { ...e, ...attrs } : e),
      }
    ));
  };

  const handleAddEnvelope = React.useCallback(() => {
    const styles = ['cream', 'kraft', 'pink'] as const;
    const style = styles[Math.floor(Math.random() * styles.length)];
    const newEnvelope: Envelope = {
      id: Math.random().toString(36).substr(2, 9),
      x: (bookDims.width - 68) / 2,
      y: bookDims.height / 2,
      rotation: (Math.random() - 0.5) * 4,
      scale: 0.75,
      style,
      isOpen: false,
      contents: [],
      zIndex: pages[currentPageIndex].envelopes?.length ?? 0,
    };
    setPages(prev => prev.map((p, i) =>
      i !== currentPageIndex ? p : { ...p, envelopes: [...(p.envelopes ?? []), newEnvelope] }
    ));
    // Close the drawer and gallery so the user can see the envelope on the canvas
    setGalleryOpen(false);
    setView('scrapbook');
    setSelectedScrapId(null);
  }, [bookDims, currentPageIndex, pages]);

  const handleTuckScrap = React.useCallback((scrapId: string, envelopeId: string, dropX: number, dropY: number) => {
    setPages(prev => prev.map((page, i) => {
      if (i !== currentPageIndex) return page;
      const scrap = page.scraps.find(s => s.id === scrapId);
      const envelope = (page.envelopes ?? []).find(e => e.id === envelopeId);
      if (!scrap || !envelope) return page;

      // Convert canvas drop position to envelope interior local coords
      const ENV_W = 200, ENV_H = 130, FLAP_H = 55;
      const localX = (dropX - envelope.x) / envelope.scale + ENV_W / 2;
      const localY = (dropY - envelope.y) / envelope.scale + ENV_H / 2 - FLAP_H;
      const tuckedScrap: Scrap = {
        ...scrap,
        x: Math.max(0, Math.min(ENV_W, localX)),
        y: Math.max(0, Math.min(ENV_H - FLAP_H, localY)),
      };

      return {
        ...page,
        scraps: page.scraps.filter(s => s.id !== scrapId),
        envelopes: (page.envelopes ?? []).map(e =>
          e.id === envelopeId ? { ...e, contents: [...e.contents, tuckedScrap] } : e
        ),
      };
    }));
  }, [currentPageIndex]);

  const handleUntuckScrap = React.useCallback((envelopeId: string, scrap: Scrap, stageX: number, stageY: number) => {
    setPages(prev => prev.map((page, i) => {
      if (i !== currentPageIndex) return page;
      const restoredScrap: Scrap = {
        ...scrap,
        x: stageX,
        y: stageY,
        zIndex: page.scraps.length,
      };
      return {
        ...page,
        scraps: [...page.scraps, restoredScrap],
        envelopes: (page.envelopes ?? []).map(e =>
          e.id === envelopeId ? { ...e, contents: e.contents.filter(s => s.id !== scrap.id) } : e
        ),
      };
    }));
  }, [currentPageIndex]);

  const handleGlueTap = (scrapId: string, rect: GlueRect) => {
    const br = glueButtonRef.current?.getBoundingClientRect();
    playSound('wobbleStart');
    setGluingScrapId(scrapId);
    setGlueAnimRect(rect);
    if (br) setGlueToolRect({ x: br.x, y: br.y, width: br.width, height: br.height });
  };

  // Called when the bottle finishes pressing — lock the scrap now so the Konva squish fires
  const handleGluePress = () => {
    setPages(prev => prev.map((page, i) =>
      i === currentPageIndex
        ? { ...page, scraps: page.scraps.map(s => s.id === gluingScrapId ? { ...s, isGlued: true } : s) }
        : page
    ));
  };

  // Called after glow/sparkles — clean up animation state
  const handleGlueComplete = () => {
    setGluingScrapId(null);
    setGlueAnimRect(null);
    setGlueToolRect(null);
    setIsGlueBottleAway(false);
    setActiveTool(null);
  };

  const handlePeel = (scrapId: string, scrapRect: { x: number; y: number; width: number; height: number }) => {
    const scrap = currentPage.scraps.find(s => s.id === scrapId);
    if (!scrap) return;
    playSound('peel');
    const residue: ResidueMark = {
      id: crypto.randomUUID(),
      x: scrapRect.x - 5,
      y: scrapRect.y - 3,
      width: scrapRect.width + 10,
      height: scrapRect.height + 8,
      rotation: scrap.rotation + (Math.random() * 4 - 2),
    };
    setPages(prev => prev.map((page, i) =>
      i === currentPageIndex
        ? {
            ...page,
            residueMarks: [...(page.residueMarks ?? []), residue],
            scraps: page.scraps.map(s => s.id === scrapId ? { ...s, isGlued: false } : s),
          }
        : page
    ));
  };

  const handleScissorCut = (insideImage: string, insidePoints: Point[], outsideImage: string) => {
    if (!scissorTarget) return;
    // Update the scrap with clipped image and new points
    updateScrap(scissorTarget.id, {
      image: insideImage,
      points: insidePoints,
    });
    // Create RawMaterial from leftover and add to drawer
    setRawMaterials(prev => [
      { id: Math.random().toString(36).substr(2, 9), image: outsideImage, status: 'drawer' },
      ...prev,
    ]);
    setScissorTarget(null);
    setSelectedScrapId(null);
  };

  const handleTearCut = (topPolygon: Point[], _isTorn: boolean, bottomPolygon: Point[], jaggedLine: Point[]) => {
    if (!tearTarget) return;

    const srcImage = tearTarget.image;
    const targetId = tearTarget.id;
    const pageIdx = currentPageIndex;
    const newScrapId = Math.random().toString(36).substring(2, 11);

    // Place both pieces immediately with raw polygons so they appear at once
    updateScrap(targetId, { image: srcImage, points: topPolygon, isTorn: true, tornEdge: jaggedLine });
    setPages(prev => prev.map((page, i) =>
      i === pageIdx
        ? {
            ...page,
            scraps: [...page.scraps, {
              id: newScrapId,
              image: srcImage,
              points: bottomPolygon,
              tornEdge: jaggedLine,
              x: (bookDims.width - 68) / 2,
              y: bookDims.height / 2,
              rotation: (Math.random() - 0.5) * 20,
              scale: 0.5,
              isGlued: false,
              isTorn: true,
              zIndex: page.scraps.length,
            }],
          }
        : page
    ));
    setTearTarget(null);
    setSelectedScrapId(null);

    // Bake fringe only on the tear edge (jaggedLine) — clean photo edges stay untouched
    const bake = async (scrapId: string, polygon: Point[]) => {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Image load failed'));
          el.src = srcImage;
        });

        const xs = polygon.map(p => p.x);
        const ys = polygon.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const bboxW = (Math.max(...xs) - minX) || 1;
        const bboxH = (Math.max(...ys) - minY) || 1;

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = bboxW;
        srcCanvas.height = bboxH;
        const ctx = srcCanvas.getContext('2d')!;
        ctx.save();
        ctx.beginPath();
        polygon.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x - minX, p.y - minY);
          else ctx.lineTo(p.x - minX, p.y - minY);
        });
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, -minX, -minY);
        ctx.restore();

        const localTearEdge = jaggedLine.map(p => ({ x: p.x - minX, y: p.y - minY }));
        const bakedCanvas = applyTornEdgeFringe(srcCanvas, localTearEdge);
        const bakedUrl = bakedCanvas.toDataURL('image/png');

        setPages(prev => prev.map((page, i) =>
          i !== pageIdx ? page : {
            ...page,
            scraps: page.scraps.map(s =>
              s.id === scrapId ? { ...s, image: bakedUrl, points: [] } : s,
            ),
          },
        ));
      } catch (err) {
        console.error('Tear effect baking failed:', err);
      }
    };

    bake(targetId, topPolygon);
    bake(newScrapId, bottomPolygon);
  };

  const handlePageTurn = (direction: 'prev' | 'next') => {
    setSelectedScrapId(null);

    // Auto-add a blank page when flipping forward from the last page
    if (direction === 'next' && currentPageIndex === pages.length - 1) {
      const newPage: ScrapbookPage = {
        id: `page-${pages.length + 1}`,
        scraps: [],
        journalEntries: [],
        tapeStrips: [],
        residueMarks: [],
        envelopes: [],
        background: '#fdfaf3',
      };
      setPages(prev => [...prev, newPage]);
    }

    const { falling } = partitionScraps(currentPage.scraps);
    if (falling.length === 0) {
      setCurrentPageIndex(prev => direction === 'next' ? prev + 1 : prev - 1);
      return;
    }
    setFallingOff({ direction, scrapIds: falling.map(s => s.id) });
  };

  const handleFallComplete = (fallenIds: string[]) => {
    if (!fallingOff) return;
    const dir = fallingOff.direction;
    const fallen = currentPage.scraps.filter(s => fallenIds.includes(s.id));
    setPages(prev => prev.map((p, i) =>
      i === currentPageIndex
        ? { ...p, scraps: p.scraps.filter(s => !fallenIds.includes(s.id)) }
        : p
    ));
    setRawMaterials(prev => [
      ...fallen.map(s => ({ id: Math.random().toString(36).substr(2, 9), image: s.image, status: 'drawer' as const })),
      ...prev,
    ]);
    setFallingOff(null);
    setCurrentPageIndex(prev => dir === 'next' ? prev + 1 : prev - 1);
    setDrawerBounce(true);
    setTimeout(() => setDrawerBounce(false), 300);
  };

  const handleSelectScrap = (id: string | null) => {
    if (id !== null) setActiveTool(null);
    setSelectedScrapId(id);
  };


  const handleSelectScrapbook = (_id: string) => {
    setAppScreen('editor');
  };

  const handleCreateNew = () => {
    const newBook: ScrapbookMeta = {
      id: `book-${Date.now()}`,
      name: 'New Scrapbook',
    };
    setScrapbooks(prev => [...prev, newBook]);
    setAppScreen('editor');
  };

  if (appScreen === 'home') {
    return (
      <div className="w-full h-screen">
        <HomeView
          scrapbooks={scrapbooks}
          onSelect={handleSelectScrapbook}
          onCreateNew={handleCreateNew}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center">
    <div className="relative w-full h-full overflow-hidden select-none flex flex-col bg-[#0f0805]">
      <motion.div
        className="flex flex-col w-full"
        animate={{ y: galleryOpen ? '-80vh' : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Desk Area (Top 80%) */}
        <div className="relative w-full h-[80vh] flex flex-col items-center z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] wood-texture">
          {/* Scattered selection icons — scissor & tear, shown when a scrap is selected */}
          <AnimatePresence>
            {selectedScrapId !== null && (
              <>
                <motion.button
                key="scissor-tool"
                onClick={() => {
                  const scrap = currentPage.scraps.find(s => s.id === selectedScrapId);
                  if (scrap) setScissorTarget(scrap);
                }}
                style={{ position: 'absolute', top: -60, left: -20, rotate: '102deg', zIndex: 20 }}
                className="p-1"
                title="Cut"
                initial={{ y: -140, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.08 } }}
                exit={{ y: -140, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
              >
                <img
                  src="/Scissors.png"
                  width="240"
                  height="240"
                  alt="Scissor"
                  className="transition-all duration-150 opacity-100 hover:scale-105"
                  style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
              <motion.button
                key="tear-tool"
                onClick={() => {
                  const scrap = currentPage.scraps.find(s => s.id === selectedScrapId);
                  if (scrap) setTearTarget(scrap);
                }}
                style={{ position: 'absolute', top: -36, right: 120, rotate: '15deg', zIndex: 20 }}
                className="p-1"
                title="Tear"
                initial={{ y: -140, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0 } }}
                exit={{ y: -140, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.08 } }}
              >
                <img
                  src="/Tear.png"
                  width="175"
                  height="175"
                  alt="Tear"
                  className="transition-all duration-150 opacity-100 hover:scale-105"
                  style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
              </>
            )}
          </AnimatePresence>

          {/* Scattered tool icons — lying on the desk above the scrapbook */}
          <AnimatePresence>
            {selectedScrapId === null && (
              <>
                <motion.button
                  key="tape-tool"
                  onClick={() => setActiveTool(activeTool === 'tape' ? null : 'tape')}
                  style={{ position: 'absolute', top: -40, left: -40, rotate: '-14deg', zIndex: 20 }}
                  className="p-1"
                  title="Tape tool"
                  initial={{ y: -120, opacity: 0 }}
                  animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.08 } }}
                  exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
                >
                  <img
                    src="/Tape.png"
                    width="200"
                    height="200"
                    alt="Tape"
                    className={`transition-all duration-150 ${activeTool === 'tape' ? 'opacity-100 scale-110' : 'opacity-100 hover:scale-105'}`}
                    style={{ filter: activeTool === 'tape' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                  />
                </motion.button>
                <motion.button
                  key="text-tool"
                  onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
                  style={{ position: 'absolute', top: -32, left: '52%', translateX: '-50%', rotate: '-6deg', zIndex: 20 }}
                  className="p-1"
                  title="Text tool"
                  initial={{ y: -120, opacity: 0 }}
                  animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.04 } }}
                  exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.04 } }}
                >
                  <img
                    src="/Text.png"
                    width="180"
                    height="180"
                    alt="Text"
                    className={`transition-all duration-150 ${activeTool === 'text' ? 'opacity-100 scale-110' : 'opacity-100 hover:scale-105'}`}
                    style={{ filter: activeTool === 'text' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                  />
                </motion.button>
                <motion.button
                  key="glue-tool"
                  ref={glueButtonRef}
                  onClick={() => setActiveTool(activeTool === 'glue' ? null : 'glue')}
                  style={{ position: 'absolute', top: -32, right: -24, rotate: '12deg', zIndex: 20, opacity: isGlueBottleAway ? 0 : 1, pointerEvents: isGlueBottleAway ? 'none' : 'auto', transition: 'opacity 0.1s' }}
                  className="p-1"
                  title="Glue tool"
                  initial={{ y: -120, opacity: 0 }}
                  animate={{ y: 0, opacity: isGlueBottleAway ? 0 : 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0 } }}
                  exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.08 } }}
                >
                  <img
                    src="/Glue.png"
                    width="200"
                    height="200"
                    alt="Glue"
                    className={`transition-all duration-150 ${activeTool === 'glue' ? 'opacity-100 scale-110' : 'opacity-100 hover:scale-105'}`}
                    style={{ filter: activeTool === 'glue' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                  />
                </motion.button>
              </>
            )}
          </AnimatePresence>
          {/* Top Bar - Subtle icons on the desk */}
          <div className="w-full h-16 flex justify-between items-center px-6 md:px-12 shrink-0 z-10">
            <div />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <h1 className="text-lg leading-none" style={{ fontFamily: 'Caveat, cursive', color: 'rgba(232,213,184,0.7)', fontWeight: 700 }}>My Scrapbook</h1>
                <p className="text-[9px] uppercase mt-1" style={{ color: 'rgba(212,170,80,0.4)', letterSpacing: '0.2em' }}>
                  Page {currentPageIndex + 1} of {pages.length}
                </p>
              </div>
              <div className="flex gap-0.5">
                <button
                  disabled={currentPageIndex === 0}
                  onClick={() => { setActiveTool(null); handlePageTurn('prev'); }}
                  className="p-2 rounded-lg disabled:opacity-15 transition-colors"
                  style={{ color: 'rgba(212,170,80,0.6)' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => { setActiveTool(null); handlePageTurn('next'); }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'rgba(212,170,80,0.6)' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Scrapbook on Desk */}
          <div className="relative flex-1 flex items-center justify-start w-full">
            {/* Cover + book wrapper — cover bleeds 28px beyond book on all sides.
                Shifted left by 96px (28 cover bleed + 36 spine + 14 page-stack + 18 gutter)
                so the Konva canvas left edge aligns to x=0 of the screen. */}
            <div className="relative" style={{ width: bookDims.width + 56, height: bookDims.height + 56, marginLeft: -96 }}>
              {/* Leather cover — sits behind everything */}
              <img
                src="/scrapbook_cover.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full rounded-lg pointer-events-none"
                style={{ filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.65))' }}
              />
              {/* Book positioned inset 28px from cover edges */}
              <div
                className="absolute book-container"
                style={{ top: 28, left: 28, width: bookDims.width, height: bookDims.height }}
              >
                <div className="spine" />
                <div className="page-stack" />
                <div className="gutter" />
                <div
                  ref={bookPageRef}
                  className="book-page"
                >
                  <div style={{ pointerEvents: galleryOpen ? 'none' : 'auto' }}>
                    <Scrapbook
                      page={currentPage}
                      dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
                      onUpdateScrap={updateScrap}
                      onUpdateEntry={updateEntry}
                      onReturnScrap={handleReturnScrap}
                      onAddTapeStrip={handleAddTapeStrip}
                      isTapeActive={activeTool === 'tape'}
                      isGlueActive={activeTool === 'glue'}
                      fallingScrapIds={fallingOff?.scrapIds ?? null}
                      onFallComplete={handleFallComplete}
                      selectedScrapId={selectedScrapId}
                      onSelectScrap={handleSelectScrap}
                      gluingScrapId={gluingScrapId}
                      onGlueTap={handleGlueTap}
                      onPeel={handlePeel}
                      onUpdateEnvelope={updateEnvelope}
                      onTuckScrap={handleTuckScrap}
                      onUntuckScrap={handleUntuckScrap}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desk Edge Lip */}
        <div className="desk-edge" />

        {/* Drawer Area (Bottom 20%) */}
        <motion.div
          ref={drawerAreaRef}
          className="relative w-full h-[20vh] overflow-hidden z-20"
          style={{ backgroundImage: 'url(/Background.png)', backgroundSize: 'cover', backgroundPosition: 'bottom center' }}
          animate={drawerBounce ? { y: [0, -6, 0] } : {}}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <MaterialDrawer
            materials={drawerMaterials}
            isOpen={view === 'drawer'}
            onToggle={(open) => { setActiveTool(null); if (open) { setSelectedScrapId(null); setView('drawer'); } else { setView('scrapbook'); } }}
            onSelect={noop}
            onDragMaterial={handleDragMaterial}
            onClose={() => setView('scrapbook')}
            onUpload={handleFileUpload}
            onCardDragging={handleCardDragging}
            galleryOpen={galleryOpen}
            onOpenGallery={() => {
              if (fallingOff) return;
              setGalleryOpen(true);
            }}
            onReclassifyToGallery={(id) => handleReclassify(id, 'gallery')}
            galleryRectRef={galleryRectRef}
            onAddEnvelope={handleAddEnvelope}
          />
        </motion.div>
      </motion.div>

      {(view === 'scrapbook' || view === 'drawer') && <WindowLight />}

      {/* Glue animation overlay — rendered outside Konva, fixed over the scrap */}
      {gluingScrapId && glueAnimRect && glueToolRect && (
        <GlueAnimation
          image={currentPage.scraps.find(s => s.id === gluingScrapId)!.image}
          rect={glueAnimRect}
          toolRect={glueToolRect}
          onRubStart={() => setIsGlueBottleAway(true)}
          onReturn={() => setIsGlueBottleAway(false)}
          onPress={handleGluePress}
          onComplete={handleGlueComplete}
        />
      )}

      <Gallery
        materials={galleryMaterials}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onTapMaterial={(m) => setEditingGalleryMaterial(m)}
        onContainerRectChange={(rect) => { galleryRectRef.current = rect; }}
        onCardDragging={handleCardDragging}
        onDragEnd={(m, info, cardRect) => {
          const drawerEl = drawerAreaRef.current;
          if (drawerEl && cardRect) {
            const dr = drawerEl.getBoundingClientRect();
            const cx = cardRect.left + info.offset.x + cardRect.width / 2;
            const cy = cardRect.top + info.offset.y + cardRect.height / 2;
            if (cx > dr.left && cx < dr.right && cy > dr.top && cy < dr.bottom) {
              handleReclassify(m.id, 'drawer');
            }
          }
        }}
      />

      {/* Modals */}
      <AnimatePresence mode="wait">
        {view === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50"
          >
            <CameraView
              onCapture={handleCapture}
              onClose={() => { setActiveTool(null); setView('scrapbook'); }}
            />
          </motion.div>
        )}

        {view === 'cutting' && currentMaterial && (
          <motion.div
            key="cutting"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50"
          >
            <CuttingRoom
              image={currentMaterial.image}
              onCut={handleCut}
              onCancel={() => { setActiveTool(null); setSelectedScrapId(null); setView('drawer'); }}
            />
          </motion.div>
        )}

        {view === 'journal' && (
          <JournalModal
            key="journal"
            onAdd={handleAddJournal}
            onClose={() => { setActiveTool(null); setView('scrapbook'); }}
          />
        )}

        {activeTool === 'text' && (
          <PaperScrapInput
            key="paper-scrap-input"
            onCommit={handleAddText}
            onCancel={() => setActiveTool(null)}
            containerRef={bookPageRef}
          />
        )}

        {scissorTarget && (
          <motion.div
            key="scissors"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50"
          >
            <ScissorsCutView
              image={scissorTarget.image}
              onCut={handleScissorCut}
              onCancel={() => setScissorTarget(null)}
            />
          </motion.div>
        )}

        {tearTarget && (
          <motion.div
            key="tear"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50"
          >
            <TearCutView
              image={tearTarget.image}
              onCut={handleTearCut}
              onCancel={() => setTearTarget(null)}
            />
          </motion.div>
        )}

        {editingGalleryMaterial && (
          <motion.div
            key="gallery-edit"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60]"
          >
            <CuttingRoom
              image={editingGalleryMaterial.image}
              onCut={handleGalleryCut}
              onCancel={() => setEditingGalleryMaterial(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Filter for torn edges */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="torn-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
        </filter>
      </svg>
    </div>
    </div>
  );
}
