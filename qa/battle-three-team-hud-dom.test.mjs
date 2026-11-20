import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';
import {createBattleRpgSquadHud} from '../src/battle-rpg-squad-hud.js';
import {aggregateBattleRpgTeams,resolveBattleThreeTeamGroups} from '../src/battle-rpg-squad-source.js';

test('visible mobile ally roster has 3 top-level teams; tap expands jobs; double tap issues group command',()=>{
 const ids=Array.from({length:8},(_,i)=>String(i+1));
 const jobs=['騎士','僧侶','魔法使い','僧侶','魔法使い','騎士','剣士','剣士'];
 const mapped=resolveBattleThreeTeamGroups(ids,id=>jobs[Number(id)-1]);
 const raw=ids.map((id,i)=>({
  team:0,id,name:'第'+id+'隊 '+jobs[i],job:jobs[i],
  alive:1,total:1,hp:80,maxHp:100,mp:7,maxMp:10,
  attackPercent:80,mode:'charge',effects:[],inContact:false
 }));
 const enemy={...raw[0],team:1,id:'enemy-1',name:'敵第1隊',job:'魔獣'};
 const rows=aggregateBattleRpgTeams([...raw,enemy],mapped);
 const {document}=parseHTML('<html><body></body></html>');
 let lastCommand=null,lastFocus=null;
 const hud=createBattleRpgSquadHud({documentRef:document,
  onCommand:(side,id)=>lastCommand={side,id},
  onFocus:(side,id)=>lastFocus={side,id}});
 assert.ok(hud,'HUD instantiated in DOM');
 hud.update(rows,{show:true});
 const allies=hud.root.querySelector('.rpgSquadSide.ally');
 const foes=hud.root.querySelector('.rpgSquadSide.enemy');
 assert.equal(allies.querySelector('.rpgSquadHead small').textContent,'3/3隊');
 assert.equal(allies.querySelectorAll('.rpgTeamSummary').length,3);
 assert.equal(allies.querySelectorAll('.rpgJobDivision').length,0);
 assert.equal(foes.querySelectorAll('.rpgSquadRow').length,1);
 const first=allies.querySelector('.rpgTeamSummary');
 first.click();
 assert.equal(allies.querySelectorAll('.rpgTeamSummary').length,3);
 assert.ok(allies.querySelectorAll('.rpgJobDivision').length>=1);
 assert.equal(allies.querySelector('.rpgSquadHead small').textContent,'3/3隊','expansion is not another team');
 first.click();
 assert.deepEqual(lastCommand,{side:0,id:rows[0].id});
 assert.equal(lastFocus,null,'double tap takes precedence over delayed camera focus');
 hud.dispose();
});
