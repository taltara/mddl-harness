import { defineConfig } from 'tsdown'

/**
 * Specifiers the DSH web shell shares into its frozen module table. A client
 * bundle may `require` these; anything else must be inlined, because the
 * injected require cannot answer for it.
 */
const MODULE_TABLE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

// Must equal the package name: the loader keys its module table by it, and the
// shell serves the bundle from /plugins/<name>/client.js.
const PLUGIN_ID = 'dsh-blueprint'

export default defineConfig([
  {
    // Node half: the host Loader imports this to mount the plugin.
    name: 'host',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    // `exports["."].types` names lib/types/index.d.ts; this is the only build
    // step that can produce it. dsh-blueprint 0.5.2 shipped without it -
    // confirmed against the published tarball, not just this repo's history.
    dts: true,
    clean: false,
  },
  {
    // Browser half: a closure factory the shell's module loader executes.
    name: 'client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    external: MODULE_TABLE,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
