const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  // Clean output directory
  if (fs.existsSync('out')) {
    fs.rmSync('out', { recursive: true, force: true });
  }
  fs.mkdirSync('out', { recursive: true });

  // Copy webview files
  const webviewSrc = 'src/webviews';
  const webviewDest = 'out/webviews';
  if (fs.existsSync(webviewSrc)) {
    fs.mkdirSync(webviewDest, { recursive: true });
    fs.readdirSync(webviewSrc).forEach(file => {
      if (file.endsWith('.html') || file.endsWith('.js')) {
        fs.copyFileSync(
          path.join(webviewSrc, file),
          path.join(webviewDest, file)
        );
      }
    });
  }

  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
