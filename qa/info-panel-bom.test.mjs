import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HUD_PANEL_ITEMS} from '../src/info-panel.js';
import {PART_CATALOG,validateBomCatalog} from '../src/bom-catalog.js';
import {MATERIAL_CATALOG,validateMaterialReferences} from '../src/material-catalog.js';
const html=fs.readFileSync('index.html','utf8'),runtime=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(html.includes('id="game-info-panel-styles"'));
assert.ok(html.includes('v40.6')&&html.includes('game-runtime.js?v=40.6-info-panel'));
assert.ok(runtime.includes('installInfoPanel(document)'));
assert.ok(HUD_PANEL_ITEMS.includes('#ai-status')&&HUD_PANEL_ITEMS.includes('#rpg-progress-hud'));
assert.deepEqual(validateBomCatalog(),[]);
assert.deepEqual(validateMaterialReferences(PART_CATALOG),[]);
for(const [id,part] of Object.entries(PART_CATALOG)){
 assert.ok(part.size.length===3&&part.size.every(v=>v>0),id);
 assert.ok(MATERIAL_CATALOG[part.material],id);
}
console.log('Adventure info drawer and BOM part/material references valid');
