import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Loads a compressed jar model (EXT_meshopt_compression + KHR_mesh_quantization, WebP
 * textures). Note: quantization gives every node a base translation and scale, so animate
 * relative to those values rather than overwriting them.
 */
export function loadJarModel(url: string, signal?: AbortSignal): Promise<GLTF> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    loader.load(url, resolve, undefined, reject);
  });
}
