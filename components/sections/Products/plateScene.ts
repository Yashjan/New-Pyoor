import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { createJarRig, poseCap } from '@/components/hero/scene/jar';
import { dressJar } from '@/components/hero/scene/materials';
import { studioEnvironment } from '@/components/hero/scene/studio';
import { createContact } from '@/components/hero/scene/ground';
import { loadJarModel } from '@/lib/three/loaders';
import { disposeObject } from '@/lib/three/dispose';
import { FOV } from '@/lib/motion/heroCamera';
import { R } from '@/lib/motion/pour';

/**
 * A product plate's 3D scene (the products section): the hero's studio (environment, lights,
 * ACES tone mapping), one jar or pouch standing on the ground line, a soft contact shadow.
 * Shared by the live plates (ProductStage) and the studio stills (app/dev/studio), so a
 * poster and its live model are framed identically.
 */
export type Format = 'jar' | 'pouch';

/** The plate's frame: 3:4, the ground (the gold line) at 86% of the height. */
export const PLATE = { aspect: 3 / 4, line: 0.86, fill: 0.7, fillW: 0.66 } as const;

/**
 * The camera for a model: level, the model at most `fill` of the height and `fillW` of the
 * width, its base on the ground line.
 */
export function plateCamera(camera: PerspectiveCamera, m: { height: number; width: number }) {
  const viewH = Math.max(m.height / PLATE.fill, m.width / (PLATE.fillW * PLATE.aspect));
  const d = viewH / 2 / Math.tan((FOV * Math.PI) / 360);
  const yc = (2 * PLATE.line - 1) * (viewH / 2); // the ground at PLATE.line of the height
  camera.fov = FOV;
  camera.aspect = PLATE.aspect;
  camera.position.set(0, yc, d);
  camera.lookAt(0, yc, 0);
  camera.updateProjectionMatrix();
}

export function studioScene(renderer: WebGLRenderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;
  const pmrem = new PMREMGenerator(renderer);
  const env = studioEnvironment(pmrem);
  const scene = new Scene();
  scene.environment = env.texture;
  const key = new DirectionalLight(0xfff0dc, 2.4);
  key.position.set(0.6, 1.2, 0.8);
  const rim = new DirectionalLight(0xe9c98a, 1.2);
  rim.position.set(-0.8, 0.5, -0.6);
  scene.add(key, rim, new HemisphereLight(0xffffff, 0xe8dfcd, 0.35));
  return {
    scene,
    dispose() {
      disposeObject(scene);
      env.dispose();
      pmrem.dispose();
    },
  };
}

export interface PlateModel {
  root: Object3D;
  /** metres */
  height: number;
  width: number;
  /** turn (y) and tilt (x), radians, about its own upright axis */
  pose(yaw: number, tilt: number): void;
}

/** Loads a jar (the hero's rig and materials) or a pouch (as built), on y = 0. */
export async function loadPlateModel(
  format: Format,
  url: string,
  signal?: AbortSignal,
): Promise<PlateModel> {
  const gltf = await loadJarModel(url, signal);
  const root = new Group();
  const shadow = createContact();
  root.add(shadow.group);
  if (format === 'jar') {
    const rig = createJarRig(gltf.scene);
    dressJar(rig, true, new Box3().setFromObject(rig.lid).min.y);
    rig.pivot.position.x = -R; // the jar's axis on x = 0
    root.add(rig.pivot, rig.lid);
    shadow.group.scale.set(0.55, 1, 0.8);
    const layout = { portrait: false, jx: 0 };
    const pose = (yaw: number, tilt: number) => {
      rig.jar.rotation.set(tilt, yaw, 0);
      rig.pivot.updateMatrixWorld(true);
      poseCap(rig, 0, layout, 1);
    };
    pose(0, 0);
    return { root, height: 0.122, width: 0.104, pose };
  }
  const spin = new Group();
  spin.add(gltf.scene);
  root.add(spin);
  shadow.group.scale.set(1.15, 1, 0.75);
  return {
    root,
    height: 0.305,
    width: 0.23,
    pose: (yaw, tilt) => spin.rotation.set(tilt, yaw, 0),
  };
}
