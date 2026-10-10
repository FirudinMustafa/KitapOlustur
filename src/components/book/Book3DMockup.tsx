"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import type { CoverMockup } from "@/db/schema";

// Faz 5 "3D kitap mockup'ı": the real cover wrap (back + spine + front, as
// printed) wrapped around a box as thick as the book really is, lit like a
// product shot. Draggable, with preset angles and a PNG download for
// marketing. Client-only (WebGL) - load with next/dynamic, ssr: false.

export type MockupBook = { label: string; mockup: CoverMockup };

const PT_PER_UNIT = 100; // 1 three.js unit = 100 pt

type View = "front" | "angle" | "set";

function regionTexture(base: THREE.Texture, x: number, y: number, w: number, h: number, W: number, H: number): THREE.Texture {
  const t = base.clone();
  t.needsUpdate = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(w / W, h / H);
  // Texture v runs bottom-up; region y is measured top-down.
  t.offset.set(x / W, 1 - (y + h) / H);
  return t;
}

function pageEdgeTexture(horizontal: boolean): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(120,110,90,0.18)";
  for (let i = 0; i < 256; i += 3) {
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
    } else {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function useCoverTexture(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(url, (t) => {
      if (!alive) return;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return tex;
}

function BookMesh({ mockup, position, rotationY }: { mockup: CoverMockup; position: [number, number, number]; rotationY: number }) {
  const tex = useCoverTexture(mockup.imageUrl);
  const w = mockup.trimWidthPt / PT_PER_UNIT;
  const h = mockup.trimHeightPt / PT_PER_UNIT;
  const d = Math.max(mockup.spinePt, 3) / PT_PER_UNIT;

  const materials = useMemo(() => {
    const edgeV = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(false), roughness: 0.9 });
    const edgeH = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(true), roughness: 0.9 });
    if (!tex) {
      const plain = new THREE.MeshStandardMaterial({ color: "#cbd5e1" });
      return [edgeV, plain, edgeH, edgeH, plain, plain];
    }
    const img = tex.image as { width: number; height: number };
    const W = img.width;
    const H = img.height;
    const s = W / (2 * mockup.trimWidthPt + mockup.spinePt + 2 * mockup.bleedPt); // px per pt
    const b = mockup.bleedPt * s;
    const tw = mockup.trimWidthPt * s;
    const th = mockup.trimHeightPt * s;
    const sp = mockup.spinePt * s;
    const mat = (t: THREE.Texture) => new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.35 });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    return [
      edgeV, // fore-edge (right)
      mat(regionTexture(tex, b + tw, b, sp, th, W, H)), // spine (left)
      edgeH, // head
      edgeH, // tail
      mat(regionTexture(tex, b + tw + sp, b, tw, th, W, H)), // front
      mat(regionTexture(tex, b, b, tw, th, W, H)), // back
    ];
  }, [tex, mockup]);

  return (
    <mesh position={position} rotation={[0, rotationY, 0]} castShadow material={materials}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

function Scene({ books, view, autoRotate }: { books: MockupBook[]; view: View; autoRotate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const shown = view === "set" ? books : books.slice(0, 1);
  const target = view === "front" ? 0 : view === "angle" ? 0.55 : 0.3;
  useFrame((_, dt) => {
    if (!group.current) return;
    if (autoRotate) group.current.rotation.y += dt * 0.3;
    else group.current.rotation.y += (target - group.current.rotation.y) * Math.min(1, dt * 4);
  });
  const spacing = (books[0]?.mockup.trimWidthPt ?? 595) / PT_PER_UNIT * 0.62;
  const h = (books[0]?.mockup.trimHeightPt ?? 842) / PT_PER_UNIT;
  return (
    <group ref={group}>
      {shown.map((b, i) => {
        const offset = (i - (shown.length - 1) / 2) * spacing;
        return <BookMesh key={b.label} mockup={b.mockup} position={[offset, 0, -Math.abs(offset) * 0.35]} rotationY={view === "set" ? -offset * 0.12 : 0} />;
      })}
      <ContactShadows position={[0, -h / 2 - 0.01, 0]} opacity={0.45} scale={20} blur={2.4} far={6} />
    </group>
  );
}

function Snapshot({ register }: { register: (fn: () => string) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    register(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
  }, [gl, scene, camera, register]);
  return null;
}

export default function Book3DMockup({ books, fileName = "kitap-mockup" }: { books: MockupBook[]; fileName?: string }) {
  const [view, setView] = useState<View>("angle");
  const [autoRotate, setAutoRotate] = useState(false);
  const snap = useRef<(() => string) | null>(null);
  const h = (books[0]?.mockup.trimHeightPt ?? 842) / PT_PER_UNIT;

  function download() {
    const url = snap.current?.();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}-${view}.png`;
    a.click();
  }

  if (!books.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-800 dark:to-slate-950">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, h * 0.15, h * 2.3], fov: 35 }}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 6]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-6, 2, -3]} intensity={0.5} />
          <spotLight position={[0, 8, 4]} angle={0.4} penumbra={0.8} intensity={0.8} />
          <Suspense fallback={null}>
            <Scene books={books} view={view} autoRotate={autoRotate} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={h * 0.8} maxDistance={h * 3} />
          <Snapshot register={(fn) => (snap.current = fn)} />
        </Canvas>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>
          Ön
        </Button>
        <Button size="sm" variant={view === "angle" ? "default" : "outline"} onClick={() => setView("angle")}>
          3/4 açı
        </Button>
        {books.length > 1 && (
          <Button size="sm" variant={view === "set" ? "default" : "outline"} onClick={() => setView("set")}>
            Set ({books.length} kitap)
          </Button>
        )}
        <Button size="sm" variant={autoRotate ? "default" : "outline"} onClick={() => setAutoRotate((v) => !v)}>
          Döndür
        </Button>
        <Button size="sm" variant="outline" onClick={download} className="ml-auto">
          PNG indir
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Sürükleyerek çevir, tekerlekle yakınlaş. Sırt kalınlığı gerçek sayfa sayısından hesaplandı.</p>
    </div>
  );
}
