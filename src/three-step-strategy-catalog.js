/** Hierarchical, job-gated battle orders. Each choice must translate to a real action. */
export const STRATEGY_TREE=Object.freeze({
 attack:{name:'攻撃',intents:{
  melee:{name:'近距離',methods:[
   {id:'melee_focus',name:'集中突破',mode:'charge',type:'enemy',jobs:['sword','shield','fighter']},
   {id:'melee_split',name:'複数敵へ分進',mode:'charge',type:'enemy',jobs:['sword','shield','fighter','ninja']}
  ]},
  ranged:{name:'遠距離',methods:[
   {id:'ranged_focus',name:'遠距離集中',mode:'charge',type:'enemy',jobs:['mage','summoner','archer']},
   {id:'ranged_split',name:'遠距離分散',mode:'charge',type:'enemy',jobs:['mage','summoner','archer']}
  ]},
  terrain:{name:'環境利用',methods:[
   {id:'attack_object',name:'障害物を先に破壊',mode:'destroy',type:'object',jobs:['mage','ninja']}
  ]}
 }},
 defense:{name:'守備',intents:{
  block:{name:'阻止',methods:[
   {id:'block_passage',name:'進路を封鎖',mode:'defend',type:'map',jobs:['sword','shield','fighter']},
   {id:'block_advance',name:'前進を阻止',mode:'defend',type:'map',jobs:['sword','shield','ninja']}
  ]},
  escape:{name:'逃走',methods:[
   {id:'withdraw',name:'後方へ退避',mode:'retreat',type:'map',jobs:[]},
   {id:'regroup',name:'後退し再集結',mode:'retreat',type:'map',jobs:[]}
  ]},
  hold:{name:'拠点維持',methods:[
   {id:'hold_line',name:'指定地点を維持',mode:'hold',type:'map',jobs:[]}
  ]}
 }},
 support:{name:'支援',intents:{
  heal:{name:'回復',methods:[
   {id:'heal_wounded',name:'負傷者を治療',mode:'support',type:'map',jobs:['priest']}
  ]},
  buff:{name:'強化',methods:[
   {id:'boost_attack',name:'攻撃力を強化',mode:'support',type:'map',jobs:['priest','summoner'],buff:{attack:.12}},
   {id:'boost_defense',name:'防御力を強化',mode:'support',type:'map',jobs:['priest','summoner'],buff:{defense:.12}},
   {id:'boost_speed',name:'機動力を強化',mode:'support',type:'map',jobs:['priest','summoner'],buff:{speed:.15}}
  ]}
 }},
 explore:{name:'探索',intents:{
  walk:{name:'徒歩',methods:[
   {id:'scout_walk',name:'徒歩で建物探索',mode:'explore',type:'object',jobs:['thief','ninja']}
  ]},
  summon:{name:'召喚獣',methods:[
   {id:'scout_summon',name:'召喚獣で先行偵察',mode:'explore',type:'object',jobs:['summoner'],requiresSummon:true}
  ]}
 }},
 weaken:{name:'弱体化',intents:{
  reduce:{name:'能力低下',methods:[
   {id:'cut_attack',name:'攻撃力 -20%',mode:'weaken',type:'enemy',jobs:['mage'],debuff:{stat:'attack',amount:.20}},
   {id:'cut_defense',name:'防御力 -15%',mode:'weaken',type:'enemy',jobs:['thief'],debuff:{stat:'defense',amount:.15}},
   {id:'cut_speed',name:'機動力 -18%',mode:'weaken',type:'enemy',jobs:['ninja'],debuff:{stat:'speed',amount:.18}}
  ]},
  prevent:{name:'行動阻止',methods:[
   {id:'prevent_heal',name:'回復を阻止 -100%',mode:'weaken',type:'enemy',jobs:['mage'],debuff:{stat:'heal_block',amount:1}},
   {id:'prevent_buff',name:'強化を阻止 -100%',mode:'weaken',type:'enemy',jobs:['thief','ninja'],debuff:{stat:'buff_block',amount:1}}
  ]}
 }},
 environment:{name:'環境利用',intents:{
  destroy:{name:'破壊',methods:[
   {id:'destroy_path',name:'橋・門・建物を破壊',mode:'destroy',type:'object',jobs:['mage','ninja']}
  ]},
  survey:{name:'利用',methods:[
   {id:'explore_building',name:'建物・宝箱を探索',mode:'explore',type:'object',jobs:['ninja','thief']}
  ]}
 }}
});
export const STORY_JOB_TO_STRATEGY_JOB=Object.freeze({
 '剣士':'sword','騎士':'sword','盾騎士':'shield','忍者':'ninja','シーフ':'thief',
 '僧侶':'priest','魔法使い':'mage','召喚士':'summoner','格闘家':'fighter','弓使い':'archer'
});
export const STRATEGY_METHODS=Object.freeze(Object.fromEntries(
 Object.values(STRATEGY_TREE).flatMap(f=>Object.values(f.intents)
  .flatMap(i=>i.methods.map(m=>[m.id,Object.freeze(m)])))
));
/** Number of assigned physical platoons, not a fabricated battle success probability. */
export function methodShares(methodIds,squadCount){
 const ids=[...new Set(methodIds)].filter(id=>STRATEGY_METHODS[id]);
 if(!ids.length||!squadCount)return [];
 const shares=ids.map((id,index)=>({id,units:Math.floor(squadCount/ids.length)+(index<squadCount%ids.length?1:0)}));
 return shares.map(x=>({...x,percent:Math.round(x.units/squadCount*100)}));
}
