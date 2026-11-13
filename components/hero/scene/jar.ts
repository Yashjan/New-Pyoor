import { Group, Matrix4, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import {
  CAP_C,
  CAP_RISE,
  CAP_TILT,
  CAP_TURNS,
  H,
  R,
  capAwayAt,
  capRest,
  pivotAt,
  tiltAt,
  unscrewAt,
} from '@/lib/motion/pour';
import { jarStartX } from '@/lib/motion/heroCamera';
import { smooth } from './math';
import type { HeroLayout } from './layout';

export { H, R };
/** The cap: these nodes turn and lift together. Neck_thread stays on the jar. */
const LID_PARTS = ['Lid', 'Lid_rim', 'Lid_thread'] as const;

export interface JarRig {
  /** Tilts around the jar's bottom-left edge. */
  pivot: Group;
  /** The jar itself, offset inside the pivot. */
  jar: Group;
  /** Lid + Lid_rim + Lid_thread: its own object in the scene (poseCap sets its matrix). */
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
export function createJarRig(model: Object3D): JarRig {
  const meshes: Record<string, Mesh> = {};
  model.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const mesh = o as Mesh;
      meshes[mesh.name] = mesh;
      mesh.castShadow = false;
    }
  });
  for (const name of ['Body', 'Salt', 'Salt_top', 'Label', ...LID_PARTS, 'Neck_thread']) {
    if (!meshes[name]) throw new Error(`Jar model is missing node "${name}"`);
  }
  // (the materials themselves: materials.ts, dressJar)

  const pivot = new Group();
  const jar = new Group();
  const lid = new Group();
  pivot.add(jar);
  jar.add(model);
  jar.add(lid);
  jar.position.x = R; // the pivot is the base's left edge
  pivot.updateMatrixWorld(true);
  for (const name of LID_PARTS) lid.attach(meshes[name]!);
  // the cap's parts, relative to the jar's frame: the lid group's matrix is set per frame
  jar.remove(lid);
  lid.matrixAutoUpdate = false;

  const saltTop = meshes.Salt_top!;
  return { pivot, jar, lid, saltTop, saltTopY0: saltTop.position.y, meshes };
}

/** The opening's part of the pose (components/opening, lib/motion/opening.ts). */
export interface OpeningJar {
  /** The sunrise, 0–1 (eased): from `riseFrom` metres below to its place. */
  rise: number;
  riseFrom: number;
  /** The glide from the centre to 62% of the width, 0–1 (eased). */
  glide: number;
  /** The hold's slow turn (radians: ±7°, back and forth, while the jar is at rest). */
  turn: number;
}

/** The tilt the jar rises with, straightening as it arrives (2.5°). */
const RISE_TILT = (2.5 * Math.PI) / 180;

/**
 * The jar's pose for progress p (lib/motion/pour.ts). `t` (seconds), the idle turn and the
 * pointer only move it while at rest (p < .14); past that the pose depends on p alone, so
 * scrolling back reverses it exactly. The label faces the camera throughout the pour. At
 * rest the jar floats ±2 mm.
 */
export function poseJar(
  rig: JarRig,
  p: number,
  t: number,
  pointer: { x: number; y: number },
  layout: HeroLayout,
  opening: OpeningJar,
  /** 0–1: the idle float's amplitude (held at 0 while the Journey hands over). */
  float = 1,
): void {
  const [px, py] = pivotAt(p, jarStartX(layout, opening.glide));
  rig.pivot.position.set(px, py, 0);
  rig.pivot.rotation.set(0, 0, tiltAt(p));

  const rest = 1 - smooth(0.02, 0.14, p);
  rig.jar.position.y =
    rest * (0.006 + Math.sin(t * 1.1) * 0.002 * float) - (1 - opening.rise) * opening.riseFrom;
  rig.jar.rotation.z = -(1 - opening.rise) * RISE_TILT;
  rig.jar.rotation.y = rest * (opening.turn + pointer.x * 0.35);
  rig.jar.rotation.x = rest * pointer.y * 0.08;

  // the salt level sinks as it pours
  rig.saltTop.position.y = rig.saltTopY0 - smooth(0.36, 0.84, p) * 0.06;
}

const capCentre = new Vector3();
const restCentre = new Vector3();
const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const jarQ = new Quaternion();
const q0 = new Quaternion();
const q1 = new Quaternion();
const qSpin = new Quaternion();
const qTilt = new Quaternion();
const yAxis = new Vector3(0, 1, 0);
const zAxis = new Vector3(0, 0, 1);
const fromJar = new Matrix4().makeTranslation(0, -CAP_C, 0);
const m4 = new Matrix4();
const one = new Vector3(1, 1, 1);

/**
 * The cap: unscrews on the jar (positive turns about y, up the thread), then lifts ~1.2 jar
 * heights and glides down to rest beside the jar, right and a little behind, leaning 12°. It
 * stays there for the rest of the scene. Call after poseJar (it reads the jar's world matrix).
 */
export function poseCap(rig: JarRig, p: number, layout: HeroLayout, glide: number): void {
  const x0 = jarStartX(layout, glide);
  const u = unscrewAt(p);
  const k = capAwayAt(p);
  const spin = u * CAP_TURNS * 2 * Math.PI;
  rig.pivot.updateMatrixWorld(true);
  rig.jar.getWorldQuaternion(jarQ);
  capCentre.set(0, CAP_C + u * CAP_RISE, 0).applyMatrix4(rig.jar.matrixWorld);
  qSpin.setFromAxisAngle(yAxis, spin);
  q0.copy(jarQ).multiply(qSpin);
  if (k > 0) {
    // off: one arc, up ~1.2 jar heights, across and down to its resting place
    const rest = capRest(x0);
    restCentre.set(rest[0], rest[1], rest[2]);
    a.copy(capCentre).add(c.set(0.012, 1.2 * H, 0));
    b.copy(restCentre).add(c.set(0, 0.09, 0));
    const s = 1 - k;
    capCentre
      .multiplyScalar(s * s * s)
      .add(c.copy(a).multiplyScalar(3 * s * s * k))
      .add(c.copy(b).multiplyScalar(3 * s * k * k))
      .add(c.copy(restCentre).multiplyScalar(k * k * k));
    qTilt.setFromAxisAngle(zAxis, -CAP_TILT);
    q1.copy(qTilt).multiply(qSpin.setFromAxisAngle(yAxis, spin + 0.6));
    q0.slerp(q1, k);
  }
  // the parts sit in the jar's own frame: map its cap centre onto the cap's centre
  m4.compose(capCentre, q0, one).multiply(fromJar);
  rig.lid.matrix.copy(m4);
  rig.lid.matrixWorldNeedsUpdate = true;
}
