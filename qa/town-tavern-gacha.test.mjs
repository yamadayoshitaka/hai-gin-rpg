import test from 'node:test';
import assert from 'node:assert/strict';
import {drawTavernGacha,TAVERN_GACHA,renderTavernGacha,renderTavernGachaResult} from '../src/town-tavern-gacha.js';

function game({wallet=1310,count=0,history=null}={}){
 return {location:'town',wallet,campaign:{
  nextSquadId:10,gameOver:null,log:[],
  squads:count?[{id:1,job:'騎士',rarity:'N',count,purpose:'前線',commanderId:'player'}]:[]
 },recruitGacha:history};
}
const rng=value=>()=>value;
test('normal banner spends wallet, not treasury, and adds a reserve recruit',()=>{
 const state=game();state.campaign.treasury=0;
 const roll=drawTavernGacha(state,'normal',rng(.8));
 assert.equal(roll.cost,TAVERN_GACHA.normal.cost);
 assert.equal(state.wallet,1210);
 assert.equal(state.campaign.treasury,0);
 assert.equal(roll.entries.length,1);
 assert.equal(state.campaign.squads[0].commanderId,'reserve');
 assert.equal(state.campaign.nextSquadId,11);
 assert.equal(state.recruitGacha.total,1);
});
test('rare and UR pools generate corresponding tiers',()=>{
 const ur=drawTavernGacha(game(),'rare',rng(.01));
 const r=drawTavernGacha(game(),'rare',rng(.2));
 const n=drawTavernGacha(game(),'rare',rng(.99));
 assert.equal(ur.highestRarity,'UR');
 assert.equal(r.highestRarity,'R');
 assert.equal(n.highestRarity,'N');
});
test('ten draw is discounted, has distinct identities and guarantees R+',()=>{
 const state=game({wallet:3000});
 const result=drawTavernGacha(state,'ten',rng(.99));
 assert.equal(result.entries.length,10);
 assert.equal(state.wallet,300);
 assert.equal(state.campaign.squads.length,10);
 assert.equal(new Set(result.entries.map(item=>item.id)).size,10);
 assert.equal(result.entries.at(-1).rarity,'R');
 assert.equal(state.recruitGacha.total,10);
});
test('pity counter guarantees UR at the 40th attempt',()=>{
 const state=game({history:{total:39,sinceUR:39,sinceR:9,history:[]}});
 const result=drawTavernGacha(state,'normal',rng(.99));
 assert.equal(result.entries[0].rarity,'UR');
 assert.equal(state.recruitGacha.sinceUR,0);
 assert.equal(state.recruitGacha.sinceR,0);
});
test('insufficient wallet and capacity do not mutate state',()=>{
 for(const state of [game({wallet:20}),game({wallet:5000,count:999})]){
  const snapshot=JSON.stringify(state);
  assert.throws(()=>drawTavernGacha(state,'ten',rng(.99)));
  assert.equal(JSON.stringify(state),snapshot);
 }
});
test('invalid RNG during a ten draw leaves the entire purchase untouched',()=>{
 const state=game({wallet:4000});const before=JSON.stringify(state);
 let count=0;
 assert.throws(()=>drawTavernGacha(state,'ten',()=>++count===13?1:.85));
 assert.equal(JSON.stringify(state),before);
});
test('rendering shows wallet, options and revealed recruit cards',()=>{
 const state=game();
 const html=renderTavernGacha(state);
 assert.match(html,/ノーマルガチャ/);
 assert.match(html,/10連ガチャ/);
 assert.match(html,/1310G/);
 const result=drawTavernGacha(state,'normal',rng(.99));
 assert.match(renderTavernGachaResult(result),/data-gacha-close/);
});
