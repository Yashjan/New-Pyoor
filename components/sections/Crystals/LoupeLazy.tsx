'use client';

import { lazyNear } from '@/components/motion/LazyNear';

export const LoupeLazy = lazyNear(() => import('./Loupe').then((m) => m.Loupe));
