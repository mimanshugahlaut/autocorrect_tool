const { resolve } = require('node:path');
const { build } = require('vite');
const react = require('@vitejs/plugin-react');

async function main() {
  const rootDir = resolve(__dirname, '..');

  await build({
    root: rootDir,
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(rootDir, 'popup.html'),
          background: resolve(rootDir, 'src/background/background.js'),
          content: resolve(rootDir, 'src/content/content.js'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
