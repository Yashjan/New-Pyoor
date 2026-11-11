import type { Material, Mesh, Object3D, Texture } from 'three';

/** Frees every geometry, material and texture under `root`. */
export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(disposeMaterial);
  });
}

export function disposeMaterial(material: Material | undefined): void {
  if (!material) return;
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && (value as Texture).isTexture) {
      (value as Texture).dispose();
    }
  }
  material.dispose();
}
