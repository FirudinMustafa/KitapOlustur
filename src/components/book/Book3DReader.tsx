"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";

// Faz 5 "3D sayfa çevirme": an open book on a table. Each leaf is a strip
// of segments hinged at the spine; while it turns, the far edge lags the
// near edge (a curl that peaks mid-turn), so it bends like paper instead of
// swinging like a board. Page textures are the typeset PDF pages
// (generated_books.page_render_urls), so this shows exactly the printed
// design. Client-only (WebGL) - load with next/dynamic, ssr: false.

const SEGMENTS = 28;
const TURN_SECONDS = 0.9;
const STACK_GAP = 0.0025;

const loader = typeof window !== "undefined" ? new THREE.TextureLoader() : null;
const cache = new Map<string, THREE.Texture>();

function useTexture(url: string | undefined, mirror: boolean): THREE.Texture | null {
  const key = url ? `${url}|${mirror}` : "";
  const [loaded, setLoaded] = useState<{ key: string; tex: THREE.Texture } | null>(null);
  useEffect(() => {
    if (!url || !loader || cache.has(key)) return;
    let alive = true;
    loader.setCrossOrigin("anonymous");
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      if (mirror) {
        // A back face shows the texture mirrored - flip it back.
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.x = -1;
        t.offset.x = 1;
      }
      cache.set(key, t);
      if (alive) setLoaded({ key, tex: t });
    });
    return () => {
      alive = false;
    };
  }, [url, mirror, key]);
  if (!key) return null;
  return cache.get(key) ?? (loaded?.key === key ? loaded.tex : null);
}

// Positions a leaf of width w / height h whose turn is `t` (0 = lying on
// the right, 1 = lying on the left). Built segment by segment so the paper
// keeps its length while it curls.
function layoutLeaf(geo: THREE.PlaneGeometry, w: number, t: number, lift: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const cols = SEGMENTS + 1;
  const seg = w / SEGMENTS;
  const base = t * Math.PI;
  // The far edge lags the spine by up to ~45° mid-turn, flat at both ends.
  const curl = Math.sin(t * Math.PI) * 0.8;
  const xs: number[] = [0];
  const zs: number[] = [0];
  for (let i = 1; i < cols; i++) {
    const u = (i - 0.5) / SEGMENTS;
    const phi = Math.min(Math.PI, Math.max(0, base - curl * u));
    xs.push(xs[i - 1] + Math.cos(phi) * seg);
    zs.push(zs[i - 1] + Math.sin(phi) * seg);
  }
  for (let r = 0; r < pos.count / cols; r++) {
    for (let i = 0; i < cols; i++) {
      const idx = r * cols + i;
      pos.setX(idx, xs[i]);
      pos.setZ(idx, zs[i] + lift);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function Leaf({
  front,
  back,
  w,
  h,
  target,
  index,
  leafCount,
}: {
  front?: string;
  back?: string;
  w: number;
  h: number;
  target: number;
  index: number;
  leafCount: number;
}) {
  const geo = useMemo(() => new THREE.PlaneGeometry(w, h, SEGMENTS, 1), [w, h]);
  const frontTex = useTexture(front, false);
  const backTex = useTexture(back, true);
  const t = useRef(target);
  const settledAt = useRef(-1);

  useFrame((_, dt) => {
    const step = dt / TURN_SECONDS;
    const prev = t.current;
    if (t.current < target) t.current = Math.min(target, t.current + step);
    else if (t.current > target) t.current = Math.max(target, t.current - step);
    if (prev === t.current && settledAt.current === t.current) return;
    settledAt.current = t.current;
    // Turned leaves stack up on the left, unturned ones on the right, the
    // nearest-to-the-reader on top - small offsets keep them from z-fighting.
    const lift = t.current > 0.5 ? (index + 1) * STACK_GAP : (leafCount - index) * STACK_GAP;
    layoutLeaf(geo, w, t.current, lift);
  });

  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial key={frontTex ? "front-tex" : "front-plain"} map={frontTex ?? undefined} color={frontTex ? "#ffffff" : "#f5f5f4"} side={THREE.FrontSide} roughness={0.85} />
      </mesh>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial key={backTex ? "back-tex" : "back-plain"} map={backTex ?? undefined} color={backTex ? "#ffffff" : "#f5f5f4"} side={THREE.BackSide} roughness={0.85} />
      </mesh>
    </group>
  );
}

export default function Book3DReader({ pages, aspect }: { pages: string[]; aspect: number }) {
  // Leaf i carries pages 2i (front, right-hand) and 2i+1 (back, left-hand
  // once turned). The cover (page 0) starts alone on the right.
  const leafCount = Math.ceil(pages.length / 2);
  const [turned, setTurned] = useState(0);
  const h = 2.2;
  const w = h * aspect;

  const next = useCallback(() => setTurned((n) => Math.min(leafCount, n + 1)), [leafCount]);
  const prev = useCallback(() => setTurned((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Only leaves near the open spread are mounted (textures are the heavy
  // part); the rest of each stack is a plain block for thickness.
  const visible = Array.from({ length: leafCount }, (_, i) => i).filter((i) => i >= turned - 3 && i <= turned + 2);
  const leftPages = Math.min(turned, leafCount);
  const rightPages = leafCount - leftPages;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[16/10] w-full max-w-4xl overflow-hidden rounded-xl bg-gradient-to-b from-stone-200 to-stone-400 dark:from-stone-800 dark:to-stone-950">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, -1.2, 3.6], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
          <ambientLight intensity={0.95} />
          <directionalLight position={[2, -1, 5]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
          <directionalLight position={[-3, 2, 3]} intensity={0.4} />
          {/* page-block thickness under each stack */}
          {leftPages > 1 && (
            <mesh position={[-w / 2, 0, -Math.min(0.08, leftPages * 0.002) / 2 - 0.004]}>
              <boxGeometry args={[w, h, Math.min(0.08, leftPages * 0.002)]} />
              <meshStandardMaterial color="#efe9dc" />
            </mesh>
          )}
          {rightPages > 1 && (
            <mesh position={[w / 2, 0, -Math.min(0.08, rightPages * 0.002) / 2 - 0.004]}>
              <boxGeometry args={[w, h, Math.min(0.08, rightPages * 0.002)]} />
              <meshStandardMaterial color="#efe9dc" />
            </mesh>
          )}
          {visible.map((i) => (
            <Leaf
              key={i}
              index={i}
              leafCount={leafCount}
              front={pages[2 * i]}
              back={pages[2 * i + 1]}
              w={w}
              h={h}
              target={i < turned ? 1 : 0}
            />
          ))}
          <ContactShadows position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]} opacity={0.35} scale={8} blur={2.5} far={1} />
        </Canvas>
        <button aria-label="Önceki sayfa" className="absolute inset-y-0 left-0 w-1/5 cursor-w-resize" onClick={prev} />
        <button aria-label="Sonraki sayfa" className="absolute inset-y-0 right-0 w-1/5 cursor-e-resize" onClick={next} />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={prev} disabled={turned === 0}>
          ← Önceki
        </Button>
        <span className="text-xs text-muted-foreground">
          {turned === 0 ? "Kapak" : `Sayfa ${2 * turned - 1}–${Math.min(pages.length, 2 * turned)}`} / {pages.length}
        </span>
        <Button variant="outline" size="sm" onClick={next} disabled={turned >= leafCount}>
          Sonraki →
        </Button>
      </div>
    </div>
  );
}
