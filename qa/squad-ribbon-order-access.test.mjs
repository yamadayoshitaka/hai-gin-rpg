import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldHideSquadLabelsAtDistance} from '../src/battle-squad-circle-tap.js';
import {squadRibbonStatus,secondsUntilNextOrder} from '../src/battle-command-roster.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const start=html.indexOf('function openSquadTactics(id){');
const end=html.indexOf('function beginStrategistWarp(){',start);
assert.ok(start>0&&end>start,'find squad popup action');
const open=html.slice(start,end);
assert.match(html,/button\.onclick=\(\)=>team===0\?openSquadTactics\(id\):showEnemySquadIntel\(id\)/,
 'left ribbon opens orders; right ribbon remains read only');
assert.match(open,/followCamera=false;/,
 'selecting a squad cannot enter character-follow close-up');
assert.doesNotMatch(open,/followCamera=true;/,
 'zoom-follow automatically hides the command panel in the next render frame');
assert.match(open,/focusedHumanUnitId=null;/);
assert.match(open,/MASS_SIZE>=1000\?[\s\S]*?Math\.min\(88,Math\.max\(62,/,
 '1000v1000 order view must be farther than 56m auto-hide hysteresis');
assert.match(open,/Math\.min\(28,Math\.max\(17,/,
 '50v50 stays above the 16m re-show threshold while issuing orders');
assert.match(open,/\$\('squadTactics'\)\.hidden=false;showSquadTacticsPanel\('main'\)/,
 'one tap opens the quick-order list, not the read-only circle inspector');
assert.match(html,/add\('⚔ 突撃','charge',\(\)=>issue\('charge'\)\)/);
assert.match(html,/add\('🛡 守備','defend',\(\)=>issue\('defend'\)\)/);
assert.match(html,/add\('⏸ 待機','hold',\(\)=>issue\('hold'\)\)/);
assert.match(html,/add\('↘ 退却','retreat',\(\)=>issue\('retreat'\)\)/);
assert.match(html,/button\.onclick=\(\)=>\{if\(!button\.disabled\)action\(\)\}/,
 'order buttons execute on the first click');
assert.match(html,/const issue=mode=>\{if\(issueSquadOrder\(mode,null,\{count:amount\}\)\)closeSquadTactics\(\)\}/,
 'issue order before dismissing the popup');
assert.match(html,/const remaining=team===0\?squadOrderCooldownSeconds\(row\.id\):0;/,
 'cooldown is displayed without disabling squad inspection');
assert.equal(secondsUntilNextOrder(15,20),115);
assert.equal(secondsUntilNextOrder(15,135),0);
assert.equal(squadRibbonStatus({team:0,alive:12,total:15,commanderAlive:true}).enabled,true);
assert.equal(squadRibbonStatus({team:0,alive:12,total:15,commanderAlive:false}).enabled,false);
assert.equal(shouldHideSquadLabelsAtDistance(62,true),false);
assert.equal(shouldHideSquadLabelsAtDistance(17,true),false);
assert.equal(shouldHideSquadLabelsAtDistance(8,false),true);
const zoom=html.slice(html.indexOf('function zoomToSquadMember('),html.indexOf('function activateSquadLabel('));
assert.match(zoom,/followCamera=true;/,'double-tap zoom still hides all squad overlays');
assert.match(html,/body\.squad-closeup #squadTactics/,'zoom intentionally clears command UI');
const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(gpu,/applyCapturedRunArmSwing\(THREE,representative\.character\.model/,
 '1000v1000 keeps real RUN skinned poses on GPU without extra CPU rigs');
console.log('PASS: left squad click opens usable orders in 50/1000, close-up and cooldown remain separate');
