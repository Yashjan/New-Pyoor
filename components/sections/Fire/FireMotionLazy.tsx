'use client';

import { lazyNear } from '@/components/motion/LazyNear';

export const FireMotionLazy = lazyNear(() => import('./FireMotion').then((m) => m.FireMotion));
