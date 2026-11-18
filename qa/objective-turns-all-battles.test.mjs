import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createObjectiveTurnEngine} from '../src/battle-objective-turns.js';

const groups=Array.from({length:10},(_,i)=>({id:i+1,alive:i<5?10:0,hp:i<5?100:0,danger:false}));
const pauses=[],moves=[],actions=[],reports=[];
const engine=createObjectiveTurnEngine({
 getGroups:()=>groups,moveSeconds:2,actionSeconds:3,
 onPause:paused=>pauses.push(paused),
 onMove:(id,g)=>moves.push([id,g.id]),
 onAction:(id,g)=>actions.push([id,g.after]),
 onReport:rows=>reports.push(rows)
});
engine.begin();
assert.equal(engine.snapshot().phase,'planning');
engine.setGoal(2,'defend');
engine.setGoal(3,'explore');
engine.start();
assert.equal(engine.snapshot().phase,'moving');
assert.equal(moves.length,5);
engine.update(2);
assert.equal(engine.snapshot().phase,'acting');
assert.equal(actions.length,5);
engine.update(3);
assert.equal(engine.snapshot().phase,'report');
assert.equal(engine.status().remaining,2);
engine.update(0,{wallDt:1});
assert.equal(engine.status().phase,'report');
engine.update(0,{wallDt:1});
assert.equal(engine.status().phase,'moving');
assert.equal(engine.status().turn,2);
assert.equal(engine.snapshot().goalByGroup[2],'defend');
assert.equal(engine.snapshot().goalByGroup[3],'explore');
assert.deepEqual(moves.slice(-5).map(x=>x[1]),['attack','defend','explore','attack','attack']);
assert.equal(engine.interrupt(),true);
assert.equal(engine.status().phase,'planning');
engine.setGoal(1,'retreat');
engine.start();
assert.equal(engine.snapshot().goalByGroup[1],'retreat');
engine.update(2);
groups[0].alive=3;groups[0].hp=22;groups[0].danger=true;
engine.update(3);
assert.equal(engine.status().phase,'report');
assert.equal(engine.status().urgent,true);
assert.equal(engine.status().remaining,30);
engine.update(0,{wallDt:5});
assert.equal(engine.status().phase,'report');
assert.equal(engine.status().remaining,25);
engine.setGoal(1,'support');
assert.equal(engine.status().manualHold,true);
engine.update(0,{wallDt:90});
assert.equal(engine.status().phase,'report');
engine.start();
assert.equal(engine.status().phase,'moving');
assert.equal(engine.snapshot().goalByGroup[1],'support');
engine.finish();
assert.equal(engine.status().phase,'done');
assert.ok(pauses.includes(true)&&pauses.includes(false));
assert.equal(reports.length,2);

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/battle-objective-turn-panel.js',import.meta.url),'utf8');
const group=readFileSync(new URL('../src/battle-three-group-panel.js',import.meta.url),'utf8');
assert.match(html,/const objectiveTurnUI=!TOWN_MODE\?installObjectiveTurnPanel/);
assert.match(html,/const threeGroupPanel=!TOWN_MODE\?createBattleThreeGroupPanel/);
assert.match(html,/if\(storyRequest\|\|directBattlePreview\)/);
assert.doesNotMatch(html,/\(!battleParams\.has\('army'\)\|\|Number\(battleParams\.get\('army'\)\)===50\)/);
assert.match(html,/objectiveTurnUI\.update\(paused\?0:dt,bankDelta\)/);
assert.match(html,/Math\.floor\(i\/Math\.max\(5,Math\.ceil\(TEAM_SIZE\/10\)\)\)/);
assert.match(html,/getGroups:turnGroupOverview/);
assert.match(html,/const turnGroupBySquad=new Map/);
assert.match(html,/getGroupLabel:groupId=>turnGroupLabels/);
assert.match(html,/getBattleObjectiveTurnsQA/);
assert.match(html,/TURN10/);
assert.match(group,/allowRecompose:!massSim|allowRecompose=true/);
assert.match(panel,/engine\.interrupt\(\)/);
assert.match(panel,/wallDt/);
for(const path of ['src/battle-objective-turns.js','src/battle-objective-turn-panel.js','src/battle-three-group-panel.js']){
 const code=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 new SourceTextModule(code,{identifier:path});
}
const modules=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
assert.ok(modules.length);
new SourceTextModule(modules.at(-1)[1],{identifier:'battle-entrypoint'});
console.log('PASS: 50v50 + 1000v1000 + story get ten-group objective turns; auto continuation and alert interrupt');
