import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  type PMREMGenerator,
  type WebGLRenderTarget,
} from 'three';

/**
 * A product-photography studio as an environment map (reflections and transmission only; the
 * page stays the background): a dim warm room, one large softbox key from the upper left and
 * front, two tall narrow strip lights left and right a little behind the jar (the two clean
 * vertical highlights down the body, the bright rim on the cap and shoulder) and a soft top
 * light. Units: metres around the jar at the origin.
 */
export function studioEnvironment(pmrem: PMREMGenerator): WebGLRenderTarget {
  const scene = new Scene();
  const geo = new PlaneGeometry(1, 1);
  const room = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: new Color('#b9b0a2').multiplyScalar(0.5), side: BackSide }),
  );
  room.scale.set(14, 9, 14);
  room.position.y = 3;
  scene.add(room);
  // a warm floor bounce, so the jar's lower half doesn't reflect a black void
  const floor = new Mesh(
    geo,
    new MeshBasicMaterial({ color: new Color('#efe6d6').multiplyScalar(0.9), side: DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  floor.scale.set(12, 12, 1);
  scene.add(floor);

  const light = (
    w: number,
    h: number,
    intensity: number,
    [x, y, z]: [number, number, number],
    tint = '#fff6ea',
  ) => {
    const m = new Mesh(
      geo,
      new MeshBasicMaterial({
        color: new Color(tint).multiplyScalar(intensity),
        side: DoubleSide,
      }),
    );
    m.scale.set(w, h, 1);
    m.position.set(x, y, z);
    m.lookAt(0, 0.6 * y, 0);
    scene.add(m);
  };
  light(3.4, 3.4, 5.5, [-3.4, 3.2, 3]); // the key softbox, upper left
  light(0.45, 5.6, 14, [-3.6, 1.2, -1.1]); // strip, left, a little behind
  light(0.45, 5.6, 14, [3.6, 1.2, -1.1], '#fff2e2'); // strip, right, a little behind
  light(3.2, 3.2, 2.6, [0, 5.5, 0.4]); // soft top light

  const rt = pmrem.fromScene(scene, 0.03);
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    (mesh.material as MeshBasicMaterial).dispose();
  });
  geo.dispose();
  room.geometry.dispose();
  return rt;
}
