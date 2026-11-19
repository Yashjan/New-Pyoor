'use client';

import { lazyNear } from '@/components/motion/LazyNear';

export const RootsMotionLazy = lazyNear(() => import('./RootsMotion').then((m) => m.RootsMotion));
