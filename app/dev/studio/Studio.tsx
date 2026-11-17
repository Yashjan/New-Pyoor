'use client';

import { useEffect, useRef } from 'react';
import { PerspectiveCamera, WebGLRenderer } from 'three';
import {
  loadPlateModel,
  plateCamera,
  studioScene,
  type Format,
  type PlateModel,
} from '@/components/sections/Products/plateScene';
import { modelUrl } from '@/lib/three/models';
import { FOV } from '@/lib/motion/heroCamera';

/** A shot: the models (left to right), the frame in px, the turn (degrees) of every model. */
interface Shot {
  items: { format: Format; file: string; open?: boolean }[];
  width: number;
  height: number;
  yaw: number;
}

declare global {
  interface Window {
    __studio?: (shot: Shot) => Promise<string>;
  }
}

/**
 * The products section's studio (components/sections/Products/plateScene.ts: the hero's
 * environment, lights and materials), with a transparent background. One model: exactly the
 * live plate's framing. Two: the pair, side by side. Renders a shot to a PNG data URL.
 */
export function Studio() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    const studio = studioScene(renderer);
    const camera = new PerspectiveCamera(FOV, 1, 0.01, 10);
    const models = new Map<string, Promise<PlateModel>>();
    const model = (format: Format, file: string) => {
      if (!models.has(file)) models.set(file, loadPlateModel(format, modelUrl(file)));
      return models.get(file)!;
    };

    window.__studio = async ({ items, width, height, yaw }) => {
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      const all = await Promise.all(items.map((i) => model(i.format, i.file)));
      for (const m of models.values()) studio.scene.remove((await m).root);
      const gap = 0.15; // the pair: centre to centre
      all.forEach((m, i) => {
        m.root.position.x = (i - (all.length - 1) / 2) * gap;
        m.pose(
          (yaw * Math.PI) / 180 + (all.length > 1 ? (i ? -0.12 : 0.12) : 0),
          0,
          items[i]!.open,
        );
        studio.scene.add(m.root);
      });
      const open = items.some((i) => i.open);
      if (all.length === 1 && !open) plateCamera(camera, all[0]!);
      else {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        // the pair, or the open jar with its cap beside it (both a little to the right)
        if (open) all[0]!.root.position.x = -0.05;
        const wide = open ? 0.32 : (all.length - 1) * gap + 0.2;
        const span = Math.max(0.122 / 0.78, wide / camera.aspect);
        const d = span / 2 / Math.tan((FOV * Math.PI) / 360);
        camera.position.set(0, 0.061 + d * 0.12, d);
        camera.lookAt(0, 0.059, 0);
      }
      renderer.render(studio.scene, camera);
      return canvas.toDataURL('image/png');
    };
    document.documentElement.dataset.studio = 'ready';
    return () => {
      delete window.__studio;
      studio.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas ref={ref} style={{ position: 'fixed', left: 0, top: 0, width: 300, height: 400 }} />
  );
}
