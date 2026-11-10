import { chromium } from 'playwright-core';
for (const args of [['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'], ['--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu', '--ignore-gpu-blocklist'], ['--use-gl=egl', '--enable-gpu', '--ignore-gpu-blocklist']]) {
  try {
    const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args });
    const p = await b.newPage();
    const r = await p.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'no webgl'; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'webgl, renderer hidden'; });
    console.log(args.join(' '), '→', r); await b.close();
  } catch (e) { console.log(args.join(' '), '→ error', e.message.split('\n')[0]); }
}
