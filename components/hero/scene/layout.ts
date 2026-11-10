/** Where the jar sits and how far the camera pulls back, by viewport shape. */
export interface HeroLayout {
  /** Jar x offset in metres: right of the headline on desktop, centred on phones. */
  jx: number;
  /** Camera distance multiplier (> 1 pulls back on portrait screens). */
  camZ: number;
  portrait: boolean;
}

export function layoutFor(width: number, height: number): HeroLayout {
  const portrait = width / height < 0.9;
  return { portrait, jx: portrait ? 0 : 0.13, camZ: portrait ? 1.75 : 1 };
}
