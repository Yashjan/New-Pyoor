import type { Group, PerspectiveCamera, Texture } from 'three';
import type { LabelFrame } from '@/components/hero/scene/materials';

/**
 * What the hero's 3D scene hands to the label reader (components/LabelReader): the jar's parts
 * to clone, the camera and the jar's pose at the moment it opens, the label's geometry and its
 * current texture. Null until the hero scene is ready (the reader then shows the flat label).
 */
export interface HeroShare {
  jar: Group;
  lid: Group;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  frame: LabelFrame;
  label: () => Texture | null;
  maxTextureSize: number;
  maxAnisotropy: number;
  weak: boolean;
}

let share: HeroShare | null = null;
export const heroShare = {
  get: () => share,
  set: (s: HeroShare | null) => {
    share = s;
  },
};
