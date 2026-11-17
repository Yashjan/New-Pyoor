import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Plane,
  Quaternion,
  Vector3,
  Euler,
  type Material,
  type Texture,
} from 'three';
import { INNER, POUR, R } from '@/lib/motion/pour';
import { SLOPE, flowAt, tableAt, type PourResult } from '@/lib/motion/pourSim';
import type { JarRig } from './jar';
import { createRng } from './math';

/**
 * The salt inside the jar (replacing the model's static fill): its free surface stays level in
 * the WORLD as the jar tilts (the volume below a world plane: clipping), sloping at the angle
 * of repose towards the mouth while it runs out, and its level drops by exactly what has
 * poured (the simulation's table). The surface itself is a crystal-textured cap clipped to the
 * jar's inside in its shader, glittering in the warm light.
 * The dive (shot 5): a field of individual crystals on what is left, sharp and lit like a
 * landscape when the camera comes down onto it.
 */
const HASH = `
float pyHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}`;

export interface SaltBody {
  /** Sets the surface for film progress f (call after the jar is posed). */
  update(f: number): void;
  dispose(): void;
}

export function createSaltBody(
  rig: JarRig,
  sim: PourResult,
  rich: boolean,
  crystals: number,
): SaltBody {
  const salt = rig.meshes.Salt!;
  const src = salt.material as MeshStandardMaterial;
  // the model's fill is replaced (its shape can't follow the salt as the jar tilts)
  const topWas = rig.saltTop.visible;
  const map: Texture | null = src.map;
  const made: Material[] = [];

  // the world plane the salt lies below
  const plane = new Plane(new Vector3(0, -1, 0), 0);
  const wallMat = src.clone();
  wallMat.clippingPlanes = [plane];
  wallMat.side = DoubleSide;
  made.push(wallMat);
  const wallH = INNER.rim - INNER.floor;
  const wall = new Mesh(new CylinderGeometry(INNER.r, INNER.r, wallH, 72, 1, false), wallMat);
  wall.position.y = INNER.floor + wallH / 2;
  wall.name = 'Salt_body';
  rig.jar.add(wall);

  // the surface: a disc on the plane, cut to the jar's inside in the fragment shader
  const capMat = new MeshStandardMaterial({
    map,
    color: src.color.clone(),
    roughness: 0.7,
    metalness: 0,
    side: DoubleSide,
  });
  if (map) {
    capMat.map = map.clone();
    capMat.map.repeat.set(6, 6);
    capMat.map.needsUpdate = true;
  }
  const toJar = { value: new Matrix4() };
  capMat.onBeforeCompile = (shader) => {
    shader.uniforms.uToJar = toJar;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    let fs = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform mat4 uToJar;\nvarying vec3 vWorldP;${HASH}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        {
          vec3 j = (uToJar * vec4(vWorldP, 1.0)).xyz;
          if (length(j.xz) > ${INNER.r.toFixed(4)} || j.y < ${INNER.floor.toFixed(4)} || j.y > ${INNER.rim.toFixed(4)}) discard;
        }`,
      );
    // a glitter of crystal faces: a few cells much smoother than the rest
    if (rich)
      fs = fs.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float pyG = pyHash(floor(vWorldP * 2400.0));
        roughnessFactor *= mix(0.25, 1.0, smoothstep(0.88, 0.985, 1.0 - pyG));`,
      );
    shader.fragmentShader = fs;
  };
  capMat.customProgramCacheKey = () => `py-salt-cap-${rich}`;
  made.push(capMat);
  const cap = new Mesh(new CircleGeometry(0.16, 48), capMat);
  cap.name = 'Salt_surface';
  cap.renderOrder = 1;
  // in the scene (it's posed in world space), not in the jar
  rig.pivot.parent?.add(cap);

  // the dive's crystals: on the salt left after the pour, densest where the camera lands
  const { rnd, gauss } = createRng(97);
  const geos = [new OctahedronGeometry(1, 0), new IcosahedronGeometry(1, 0)];
  const cMat = new MeshStandardMaterial({
    color: src.color.clone().multiplyScalar(1.05),
    roughness: 0.18,
    metalness: 0,
    flatShading: true,
  });
  made.push(cMat);
  const field = geos.map((g) => new InstancedMesh(g, cMat, Math.max(1, Math.floor(crystals / 2))));
  const m4 = new Matrix4();
  const q = new Quaternion();
  const e3 = new Euler();
  const p3 = new Vector3();
  const s3 = new Vector3();
  const lvl = sim.levelEnd;
  const tint = new Color();
  for (const mesh of field) {
    for (let i = 0; i < mesh.count; i++) {
      // the dive's target, near the axis: a few mm off it, most crystals near it
      const near = rnd() < 0.7;
      const rr = near ? Math.abs(gauss()) * 0.007 : Math.sqrt(rnd()) * (INNER.r - 0.002);
      const a = rnd() * Math.PI * 2;
      const size = (near ? 0.00028 : 0.00045) * (0.6 + rnd() * 1.2);
      p3.set(-0.004 + Math.cos(a) * rr, lvl + size * 0.3, 0.004 + Math.sin(a) * rr);
      if (Math.hypot(p3.x, p3.z) > INNER.r - 0.001) p3.multiplyScalar(0.9);
      e3.set(rnd() * 6, rnd() * 6, rnd() * 6);
      q.setFromEuler(e3);
      m4.compose(p3, q, s3.set(size, size * (0.6 + rnd() * 0.5), size));
      mesh.setMatrixAt(i, m4);
      tint.set(rnd() < 0.15 ? '#80524a' : '#6a5649').multiplyScalar(0.7 + rnd() * 0.6);
      if (rnd() < 0.04) tint.set('#efe2c8');
      mesh.setColorAt(i, tint);
    }
    mesh.visible = false;
    mesh.frustumCulled = false;
    rig.jar.add(mesh);
  }

  const n = new Vector3();
  const base = new Vector3();
  const axis = new Vector3();
  const qq = new Quaternion();
  const up = new Vector3(0, 0, 1);
  const inv = new Matrix4();
  return {
    update(f) {
      rig.jar.updateMatrixWorld(true);
      // the pivot (the base's left edge, x = −R in the jar's frame) in the world
      base.set(-R, 0, 0).applyMatrix4(rig.jar.matrixWorld);
      const L = base.y + tableAt(sim.table, sim.table.level, f);
      // while it runs out, the surface slopes down to the mouth (the jar tips left: −x)
      const k = Math.min(1, flowAt(sim, f) * 3);
      const t = Math.tan(SLOPE * k);
      // the jar's axis at that height: where the slope pivots
      axis.set(0, 0, 0).applyMatrix4(rig.jar.matrixWorld);
      const xc = axis.x;
      // keep y ≤ L + (x − xc)·t  →  n·p + c ≥ 0 with n = (t, −1, 0)
      n.set(t, -1, 0);
      const len = n.length();
      plane.normal.copy(n).divideScalar(len);
      plane.constant = (L - xc * t) / len;
      // the cap: on the plane, at the axis, facing up
      cap.position.set(xc, L, 0);
      qq.setFromUnitVectors(up, n.set(-t, 1, 0).normalize());
      cap.quaternion.copy(qq);
      inv.copy(rig.jar.matrixWorld).invert();
      toJar.value.copy(inv);
      // until the jar tips, the model's own fill (its real black-salt look) stays
      const own = f >= POUR.start;
      salt.visible = !own;
      rig.saltTop.visible = !own && topWas;
      wall.visible = own;
      cap.visible = own;
      const dive = f > 0.83;
      for (const m of field) m.visible = dive;
    },
    dispose() {
      wall.geometry.dispose();
      cap.geometry.dispose();
      cap.parent?.remove(cap);
      geos.forEach((g) => g.dispose());
      made.forEach((m) => m.dispose());
      capMat.map?.dispose();
    },
  };
}
