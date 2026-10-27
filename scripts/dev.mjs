import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
import './build.mjs';

const server = await createServer({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
await server.listen();
const env = { ...process.env, DRIFT_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
const shutdown = async () => {
  child.kill();
  await server.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('error', async (error) => {
  console.error(error);
  await shutdown();
  process.exitCode = 1;
});
child.on('exit', async (code) => {
  await server.close();
  process.exitCode = code ?? 0;
});
