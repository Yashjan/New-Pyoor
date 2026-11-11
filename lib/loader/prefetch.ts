/**
 * Downloads a file into the HTTP cache, reporting progress (0–1). Used for the jar GLB during
 * the first-visit intro: the models are served `immutable` with content-hashed URLs, so the 3D
 * scene's own request after the reveal is answered from cache.
 */
export async function prefetchWithProgress(
  url: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { signal });
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    await res.arrayBuffer();
    onProgress(1);
    return;
  }
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    onProgress(loaded / total);
  }
  onProgress(1);
}

/** Resolves once html carries `attr` (at once if there is no first-visit intro). */
function whenFlag(attr: string, signal?: AbortSignal): Promise<void> {
  const html = document.documentElement;
  if (!html.dataset.intro || html.hasAttribute(attr) || html.hasAttribute('data-intro-done'))
    return Promise.resolve();
  return new Promise((resolve) => {
    const mo = new MutationObserver(() => {
      if (html.hasAttribute(attr) || html.hasAttribute('data-intro-done')) {
        mo.disconnect();
        resolve();
      }
    });
    mo.observe(html, { attributes: true, attributeFilter: [attr, 'data-intro-done'] });
    signal?.addEventListener('abort', () => {
      mo.disconnect();
      resolve();
    });
  });
}

/** Resolves once the first-visit intro has finished (at once if there is none). */
export const whenIntroDone = (signal?: AbortSignal) => whenFlag('data-intro-done', signal);

/** Resolves once SAMBHAR has finished engraving (at once if there is no intro). */
export const whenEngraved = (signal?: AbortSignal) => whenFlag('data-engraved', signal);
