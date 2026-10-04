import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const directory=new URL('../apps/web/dist/assets/',import.meta.url);
const styles=(await readdir(directory)).filter(name=>name.endsWith('.css'));
assert.ok(styles.length,'Build the website before checking WebView compatibility.');
const css=(await Promise.all(styles.map(name=>readFile(new URL(name,directory),'utf8')))).join('\n');
const queries=css.match(/@media[^{}]+/g)||[];
assert.ok(queries.length>0,'Expected responsive media queries in the production CSS.');
assert.ok(queries.some(query=>/max-width\s*:\s*680px/.test(query)),'Mobile breakpoint was lost during minification.');
assert.ok(!queries.some(query=>/[<>]=?/.test(query)),
  'Media range syntax would make older Android WebViews ignore mobile layouts.');
const html=await readFile(new URL('../apps/web/dist/index.html',import.meta.url),'utf8');
assert.match(html,/width=device-width,initial-scale=1/);
assert.match(html,/apple-touch-icon-v3\.png/);
console.log(`Verified ${queries.length} production media queries use WebView-compatible syntax (${fileURLToPath(directory)}).`);
