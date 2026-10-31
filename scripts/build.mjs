import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

export async function buildElectron() {
  const shared = {
    outdir: 'dist',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    sourcemap: true,
  };
  await build({
    ...shared,
    entryPoints: { 'main/index': 'src/main/index.ts' },
    external: [
      'electron',
      'electron-store',
      '@ghostery/adblocker-electron',
      'tldts',
      // Both locate their page preloads inside node_modules at runtime.
      'electron-chrome-extensions',
      'electron-chrome-web-store',
    ],
  });
  // Sandboxed preloads can only require electron, so they bundle the rest.
  await build({
    ...shared,
    entryPoints: {
      'preload/index': 'src/preload/index.ts',
      'preload/shields': 'src/preload/shields.ts',
    },
    external: ['electron'],
  });
  await build({
    entryPoints: ['src/internal/newtab.ts'],
    outdir: 'dist/internal',
    bundle: true,
    platform: 'browser',
    format: 'iife',
    minify: true,
    external: ['/display.woff2', '/serif.woff'],
  });
  await mkdir('dist/internal', { recursive: true });
  await copyFile(
    'src/renderer/fonts/bricolage-latin-wdth.woff2',
    'dist/internal/display.woff2',
  );
  await copyFile(
    'src/renderer/fonts/junicode-italic.woff',
    'dist/internal/serif.woff',
  );
}

await buildElectron();
