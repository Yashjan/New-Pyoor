import { Group, Vector3, type Mesh, type Object3D } from 'three';
import { ease, smooth } from './math';
import type { HeroLayout } from './layout';

/** Jar dimensions in metres (12.2 cm tall, 10 cm across). */
export const R = 0.05;
export const H = 0.122;
/** ~113°: how far the jar tips to pour. */
export const TILT = 1.98;
/** The pivot sits on the left edge of the base, so the jar tips around it. */
const PIVOT_DX = -R;
/** Lowest point of the lip when fully tilted, in jar space. */
const MOUTH_LOCAL = new Vector3(-R + 0.004, H - 0.016, 0);

export interface JarRig {
  /** Tilts around the jar's bottom-left edge. */
  pivot: Group;
  /** The jar itself, offset inside the pivot. */
  jar: Group;
  /** Lid + Lid_rim, animated together. */
  lid: Group;
  saltTop: Object3D;
  /** Salt_top's loaded y (meshopt quantization gives every node a base transform). */
  saltTopY0: number;
  meshes: Record<string, Mesh>;
}

/**
 * Builds the rig around the loaded model. `attach()` keeps each node's world transform, so
 * the quantized base transforms stay intact and all motion below is relative to them.
 */
export function createJarRig(model: Object3D, castShadows: boolean): JarRig {
  const meshes: Record<string, Mesh> = {};
  model.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const mesh = o as Mesh;
      meshes[mesh.name] = mesh;
      // Clear PET doesn't cast a hard shadow.
      mesh.castShadow = castShadows && !['Body', 'Lid'].includes(mesh.name);
    }
  });
  for (const name of ['Body', 'Salt', 'Salt_top', 'Label', 'Lid', 'Lid_rim']) {
    if (!meshes[name]) throw new Error(`Jar model is missing node "${name}"`);
  }

  const pivot = new Group();
  const jar = new Group();
  const lid = new Group();
  pivot.add(jar);
  jar.add(model);
  jar.add(lid);
  jar.position.x = -PIVOT_DX;
  pivot.updateMatrixWorld(true);
  lid.attach(meshes.Lid!);
  lid.attach(meshes.Lid_rim!);

  const saltTop = meshes.Salt_top!;
  return { pivot, jar, lid, saltTop, saltTopY0: saltTop.position.y, meshes };
}

/** Pivot pose for progress p (the tilt). Pure function of p and layout. */
export function setJar(rig: JarRig, p: number, layout: HeroLayout): void {
  const et = ease(smooth(0.24, 0.42, p));
  const x0 = layout.jx + PIVOT_DX;
  rig.pivot.position.set(x0 + (0.12 - x0) * et, 0.12 * et, 0);
  rig.pivot.rotation.set(0, 0, TILT * et);
}

/** World position of the mouth when fully tilted: where the grains leave the jar. */
export function mouthAt(rig: JarRig, layout: HeroLayout): Vector3 {
  setJar(rig, 1, layout);
  rig.pivot.updateMatrixWorld(true);
  return rig.jar.localToWorld(MOUTH_LOCAL.clone());
}

/**
 * Full jar pose for progress p.
 * `t` (seconds) and the pointer only add the idle float and parallax while the jar is at rest
 * (p < .14); past that the pose depends on p alone, so scrolling back reverses it exactly.
 */
export function poseJar(
  rig: JarRig,
  p: number,
  t: number,
  pointer: { x: number; y: number },
  layout: HeroLayout,
): void {
  setJar(rig, p, layout);

  // Idle float and slow turn before the cap opens.
  const rest = 1 - smooth(0.02, 0.14, p);
  rig.jar.position.y = rest * (0.006 + Math.sin(t * 1.1) * 0.004);
  rig.jar.rotation.y = rest * (Math.sin(t * 0.35) * 0.22 + pointer.x * 0.35);
  rig.jar.rotation.x = rest * pointer.y * 0.08;

  // Cap: unscrew 1.5 turns while rising, then lift away up and to the right.
  // On phones the flight is shorter so the lid stays in frame as it lifts (HANDOFF to-do).
  const unscrew = smooth(0.05, 0.15, p);
  const away = smooth(0.15, 0.24, p);
  const fly = layout.portrait ? { x: 0.12, y: 0.2, z: 0.05 } : { x: 0.28, y: 0.42, z: 0.08 };
  rig.lid.rotation.set(0, -unscrew * Math.PI * 3, -away * 1.1);
  rig.lid.position.set(away * away * fly.x, unscrew * 0.012 + away * fly.y, away * fly.z);
  rig.lid.visible = away < 0.995;

  // The salt level sinks as it pours.
  rig.saltTop.position.y = rig.saltTopY0 - smooth(0.45, 0.72, p) * 0.05;

  // Salt flats: the jar rises out of view.
  const exit = smooth(0.74, 0.86, p);
  rig.pivot.position.y += exit * 0.6;
  rig.pivot.position.x += exit * 0.25;
  rig.pivot.visible = exit < 0.995;
}
