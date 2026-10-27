import { build } from 'esbuild';

export async function buildElectron() {
  await build({
    entryPoints: {
      'main/index': 'src/main/index.ts',
      'preload/index': 'src/preload/index.ts',
    },
    outdir: 'dist',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron', 'electron-store'],
    sourcemap: true,
  });
  await build({
    entryPoints: ['src/internal/newtab.ts'],
    outdir: 'dist/internal',
    bundle: true,
    platform: 'browser',
    format: 'iife',
    minify: true,
  });
}

await buildElectron();
