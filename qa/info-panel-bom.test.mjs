import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HUD_PANEL_ITEMS} from '../src/info-panel.js';
import {PART_CATALOG,validateBomCatalog} from '../src/bom-catalog.js';
import {MATERIAL_CATALOG,validateMaterialReferences} from '../src/material-catalog.js';
const html=fs.readFileSync('index.html','utf8'),runtime=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(html.includes('id="game-info-panel-styles"'));
const runtimeVersion=runtime.match(/const gameVersion='[^']* (v[0-9]+\\.[0-9]+)'/)?.[1];
const cacheVersion=html.match(/game-runtime\\.js\\?v=(v[0-9]+\\.[0-9]+)/)?.[1];
assert.ok(runtimeVersion,'Runtime semantic version must be defined');
assert.equal(cacheVersion,runtimeVersion,'Module cache version must match runtime');
assert.ok(html.includes(runtimeVersion),'Boot label must match runtime version');
assert.ok(runtime.includes('installInfoPanel(document)'));
assert.ok(HUD_PANEL_ITEMS.includes('#ai-status')&&HUD_PANEL_ITEMS.includes('#rpg-progress-hud'));
assert.deepEqual(validateBomCatalog(),[]);
assert.deepEqual(validateMaterialReferences(PART_CATALOG),[]);
for(const [id,part] of Object.entries(PART_CATALOG)){
 assert.ok(part.size.length===3&&part.size.every(v=>v>0),id);
 assert.ok(MATERIAL_CATALOG[part.material],id);
}
console.log('Adventure info drawer and BOM part/material references valid');
