import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8');
const runtime=fs.readFileSync('src/game-runtime.js','utf8');
const domain=fs.readFileSync('src/rpg-domain.js','utf8');
assert.match(html,/src\/game-runtime\.js/,'HTML must load modular runtime');
assert.ok(html.length<15000,'Monolithic JS must be removed from HTML');
for(const name of ['NPCMovementSystem','IndoorNPCController','CharacterAnimationSystem','BattleUpdateSystem','InteriorFloorController','SceneTransitionSystem','BattleCameraController','CollisionController','InteractionController','BuildingGeometrySystem','RoomGeometrySystem','WorldSceneServices','ProgressionServices','BattleServices','UIInteractionServices','RenderServices']){
 assert.ok(runtime.includes('class '+name),'Missing runtime class '+name);
}
for(const name of ['GameWorld','Character','PlayerCharacter','NPCCharacter','Building','Room','Door','Staircase','CombatSystem','JobSystem','Shop','Inn','QuestSystem','AlignmentSystem','DayNightCycle']){
 assert.ok(domain.includes('export class '+name),'Missing RPG domain '+name);
}
assert.match(runtime,/function updateCombat\(dt\)\{return gameEngine\.BattleUpdateSystem\.updateCombat\(dt\);\}/);
assert.match(runtime,/function staticFree\(x,z,r=\.53\)\{return gameEngine\.CollisionController\.staticFree\(x,z,r\);\}/);
assert.match(runtime,/class GameEngine/);
assert.match(runtime,/const gameEngine=new GameEngine\(\);/);
console.log('Architecture regression tests passed');
