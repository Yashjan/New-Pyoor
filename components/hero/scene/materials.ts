import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { JarRig } from './jar';

/**
 * The jar's product-photography materials. The model's positions are quantized
 * (KHR_mesh_quantization: each mesh's node holds a scale and offset), so the procedural
 * details below map the shader's object position back to metres with that node transform.
 */

/** Where the label sits on the jar, in metres (from the Label mesh itself). */
export interface LabelFrame {
  r: number;
  y0: number;
  y1: number;
  /** the angle range it covers (0 = front, +Z; x = r·sin θ, z = r·cos θ) */
  th0: number;
  th1: number;
  /** texture u = a·θ + b; v = 0 at the top edge */
  a: number;
  b: number;
}

export function labelFrame(label: Mesh): LabelFrame {
  const pos = label.geometry.getAttribute('position');
  const uv = label.geometry.getAttribute('uv');
  const v = new Vector3();
  let r = 0;
  let y0 = Infinity;
  let y1 = -Infinity;
  const pts: [number, number][] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(label.matrix);
    r = Math.max(r, Math.hypot(v.x, v.z));
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
    pts.push([Math.atan2(v.x, v.z), uv.getX(i)]);
  }
  // least squares: u = a·θ + b
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p[0], 0);
  const sy = pts.reduce((s, p) => s + p[1], 0);
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
  const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - a * sx) / n;
  const th = pts.map((p) => p[0]);
  return { r, y0, y1, th0: Math.min(...th), th1: Math.max(...th), a, b };
}

/** Object position in metres, as a varying (`vModel`) for the fragment shader. */
function withModelPosition(shader: WebGLProgramParametersWithUniforms, mesh: Mesh) {
  shader.uniforms.uQScale = { value: mesh.scale.clone() };
  shader.uniforms.uQOffset = { value: mesh.position.clone() };
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform vec3 uQScale;\nuniform vec3 uQOffset;\nvarying vec3 vModel;',
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvModel = position * uQScale + uQOffset;',
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vModel;',
  );
}

/** Clear PET (body, neck): no white, a very faint warm attenuation, a light clearcoat. */
export function clearPet(old: Material | undefined, rich: boolean) {
  const m = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    ior: 1.57,
    thickness: 0.0015,
    attenuationColor: new Color('#e2dbcf'),
    attenuationDistance: 0.25,
    specularIntensity: 1,
    clearcoat: rich ? 0.3 : 0,
    clearcoatRoughness: 0.05,
  });
  m.envMapIntensity = 1.15;
  old?.dispose();
  return m;
}

const HASH = `
float pyHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}`;

export interface JarLook {
  /** the satin label: its map is swapped for the 4096 px one once that has loaded */
  label: MeshPhysicalMaterial;
  frame: LabelFrame;
  dispose(): void;
}

/**
 * Upgrades the loaded jar's materials. `rich` (not the weak tier): clearcoats, the cap's
 * knurled grip and the ambient occlusion where the cap meets the neck.
 */
export function dressJar(rig: JarRig, rich: boolean, lidY0: number): JarLook {
  const { meshes } = rig;
  const made: Material[] = [];

  // the clear body: AO just under the cap (the neck in its shadow)
  const body = clearPet(meshes.Body!.material as Material, rich);
  if (rich) {
    const mesh = meshes.Body!;
    body.onBeforeCompile = (shader) => {
      withModelPosition(shader, mesh);
      shader.uniforms.uLid = { value: lidY0 };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uLid;')
        .replace(
          '#include <opaque_fragment>',
          // darkest at the cap's lower edge, gone 8 mm below it (and in the cap's shade above)
          'outgoingLight *= mix(0.66, 1.0, smoothstep(0.0, 1.0, clamp((uLid - vModel.y) / 0.008, 0.0, 1.0)));\n#include <opaque_fragment>',
        );
    };
    body.customProgramCacheKey = () => 'py-body-ao';
  }
  meshes.Body!.material = body;
  meshes.Neck_thread!.material = clearPet(meshes.Neck_thread!.material as Material, rich);
  made.push(body, meshes.Neck_thread!.material as Material);

  // the label: satin printed film
  const old = meshes.Label!.material as MeshStandardMaterial;
  const label = new MeshPhysicalMaterial({
    map: old.map,
    roughness: 0.42,
    metalness: 0,
    clearcoat: rich ? 0.15 : 0,
    clearcoatRoughness: 0.3,
    side: DoubleSide,
  });
  old.dispose();
  meshes.Label!.material = label;
  made.push(label);
  const frame = labelFrame(meshes.Label!);

  // its 0.2 mm lip: a raised edge along the top and the bottom, so it reads as its own layer
  const lipMat = new MeshPhysicalMaterial({
    color: new Color('#20245a'),
    roughness: 0.45,
    clearcoat: rich ? 0.15 : 0,
  });
  made.push(lipMat);
  const span = frame.th1 - frame.th0;
  const lipGeo = new CylinderGeometry(
    frame.r + 0.0002,
    frame.r + 0.0002,
    0.0005,
    160,
    1,
    true,
    frame.th0,
    span,
  );
  for (const y of [frame.y0 + 0.00025, frame.y1 - 0.00025]) {
    const lip = new Mesh(lipGeo, lipMat);
    lip.position.y = y;
    lip.name = 'Label_lip';
    rig.jar.add(lip);
  }

  // the cap: smoky PET as built, with a knurled grip (fine vertical ridges on its side)
  if (rich) {
    const lid = meshes.Lid!;
    const m = lid.material as MeshPhysicalMaterial;
    m.onBeforeCompile = (shader) => {
      withModelPosition(shader, lid);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // 180 fine ridges around, on the side wall only
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float side = 1.0 - smoothstep(0.35, 0.6, abs(dot(normal, upV)));
          float ang = atan(vModel.x, vModel.z);
          float ridge = cos(ang * 180.0);
          vec3 tang = normalize(cross(upV, normal));
          normal = normalize(normal + tang * ridge * 0.09 * side);
        }`,
      );
    };
    m.customProgramCacheKey = () => 'py-lid-knurl';
    m.needsUpdate = true;
  }

  // the salt: a fine sparkle (crystal-scale roughness and normal variation)
  const saltMat = meshes.Salt!.material as MeshStandardMaterial;
  const saltMesh = meshes.Salt!;
  saltMat.onBeforeCompile = (shader) => {
    withModelPosition(shader, saltMesh);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${HASH}`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float pyGlint = pyHash(floor(vModel * 2600.0));
        roughnessFactor *= mix(0.45, 1.0, smoothstep(0.82, 0.97, 1.0 - pyGlint));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(normal + 0.18 * (vec3(pyHash(floor(vModel * 2600.0) + 3.1), pyHash(floor(vModel * 2600.0) + 7.7), 0.5) - 0.5));`,
      );
  };
  saltMat.customProgramCacheKey = () => 'py-salt-sparkle';
  saltMat.needsUpdate = true;

  return {
    label,
    frame,
    dispose() {
      made.forEach((m) => m.dispose());
      lipGeo.dispose();
    },
  };
}

/** Points a label texture at the GPU's best filtering (the model's own is 2400 px). */
export function prepareLabelTexture(tex: Texture, anisotropy: number) {
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
}
