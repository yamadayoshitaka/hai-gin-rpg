import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,source),'utf8');
const html=read('hair-cache-reset.html');
const studio=read('hair-asset-studio.html');
const build=read('scripts/prepare-pages-site.py');

test('standalone cache reset page is valid JS and offers browser-safe fallback',()=>{
 const inline=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(inline,'expected an executable cache-reset script');
 const checked=spawnSync(process.execPath,['--check'],{input:inline[1],encoding:'utf8'});
 assert.equal(checked.status,0,checked.stderr);
 assert.match(html,/id="state"/);
 assert.match(html,/id="continue"/);
 assert.match(html,/location\.replace\(target\.href\)/);
 assert.match(html,/cache_reset/);
 assert.match(html,/cache:'no-store'/);
});
test('cache reset affects only registrations and cached requests in the game directory',()=>{
 assert.match(html,/const scope=new URL\('\.\/',location\.href\)/);
 assert.match(html,/registration\.scope===scope\.href\|\|registration\.scope\.startsWith\(scope\.href\)/);
 assert.match(html,/new URL\(request\.url\)\.href\.startsWith\(scope\.href\)/);
 assert.match(html,/await registration\.unregister\(\)/);
 assert.match(html,/await cache\.delete\(request\)/);
 assert.doesNotMatch(html,/localStorage\.clear\(|sessionStorage\.clear\(|document\.cookie=/);
});
test('reset page does not reinstall the asset relay and studio links to opt-in reset',()=>{
 assert.match(build,/if html\.name == "hair-cache-reset\.html":\s*\n\s*continue/);
 assert.match(studio,/href="\.\/hair-cache-reset\.html\?reset=20261123"/);
 assert.match(build,/pin_public_story_images\(out, release_sha\)/);
});
