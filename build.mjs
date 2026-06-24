import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  sourcemap: true,
  minify: false,
  platform: 'node',
  target: 'node18',
  external: ['vscode']
};

async function build() {
  const clientCtx = await esbuild.context({
    ...shared,
    entryPoints: ['src/client/extension.ts'],
    outfile: 'dist/client/extension.js'
  });

  const serverCtx = await esbuild.context({
    ...shared,
    entryPoints: ['src/server/server.ts'],
    outfile: 'dist/server/server.js'
  });

  if (watch) {
    await Promise.all([
      clientCtx.watch(),
      serverCtx.watch()
    ]);
    console.log('Watching...');
  } else {
    await Promise.all([
      clientCtx.rebuild(),
      serverCtx.rebuild()
    ]);
    await Promise.all([
      clientCtx.dispose(),
      serverCtx.dispose()
    ]);
  }
}

build();
