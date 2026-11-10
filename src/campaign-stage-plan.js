/**
 * 20 chapters x 10 stage slots. Data only: no THREE, DOM, or browser storage.
 * Each slot is stable for saves. Reuses existing stage biomes/monster catalogue.
 * Stage templates are blueprints, not a claim of 200 handcrafted 3D maps.
 */
import {STORY_CHAPTERS} from './story-chapters.js';
import {MONSTER_CATALOG} from './monster-catalog.js';
import {STAGE_PRESETS,stageForTerritory} from './stage-library.js';
import {continentForChapter} from './continent-campaign.js';
export const TOTAL_CHAPTERS=20;
export const STAGES_PER_CHAPTER=10;
export const TOTAL_STAGES=TOTAL_CHAPTERS*STAGES_PER_CHAPTER;
export const STAGE_KINDS=Object.freeze({
 town:'町・拠点', explore:'開拓・魔物討伐', capture:'陣地制圧',
 defend:'拠点防衛', siege:'攻城戦', boss:'章決戦'
});
export const STAGE_WIN_CONDITIONS=Object.freeze({
 town:'訪問・会話・買い物・編成',
 explore:'出現した全モンスターを討伐',
 capture:'指定した陣地を確保',
 defend:'防衛時間の終了まで拠点を守る',
 siege:'敵の主将または拠点の制圧',
 boss:'章の決戦目標を達成'
});
const stagePatterns=[
 ['town','explore','capture','explore','defend','explore','capture','explore','siege','boss'],
 ['town','explore','capture','explore','capture','explore','defend','explore','siege','boss']
];
const names={
 town:['レヴナの町','旅支度と情報収集','軍議の宿場','帰還の町'],
 explore:['辺境の魔物掃討','森と遺構の調査','荒野の掃討','封印地の討伐'],
 capture:['外郭陣地の確保','補給路の奪取','前線の旗を奪う','監視拠点の制圧'],
 defend:['住民避難の防衛','橋頭堡の防衛','防衛線の死守','補給陣地の守備'],
 siege:['敵勢力の砦攻略','関門突破','城壁への進軍','主力拠点攻略'],
 boss:['星鐘の残響','章の決戦','忘れられた守護者','迫り来る影']
};
const terrainFor=['forest','plains','highland','village','marsh','snow','desert','ruins','coast','urban'];
const chapterBeats=['拠点に到着','証人を探す','交易路を押さえる','敵の記録を調べる','民を救出','秘密の通路','反乱と決断','最後の準備','王権の防衛線','章の決戦'];
function chooseMonsters(chapter,slot){
 // Each enemy ID is guaranteed to be registered in the existing bestiary.
 const start=((chapter-1)*5+slot*3)%MONSTER_CATALOG.length;
 const count=slot===10?1:chapter>=12?4:chapter>=5?3:2;
 return Array.from({length:count},(_,i)=>MONSTER_CATALOG[(start+i*7)%MONSTER_CATALOG.length].id);
}
export const CAMPAIGN_STAGES=Object.freeze(STORY_CHAPTERS.flatMap(chapter=>
 Array.from({length:STAGES_PER_CHAPTER},(_,i)=>{
  const slot=i+1;
  const kind=stagePatterns[(chapter.id-1)%2][i];
  const town=kind==='town';
  const name=slot===1?(chapter.id===1?'黎明の王都レヴナ':chapter.location+'・軍の拠点'):
   slot===10?chapter.title+'・決戦':
   chapter.location+'・'+names[kind][(chapter.id+slot)%names[kind].length];
  const id='c'+String(chapter.id).padStart(2,'0')+'-s'+String(slot).padStart(2,'0');
  const territoryId=chapter.territory;
  const biome=terrainFor[(chapter.id+slot*3)%terrainFor.length];
  const mapped=stageForTerritory(territoryId,'');
  const homeStage=STAGE_PRESETS.find(s=>s.id===mapped);
  const townPreset=chapter.id===1?'royal-castle':
   homeStage&&['capital','fort','town','village'].includes(homeStage.buildingMode)?homeStage.id:
   ['river-village','border-town','river-port','green-capital'][(chapter.id-2)%4];
  const scenePreset=chapter.id===1&&slot===1?'royal-castle':
   'campaign-c'+String(chapter.id).padStart(2,'0')+'-s'+String(slot).padStart(2,'0');
  const continent=continentForChapter(chapter.id);
  return Object.freeze({
   id,number:(chapter.id-1)*10+slot,chapter:chapter.id,slot,
   chapterTitle:chapter.title,act:chapter.act,name,kind,
   territoryId,scenePreset,biome,continentId:continent.id,continentName:continent.name,
   chapterConflict:continent.conflict,storyBeat:chapterBeats[i],
   winCondition:STAGE_WIN_CONDITIONS[kind],
   monsters:kind==='explore'||kind==='boss'?Object.freeze(chooseMonsters(chapter.id,slot)):Object.freeze([]),
   enemyFaction:['siege','capture','defend'].includes(kind)?(chapter.id%3===0?'verdant':'crimson'):null,
   storyEvent:slot===1||slot===5||slot===10,
   canSave:town,
   difficulty:Math.min(100,Math.max(1,chapter.id*3+slot)),
   lockedAfter:chapter.id===1&&slot===1?null:
    'c'+String(i===0?chapter.id-1:chapter.id).padStart(2,'0')+'-s'+String(i===0?10:i).padStart(2,'0')
  });
 })));
export const CAMPAIGN_STAGE_BY_ID=Object.freeze(Object.fromEntries(CAMPAIGN_STAGES.map(s=>[s.id,s])));
export const stageByNumber=number=>CAMPAIGN_STAGES[number-1]||null;
export const stagesInChapter=chapter=>CAMPAIGN_STAGES.filter(s=>s.chapter===chapter);
export const nextCampaignStage=id=>{
 const s=CAMPAIGN_STAGE_BY_ID[id];return s?stageByNumber(s.number+1):null;
};
export function stageUnlocked(stage,completed=[]){
 if(!stage)return false;
 return !stage.lockedAfter||completed.includes(stage.lockedAfter);
}
export const chapterAvailable=(chapter,completed=[])=>chapter===1||completed.includes('c'+String(chapter-1).padStart(2,'0')+'-s10');
