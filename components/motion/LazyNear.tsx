'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

/**
 * A section's motion code, fetched and mounted only as the section approaches (within `margin`
 * of the viewport), so the first load carries none of it. It renders nothing until then: the
 * section is laid out by its server-rendered HTML and CSS alone (nothing shifts when it mounts).
 */
export function lazyNear(load: () => Promise<ComponentType>, margin = '300% 0px') {
  return function LazyNear() {
    const ref = useRef<HTMLSpanElement>(null);
    const [Comp, setComp] = useState<ComponentType | null>(null);
    useEffect(() => {
      const section = ref.current?.parentElement;
      if (!section) return;
      let live = true;
      const io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          io.disconnect();
          void load().then((C) => live && setComp(() => C));
        },
        { rootMargin: margin },
      );
      io.observe(section);
      return () => {
        live = false;
        io.disconnect();
      };
    }, []);
    return Comp ? <Comp /> : <span ref={ref} hidden />;
  };
}
