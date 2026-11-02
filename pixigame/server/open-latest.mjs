import { spawn, execFileSync } from 'node:child_process';
import { mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const entry = fileURLToPath(import.meta.url);
const root = await realpath(resolve(dirname(entry), '..'));
const project = dirname(root);
const port = 5211;
const origin = `http://127.0.0.1:${port}`;
const healthPath = '/__local_latest_version';
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const output = join(dirname(project), 'CodexTest', date, basename(project), '打开最新版本');
const pause = ms => new Promise(done => setTimeout(done, ms));

async function request(path, json = false) {
  try {
    const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return null;
    return json ? await response.json() : await response.text();
  } catch { return null; }
}

function listenerPids() {
  try {
    return [...new Set(execFileSync('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
      .trim().split(/\s+/).filter(Boolean).map(Number))];
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

async function restartPreview() {
  const listeners = listenerPids();
  for (const pid of listeners) {
    const command = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim();
    const cwd = execFileSync('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
      .split('\n').find(line => line.startsWith('n'))?.slice(1);
    const servedPackage = await request(`/@fs/${root}/package.json`, true);
    const viteClient = await request('/@vite/client');
    const nodeProcess = /(?:^|\/)node\s/.test(command);
    if (cwd !== root || !nodeProcess || servedPackage?.name !== 'thunder-vector' || !viteClient?.includes('vite')) {
      throw new Error(`端口 ${port} 被其他服务占用，未停止该进程。请先腾出端口后再启动。`);
    }
  }
  // Stop only the verified Vite preview for this exact checkout.
  for (const pid of listeners) process.kill(pid, 'SIGTERM');
  for (let attempt = 0; listenerPids().length && attempt < 50; attempt++) await pause(100);
  if (listenerPids().length) throw new Error('原预览服务尚未退出，请稍后重试。');

  await mkdir(output, { recursive: true });
  const logPath = join(output, 'server.log');
  const log = await open(logPath, 'a');
  const child = spawn(process.execPath, [entry, '--serve'], {
    cwd: root, detached: true, stdio: ['ignore', log.fd, log.fd],
    env: { ...process.env, TMPDIR: output, TEMP: output, TMP: output },
  });
  child.unref();
  let spawnError;
  child.once('error', error => { spawnError = error; });
  await log.close();
  for (let attempt = 0; attempt < 120; attempt++) {
    if (spawnError) throw spawnError;
    const status = await request(healthPath, true);
    if (status?.root === root && status.pid === child.pid) return status;
    await pause(250);
  }
  throw new Error(`启动超时，请查看日志：${logPath}`);
}

function openChrome(url) {
  // Never launch Chrome or create a window. Only add a normal tab to an
  // existing normal window; incognito windows are excluded explicitly.
  const script = `on run argv
    if application id "com.google.Chrome" is not running then
      error "请先打开 Chrome 的普通窗口，再双击启动脚本。"
    end if
    tell application id "com.google.Chrome"
      repeat with targetWindow in windows
        if mode of targetWindow is "normal" then
          make new tab at end of tabs of targetWindow with properties {URL:item 1 of argv}
          set active tab index of targetWindow to count of tabs of targetWindow
          set index of targetWindow to 1
          activate
          return
        end if
      end repeat
      error "没有可用的 Chrome 普通窗口，请先打开普通窗口。"
    end tell
  end run`;
  try {
    execFileSync('/usr/bin/osascript', ['-', url], { input: script, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw new Error(`预览已启动，但未能打开 Chrome 标签页。可手动打开上方地址。\n${String(error.stderr || error.message).trim()}`);
  }
}

try {
  if (process.argv.includes('--serve')) {
    const { createServer } = await import('vite');
    const instance = randomUUID();
    const server = await createServer({
      root, configFile: join(root, 'vite.config.js'), configLoader: 'runner',
      cacheDir: join(output, 'vite-cache'),
      server: { host: '127.0.0.1', port, strictPort: true, headers: { 'Cache-Control': 'no-store' } },
      plugins: [{ name: 'local-latest-version', configureServer(vite) {
        vite.middlewares.use(healthPath, (_req, res) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ root, pid: process.pid, instance }));
        });
      } }],
    });
    await server.listen();
    const close = async () => { await server.close(); process.exit(0); };
    process.once('SIGTERM', close); process.once('SIGINT', close);
    console.log(`最新源码预览已启动：${origin}`);
  } else {
    await readFile(join(root, 'node_modules/vite/package.json'));
    console.log('正在启动当前项目源码…');
    const status = await restartPreview();
    const url = `${origin}/?local-version=${status.instance}`;
    await writeFile(join(output, 'latest.json'), JSON.stringify({ ...status, url, startedAt: new Date().toISOString() }, null, 2));
    console.log(`\n最新版本：${url}\n日志：${join(output, 'server.log')}\n`);
    if (!process.argv.includes('--no-open')) openChrome(url);
    console.log('服务在后台运行，关闭这个终端窗口不影响预览。');
  }
} catch (error) {
  console.error(`\n${error.code === 'ENOENT' ? '项目依赖缺失，请先在 pixigame 目录执行 npm install。' : error.message}`);
  process.exitCode = 1;
}
