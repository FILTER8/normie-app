"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GRID = 100;
const MAX_ID = GRID * GRID - 1;

// base palette
const LIGHT_ON = "#48494b";
const LIGHT_OFF = "#e3e5e4";

const BASE_SIZE = 160;
const INTERNAL_SCALE = 10;

type Dir = "left" | "right" | "up" | "down";
type Axis = "x" | "y";
type ScrubZone = "top" | "bottom" | null;

function idToRC(id: number) {
  return { r: Math.floor(id / GRID), c: id % GRID };
}
function rcToId(r: number, c: number) {
  return r * GRID + c;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function randomId() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] % (MAX_ID + 1);
}

async function fetchPixels(id: number): Promise<string> {
  const res = await fetch(`https://api.normies.art/normie/${id}/pixels`, { cache: "no-store" });
  if (!res.ok) throw new Error(`pixels fetch failed: ${res.status}`);
  const raw = await res.text();
  const bits = raw.replace(/[^01]/g, "");
  if (bits.length !== 1600) throw new Error(`Unexpected length: ${bits.length}`);
  return bits;
}

function neighborId(currentId: number, dir: Dir) {
  const { r, c } = idToRC(currentId);
  if (dir === "left") return rcToId(r, clamp(c - 1, 0, GRID - 1));
  if (dir === "right") return rcToId(r, clamp(c + 1, 0, GRID - 1));
  if (dir === "up") return rcToId(clamp(r - 1, 0, GRID - 1), c);
  return rcToId(clamp(r + 1, 0, GRID - 1), c); // down
}

function isEdgeMoveBlocked(currentId: number, dir: Dir) {
  const { r, c } = idToRC(currentId);
  if (dir === "left") return c === 0;
  if (dir === "right") return c === GRID - 1;
  if (dir === "up") return r === 0;
  return r === GRID - 1;
}

function dirFromDrag(dx: number, dy: number): { dir: Dir; axis: Axis } {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dir: dx < 0 ? "right" : "left", axis: "x" };
  } else {
    return { dir: dy < 0 ? "down" : "up", axis: "y" };
  }
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Downscale 40x40 bits into NxN using binning (works for any N).
 */
function downscale40_toN(bits40: string, n: number, thresholdRatio = 0.5): string {
  if (!bits40 || bits40.length !== 1600) return "0".repeat(n * n);
  if (n <= 1) return bits40[0] === "1" ? "1" : "0";
  if (n === 40) return bits40;

  const on = new Uint16Array(n * n);
  const total = new Uint16Array(n * n);

  for (let y = 0; y < 40; y++) {
    const oy = Math.floor((y * n) / 40);
    for (let x = 0; x < 40; x++) {
      const ox = Math.floor((x * n) / 40);
      const j = oy * n + ox;
      total[j] += 1;
      if (bits40[y * 40 + x] === "1") on[j] += 1;
    }
  }

  const out = new Array(n * n).fill("0");
  for (let j = 0; j < out.length; j++) {
    const thresh = Math.max(1, Math.floor(total[j] * thresholdRatio));
    out[j] = on[j] >= thresh ? "1" : "0";
  }
  return out.join("");
}

/**
 * Sample an NxN bitmap back onto a 40x40 grid (works for any N).
 */
function sampleN_to40(bitsN: string, n: number): string {
  if (!bitsN || bitsN.length !== n * n) return "0".repeat(1600);
  if (n === 40) return bitsN;

  const out = new Array(1600).fill("0");
  for (let y = 0; y < 40; y++) {
    const oy = Math.floor((y * n) / 40);
    for (let x = 0; x < 40; x++) {
      const ox = Math.floor((x * n) / 40);
      out[y * 40 + x] = bitsN[oy * n + ox];
    }
  }
  return out.join("");
}

/**
 * Apply scanline glitch on an NxN bitmap (string of length N*N).
 * Horizontal outbreaks: row shifts + segmented row bands + occasional dup/drop.
 */
function glitchN(bitsN: string, n: number, intensity: number, phase: number, seed: number): string {
  if (!bitsN || bitsN.length !== n * n) return bitsN;
  if (intensity <= 0) return bitsN;

  const rand = mulberry32((seed ^ (phase * 2654435761)) >>> 0);
  const out = new Array(n * n).fill("0");

  const rowShiftMax = Math.max(1, Math.round(intensity * Math.max(2, Math.floor(n * 0.22))));
  const rowShiftChance = Math.min(1, 0.18 + intensity * 0.82);
  const segmentChance = Math.min(1, 0.10 + intensity * 0.78);

  const duplicateChance = intensity * 0.09;
  const dropChance = intensity * 0.07;

  for (let y = 0; y < n; y++) {
    if (y > 0) {
      const r = rand();
      if (r < dropChance) continue;
      if (r < dropChance + duplicateChance) {
        for (let x = 0; x < n; x++) out[y * n + x] = bitsN[(y - 1) * n + x];
        continue;
      }
    }

    let baseShift = 0;
    if (rand() < rowShiftChance) {
      baseShift = Math.floor(rand() * (rowShiftMax * 2 + 1)) - rowShiftMax;
    }

    const segmented = rand() < segmentChance;

    if (!segmented) {
      for (let x = 0; x < n; x++) {
        const srcX = clamp(x + baseShift, 0, n - 1);
        out[y * n + x] = bitsN[y * n + srcX];
      }
    } else {
      const segCount = 3 + Math.floor(rand() * 4);
      let x0 = 0;

      for (let s = 0; s < segCount; s++) {
        const remaining = n - x0;
        const minW = Math.max(2, Math.floor(n * 0.10));
        const width =
          s === segCount - 1 ? remaining : Math.max(minW, Math.floor(remaining * (0.20 + rand() * 0.22)));

        const segShift = baseShift + (Math.floor(rand() * (rowShiftMax * 2 + 1)) - rowShiftMax);

        for (let x = x0; x < Math.min(n, x0 + width); x++) {
          const srcX = clamp(x + segShift, 0, n - 1);
          out[y * n + x] = bitsN[y * n + srcX];
        }

        x0 += width;
        if (x0 >= n) break;
      }
    }
  }

  return out.join("");
}

function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  bits40: string,
  canvasPx: number,
  logicalN: number,
  glitchIntensity: number,
  glitchPhase: number,
  seed: number,
  onColor: string,
  offColor: string
) {
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = offColor;
  ctx.fillRect(0, 0, canvasPx, canvasPx);

  const n = clamp(Math.round(logicalN), 1, 40);

  let bitsN = n === 40 ? bits40 : downscale40_toN(bits40, n, 0.5);
  if (glitchIntensity > 0) bitsN = glitchN(bitsN, n, glitchIntensity, glitchPhase, seed);
  const render40 = n === 40 ? bitsN : sampleN_to40(bitsN, n);

  ctx.fillStyle = onColor;
  for (let i = 0; i < 1600; i++) {
    if (render40[i] !== "1") continue;
    const r = Math.floor(i / 40);
    const c = i % 40;
    ctx.fillRect(c * INTERNAL_SCALE, r * INTERNAL_SCALE, INTERNAL_SCALE, INTERNAL_SCALE);
  }
}

function CanvasBitmap({
  bits40,
  size,
  logicalN,
  glitchIntensity,
  glitchPhase,
  seed,
  onColor,
  offColor,
}: {
  bits40: string | null;
  size: number;
  logicalN: number;
  glitchIntensity: number;
  glitchPhase: number;
  seed: number;
  onColor: string;
  offColor: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !bits40) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 40 * INTERNAL_SCALE;
    canvas.width = W;
    canvas.height = W;

    renderToCanvas(ctx, bits40, W, logicalN, glitchIntensity, glitchPhase, seed, onColor, offColor);
  }, [bits40, logicalN, glitchIntensity, glitchPhase, seed, onColor, offColor]);

  return (
    <canvas
      ref={ref}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        imageRendering: "pixelated",
        display: "block",
      }}
      aria-label="Normie pixels"
    />
  );
}

export default function NormieViewer() {
  const stageRef = useRef<HTMLDivElement | null>(null);

  // ✅ no setState-in-effect: initialize once
  const [id, setId] = useState<number>(() => randomId());
  const [currentBits, setCurrentBits] = useState<string | null>(null);

  const [isTokenView, setIsTokenView] = useState(false);

  // Dark mode: swap colors
  const [darkMode, setDarkMode] = useState(false);
  const ON = darkMode ? LIGHT_OFF : LIGHT_ON;
  const OFF = darkMode ? LIGHT_ON : LIGHT_OFF;

  const [stage, setStage] = useState({ w: 390, h: 844 });

  const cacheRef = useRef<Map<number, string>>(new Map());
  const inflightRef = useRef<Map<number, Promise<string>>>(new Map());

  const [peekDir, setPeekDir] = useState<Dir | null>(null);
  const [peekBits, setPeekBits] = useState<string | null>(null);

  // presentation controls
  const [presentDownsample, setPresentDownsample] = useState<number>(40); // 40 = original
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [glitchPhase, setGlitchPhase] = useState(0);

  const TAP_MAX_MS = 280;
  const TAP_MAX_MOVE = 8;

  const interactionRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startT: 0,
    dx: 0,
    dy: 0,
    axis: "x" as Axis,
    dir: "right" as Dir,
    scrubZone: null as ScrubZone,
    phaseAcc: 0,
  });

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [animMode, setAnimMode] = useState<"none" | "snapBack" | "commit">("none");

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReducedMotion(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Measure stage
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setStage({
        w: Math.max(1, Math.round(r.width)),
        h: Math.max(1, Math.round(r.height)),
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function getBitsCached(tokenId: number): Promise<string> {
    const cached = cacheRef.current.get(tokenId);
    if (cached) return cached;

    const inflight = inflightRef.current.get(tokenId);
    if (inflight) return inflight;

    const p = fetchPixels(tokenId)
      .then((bits) => {
        cacheRef.current.set(tokenId, bits);
        inflightRef.current.delete(tokenId);
        return bits;
      })
      .catch((e) => {
        inflightRef.current.delete(tokenId);
        throw e;
      });

    inflightRef.current.set(tokenId, p);
    return p;
  }

  const prefetchNeighbors = useCallback(
    (tokenId: number) => {
      const dirs: Dir[] = ["left", "right", "up", "down"];
      for (const d of dirs) {
        if (isEdgeMoveBlocked(tokenId, d)) continue;
        void getBitsCached(neighborId(tokenId, d));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Load current
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const bits = await getBitsCached(id);
        if (cancelled) return;
        setCurrentBits(bits);
        prefetchNeighbors(id);
      } catch {
        if (!cancelled) setCurrentBits(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, prefetchNeighbors]);

  const tokenSize = useMemo(() => {
    const margin = 56;
    return Math.max(BASE_SIZE, Math.floor(Math.min(stage.w, stage.h) - margin));
  }, [stage.w, stage.h]);

  const displaySize = BASE_SIZE;
  const viewScale = isTokenView ? tokenSize / BASE_SIZE : 1;

  const SLIDE_MS = reducedMotion ? 0 : 520;
  const SNAP_MS = reducedMotion ? 0 : 380;
  const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  const EASE_SNAP = "cubic-bezier(0.2, 0.9, 0.2, 1)";

  const neighborBaseTransform = useMemo(() => {
    if (!peekDir) return { x: 0, y: 0 };
    if (peekDir === "left") return { x: -stage.w, y: 0 };
    if (peekDir === "right") return { x: stage.w, y: 0 };
    if (peekDir === "up") return { x: 0, y: -stage.h };
    return { x: 0, y: stage.h };
  }, [peekDir, stage.w, stage.h]);

  const ensurePeek = useCallback(
    async (dir: Dir) => {
      if (isEdgeMoveBlocked(id, dir)) {
        setPeekDir(null);
        setPeekBits(null);
        return;
      }

      const nid = neighborId(id, dir);
      setPeekDir(dir);

      try {
        const b = await getBitsCached(nid);
        setPeekBits(b);
        prefetchNeighbors(id);
      } catch {
        setPeekBits(null);
      }
    },
    [id, prefetchNeighbors]
  );

  // ✅ reset presentation state on toggle (not in an effect)
  const openPresentation = useCallback(() => {
    setPresentDownsample(40);
    setGlitchIntensity(0);
    setGlitchPhase(0);
    setIsTokenView(true);
  }, []);

  const closePresentation = useCallback(() => {
    setPresentDownsample(40);
    setGlitchIntensity(0);
    setGlitchPhase(0);
    setIsTokenView(false);
  }, []);

  const toggleTokenViewDirect = useCallback(() => {
    if (animMode !== "none") return;
    if (isTokenView) closePresentation();
    else openPresentation();
  }, [animMode, isTokenView, openPresentation, closePresentation]);

  function beginInteraction(pointerId: number, x: number, y: number) {
    interactionRef.current = {
      active: true,
      pointerId,
      startX: x,
      startY: y,
      startT: performance.now(),
      dx: 0,
      dy: 0,
      axis: "x",
      dir: "right",
      scrubZone: null,
      phaseAcc: glitchPhase,
    };

    setAnimMode("none");
    setOffset({ x: 0, y: 0 });
    setPeekDir(null);
    setPeekBits(null);

    if (isTokenView) {
      interactionRef.current.scrubZone = y >= stage.h / 2 ? "bottom" : "top";
    }
  }

  function applyScrub(x: number) {
    const t = clamp(x / Math.max(1, stage.w), 0, 1);
    const zone = interactionRef.current.scrubZone;

    if (zone === "top") {
      const step = Math.round(t * 12); // 0..12
      const n = 20 - step; // 20..8
      setPresentDownsample(n);
    } else if (zone === "bottom") {
      setGlitchIntensity(t);

      const s = interactionRef.current;
      const dx = x - s.startX;
      const bump = Math.floor(Math.abs(dx) / 10);
      setGlitchPhase((s.phaseAcc + bump) | 0);
    }
  }

  function updateSwipe(x: number, y: number) {
    const s = interactionRef.current;

    const dx = x - s.startX;
    const dy = y - s.startY;
    s.dx = dx;
    s.dy = dy;

    const pick = dirFromDrag(dx, dy);
    s.axis = pick.axis;
    s.dir = pick.dir;

    const ox = pick.axis === "x" ? dx : 0;
    const oy = pick.axis === "y" ? dy : 0;

    if (isEdgeMoveBlocked(id, pick.dir)) {
      setOffset({ x: ox * 0.15, y: oy * 0.15 });
      setPeekDir(null);
      setPeekBits(null);
      return;
    }

    setOffset({ x: ox, y: oy });
    void ensurePeek(pick.dir);
  }

  function updateInteraction(x: number, y: number) {
    const s = interactionRef.current;
    if (!s.active) return;

    if (isTokenView) {
      applyScrub(x);
      return;
    }

    updateSwipe(x, y);
  }

  function endInteraction() {
    const s = interactionRef.current;
    if (!s.active) return;
    s.active = false;

    const elapsed = performance.now() - s.startT;
    const movedDist = Math.hypot(s.dx, s.dy);
    const isTap = elapsed <= TAP_MAX_MS && movedDist <= TAP_MAX_MOVE;

    if (isTap) {
      setPeekDir(null);
      setPeekBits(null);
      setOffset({ x: 0, y: 0 });
      toggleTokenViewDirect();
      return;
    }

    if (isTokenView) return;

    const axis = s.axis;
    const primary = axis === "x" ? offset.x : offset.y;
    const threshold = (axis === "x" ? stage.w : stage.h) * 0.22;

    const dir = s.dir;

    if (isEdgeMoveBlocked(id, dir)) {
      setAnimMode("snapBack");
      setOffset({ x: 0, y: 0 });
      setPeekDir(null);
      setPeekBits(null);
      return;
    }

    if (Math.abs(primary) >= threshold && peekBits && peekDir) {
      const to =
        dir === "left"
          ? { x: stage.w, y: 0 }
          : dir === "right"
          ? { x: -stage.w, y: 0 }
          : dir === "up"
          ? { x: 0, y: stage.h }
          : { x: 0, y: -stage.h };

      setAnimMode("commit");
      setOffset(to);
    } else {
      setAnimMode("snapBack");
      setOffset({ x: 0, y: 0 });
    }
  }

  function onCurrentTransitionEnd() {
    if (animMode === "commit" && peekDir && peekBits) {
      const nid = neighborId(id, peekDir);
      setId(nid);
      setCurrentBits(peekBits);

      setAnimMode("none");
      setOffset({ x: 0, y: 0 });
      setPeekDir(null);
      setPeekBits(null);

      prefetchNeighbors(nid);
      return;
    }

    if (animMode === "snapBack") {
      setAnimMode("none");
      setOffset({ x: 0, y: 0 });
      setPeekDir(null);
      setPeekBits(null);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (animMode !== "none") return;
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    beginInteraction(e.pointerId, e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = interactionRef.current;
    if (!s.active) return;
    if (s.pointerId !== e.pointerId) return;
    updateInteraction(e.clientX, e.clientY);
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = interactionRef.current;
    if (!s.active) return;
    if (s.pointerId !== e.pointerId) return;
    endInteraction();
  }
  function onPointerCancel(e: React.PointerEvent) {
    const s = interactionRef.current;
    if (!s.active) return;
    if (s.pointerId !== e.pointerId) return;

    interactionRef.current.active = false;
    setAnimMode("snapBack");
    setOffset({ x: 0, y: 0 });
    setPeekDir(null);
    setPeekBits(null);
  }

  const coord = useMemo(() => {
    const { r, c } = idToRC(id);
    return `${r}/${c}`;
  }, [id]);

  const label = useMemo(() => `#${id}`, [id]);

  const dragAmt = Math.min(1, Math.max(Math.abs(offset.x) / stage.w, Math.abs(offset.y) / stage.h));
  const currentScale = isTokenView ? viewScale : viewScale * (1 - dragAmt * 0.03);
  const currentOpacity = isTokenView ? 1 : 1 - dragAmt * 0.15;
  const neighborScale = 1 + (1 - dragAmt) * 0.01;

  const transition =
    animMode === "commit"
      ? `transform ${SLIDE_MS}ms ${EASE}, opacity ${SLIDE_MS}ms ${EASE}`
      : animMode === "snapBack"
      ? `transform ${SNAP_MS}ms ${EASE_SNAP}, opacity ${SNAP_MS}ms ${EASE_SNAP}`
      : "none";

  const neighborTransition =
    animMode === "commit"
      ? `transform ${SLIDE_MS}ms ${EASE}, opacity ${SLIDE_MS}ms ${EASE}`
      : animMode === "snapBack"
      ? `transform ${SNAP_MS}ms ${EASE_SNAP}, opacity ${SNAP_MS}ms ${EASE_SNAP}`
      : "none";

  const tokenTransition = reducedMotion ? "none" : `transform 640ms ${EASE}, opacity 420ms ${EASE}`;

  // Logical density (glitch size follows this)
  const logicalN = isTokenView ? (presentDownsample === 40 ? 40 : presentDownsample) : 10;

  async function exportPng() {
    const bits = currentBits;
    if (!bits) return;

    const out = document.createElement("canvas");
    const OUT = 1024;
    out.width = OUT;
    out.height = OUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const cell = Math.floor(OUT / 40);
    const drawSize = cell * 40;
    const ox = Math.floor((OUT - drawSize) / 2);
    const oy = Math.floor((OUT - drawSize) / 2);

    ctx.fillStyle = OFF;
    ctx.fillRect(0, 0, OUT, OUT);

    const n = clamp(Math.round(logicalN), 1, 40);
    let bitsN = n === 40 ? bits : downscale40_toN(bits, n, 0.5);
    if (isTokenView && glitchIntensity > 0) {
      bitsN = glitchN(bitsN, n, glitchIntensity, glitchPhase, ((id ?? 0) ^ 0x9e3779b9) >>> 0);
    }
    const render40 = n === 40 ? bitsN : sampleN_to40(bitsN, n);

    ctx.fillStyle = ON;
    for (let i = 0; i < 1600; i++) {
      if (render40[i] !== "1") continue;
      const r = Math.floor(i / 40);
      const c = i % 40;
      ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `normie_${id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, "image/png");
  }

  const seed = ((id ?? 0) ^ 0x9e3779b9) >>> 0;

  const safeTop = "calc(env(safe-area-inset-top, 0px) + 12px)";
  const safeTop2 = "calc(env(safe-area-inset-top, 0px) + 30px)";

  return (
    <div
      ref={stageRef}
      className="relative h-dvh w-dvw overflow-hidden"
      style={{ background: OFF, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Download (top-right) */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void exportPng();
        }}
        aria-label="Download PNG"
        title="Download PNG"
        style={{
          position: "absolute",
          right: 12,
          top: "calc(env(safe-area-inset-top, 0px) + 8px)",
          width: 38,
          height: 38,
          border: "none",
          background: "transparent",
          opacity: 0.55,
          cursor: "pointer",
          zIndex: 5,
          padding: 0,
          touchAction: "none",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v10m0 0l4-4m-4 4l-4-4M5 17v3h14v-3"
            stroke={ON}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dark mode toggle (bottom-right) */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDarkMode((v) => !v);
        }}
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
        style={{
          position: "absolute",
          right: 12,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          width: 38,
          height: 38,
          border: "none",
          background: "transparent",
          opacity: 0.55,
          cursor: "pointer",
          zIndex: 5,
          padding: 0,
          touchAction: "none",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 3a9 9 0 1 0 0 18V3Z" stroke={ON} strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 3v18" stroke={ON} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="absolute inset-0 flex items-center justify-center">
        {/* Neighbor behind (browse mode only) */}
        {!isTokenView && peekDir && peekBits && (
          <div
            style={{
              position: "absolute",
              transform: `translate(${neighborBaseTransform.x + offset.x}px, ${neighborBaseTransform.y + offset.y}px) scale(${neighborScale})`,
              opacity: 0.92,
              transition: neighborTransition,
              willChange: "transform, opacity",
              transformOrigin: "center center",
            }}
          >
            <CanvasBitmap
              bits40={peekBits}
              size={BASE_SIZE}
              logicalN={10}
              glitchIntensity={0}
              glitchPhase={0}
              seed={seed ^ 0x1234}
              onColor={ON}
              offColor={OFF}
            />
          </div>
        )}

        {/* Current */}
        <div
          style={{
            position: "absolute",
            transform: `translate(${isTokenView ? 0 : offset.x}px, ${isTokenView ? 0 : offset.y}px) scale(${currentScale})`,
            opacity: isTokenView ? 1 : currentOpacity,
            transition: isTokenView ? tokenTransition : transition,
            willChange: "transform, opacity",
            transformOrigin: "center center",
          }}
          onTransitionEnd={onCurrentTransitionEnd}
        >
          <CanvasBitmap
            bits40={currentBits}
            size={displaySize}
            logicalN={logicalN}
            glitchIntensity={isTokenView ? glitchIntensity : 0}
            glitchPhase={isTokenView ? glitchPhase : 0}
            seed={seed}
            onColor={ON}
            offColor={OFF}
          />
        </div>
      </div>

      {/* coordinate top-left (safe area aware) */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: safeTop,
          fontSize: 12,
          opacity: 0.35,
          color: ON,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {coord}
      </div>

      {/* second subtle line (density + glitch) */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: safeTop2,
          fontSize: 12,
          opacity: 0.22,
          color: ON,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {isTokenView ? `DS ${logicalN}×${logicalN} · GL ${Math.round(glitchIntensity * 100)}%` : "MAP 10×10"}
      </div>

      {/* id bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 16,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          fontSize: 12,
          opacity: 0.35,
          color: ON,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {label}
      </div>
    </div>
  );
}