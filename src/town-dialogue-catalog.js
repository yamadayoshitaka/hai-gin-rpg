/** Scripted citizen/shopkeeper conversations that share chapter and model catalogs. */
import {STARTER_TOWN} from './starter-town.js';
import {continentForChapter} from './continent-campaign.js';
import {STORY_CHAPTERS} from './story-chapters.js';
import {STORY_STAGE_BEATS} from './story-stage-beats-v2.js';
import {CHARACTER_MODEL_REGISTRY} from './character-model-registry.js';
import {MODEL_FIRST_CATALOG} from './model-first-catalog.js';
const keepers=Object.freeze({
 weapons:['鍛冶屋の親方','この刃が誰を守るのか、買う前によく考えてくれ。','今は輸送が遅れ、鋼材にも戦の影がある。','weapons','male'],
 items:['道具屋の店主','薬草も一つの命だよ。持っていきな。','村人の願いを聞くなら、毒消しも忘れずにね。','items','female'],
 formation:['ガラン・訓練教官','ここで隊を鍛え、陣形を学べ。命を無駄にするな。','軍資金で兵を雇える。酒場のガチャで得た仲間も編成できる。','formation','male'],
 tavern:['酒場の主人','戦の噂には、語られなかった人の名前がついて回る。','依頼主が正しいとは限らん。報酬の由来も調べな。','tavern','male'],
 save:['教会の司祭','死者の名を残すことも、祈りの一つです。','帳簿から消えた名が、今夜も聞こえる気がする。','save','male'],
 story:['王城の侍従','謁見の前に、王家が守れなかった民の声を聞いてください。','陛下も全てを知っているわけではありません。','story','female']
});
export function resolveTownConversation({npcId='',name='',role='',panel='',chapter=1}={}){
 const ch=Math.max(1,Math.min(20,Math.floor(Number(chapter)||1)));
 const continent=continentForChapter(ch),story=STORY_CHAPTERS[ch-1];
 const keeper=keepers[panel];
 if(keeper){
  const [speaker,intro,rumor,facility,sex]=keeper;
  const rumorStage={weapons:8,items:1,formation:4,tavern:3,save:7,story:9}[panel]??0;
  const localReport=STORY_STAGE_BEATS[ch-1][rumorStage][0];
  return {id:'keeper-'+panel,name:speaker,role:'shopkeeper',panel:facility,
   modelId:CHARACTER_MODEL_REGISTRY[sex].id,
   lines:[intro,rumor,'【'+continent.regionName+'・'+continent.nation+'】'+continent.conflict,
    '最近この辺りでは、'+localReport]};
 }
 const index=/^street-(\d+)$/.test(npcId)?Number(npcId.slice(7)):0;
 const citizen=STARTER_TOWN.citizens[index%STARTER_TOWN.citizens.length];
 const speaker=citizen?.name||name||role||'村人';
 const lines=[citizen?.line||'この町にも多くの旅人が来ます。',
  'この道を越えると'+continent.nation+'の'+continent.regionName+'だ。'+continent.climate+'は天候が変わりやすい。旅支度を忘れずに。',
  '【'+story.title+'】'+continent.conflict,
  '町の噂だが、'+STORY_STAGE_BEATS[ch-1][index%10][0]];
 return {id:npcId||'street-0',name:speaker,role:citizen?.role||role||'civilian',panel:null,
  modelId:MODEL_FIRST_CATALOG[index%4===0||/ミラ|娘|少女|買い物客/.test(citizen?.name||'')?'civilianFemale':'civilianMale'].url,lines};
}
