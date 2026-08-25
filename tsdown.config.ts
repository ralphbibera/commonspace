import { defineConfig } from 'tsdown'

const id = '@ralphbibera/commonspace'
const sharedExternal = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
]

export default defineConfig([
  {
    name: `${id}:host`,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2023',
    dts: false,
    clean: true,
    external: sharedExternal,
  },
  {
    name: `${id}:client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2023',
    dts: false,
    clean: false,
    sourcemap: true,
    external: sharedExternal,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
