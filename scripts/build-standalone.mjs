// scripts/build-standalone.mjs
// 把 CSS / JS 全部内联进单个 standalone.html，
// 解决预览面板只托管 index.html、外部 js/css 加载不到的问题。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const read = (p) => readFileSync(join(root, p), 'utf8');

let html = read('index.html');
const css = read('css/styles.css');

// 拼接逻辑层 + 存储层 + 应用层，去掉 ES module 的 import/export
const jsParts = ['js/logic.js', 'js/db.js', 'js/app.js']
  .map(read)
  .join('\n\n')
  .replace(/\bimport\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '') // 去掉单行/多行 import {...} from '...'
  .replace(/^\s*import\s.*?;\s*$/gm, '')   // 兜底去掉其它 import 行
  .replace(/\bexport\s+(async\s+)?function/g, '$1function') // export function -> function
  .replace(/\bexport\s+const/g, 'const')   // export const -> const
  .replace(/\bexport\s+/g, '');            // 其他 export 兜底

// 内联 CSS（用函数式替换，避免替换串里的 $$ 被 .replace 误当 $ 处理）
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="css\/styles\.css"\s*\/?>/,
  () => `<style>\n${css}\n</style>`
);

// 内联 JS（用普通脚本，避免 module 的跨文件/路径限制；函数式替换防止 $$ 被吞）
html = html.replace(
  /<script\s+type="module"\s+src="js\/app\.js"><\/script>/,
  () => `<script>\n${jsParts}\n</script>`
);

const out = join(root, 'standalone.html');
writeFileSync(out, html, 'utf8');
console.log('✅ 已生成单文件 standalone.html（CSS/JS 全部内联，可直接预览/分发）');
