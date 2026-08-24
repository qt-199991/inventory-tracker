// scripts/build-www.mjs
// 把根目录的网页资源复制到 www/，供 Capacitor 打包安卓使用。
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'www');

const files = ['index.html', 'manifest.webmanifest', 'sw.js'];
const dirs = ['css', 'js', 'icons'];

mkdirSync(dest, { recursive: true });

for (const f of files) {
  cpSync(join(root, f), join(dest, f));
}
for (const d of dirs) {
  cpSync(join(root, d), join(dest, d), { recursive: true });
}

console.log('✅ 网页资源已复制到 www/，可用于 Capacitor 打包');
