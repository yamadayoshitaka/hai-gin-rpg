/** Scripted citizen/shopkeeper conversations that share chapter and model catalogs. */
import {STARTER_TOWN} from './starter-town.js';
import {continentForChapter} from './continent-campaign.js';
import {STORY_CHAPTERS} from './story-chapters.js';
import {CHARACTER_MODEL_REGISTRY} from './character-model-registry.js';
const keepers=Object.freeze({
 weapons:['武具屋の店主','この刃が誰を守るのか、買う前によく考えてくれ。','今は輸送が遅れ、鋼材にも戦の影がある。','weapons','male'],
 items:['道具屋の店主','薬草も一つの命だよ。持っていきな。','村人の願いを聞くなら、毒消しも忘れずにね。','items','female'],
 formation:['宿屋の主人','旅人と傭兵はここで出会う。彼らには帰る場所がある。','招集の鐘が鳴っても、無理に出征させないでくれ。','formation','male'],
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
  return {id:'keeper-'+panel,name:speaker,role:'shopkeeper',panel:facility,
   modelId:CHARACTER_MODEL_REGISTRY[sex].id,
   lines:[intro,rumor,'【'+continent.name+'】'+continent.conflict,
    story.dialogues[Math.min(1,story.dialogues.length-1)]?.line||story.narration]};
 }
 const index=/^street-(\d+)$/.test(npcId)?Number(npcId.slice(7)):0;
 const citizen=STARTER_TOWN.citizens[index%STARTER_TOWN.citizens.length];
 const speaker=citizen?.name||name||role||'村人';
 const lines=[citizen?.line||'この町にも多くの旅人が来ます。',
  '大陸の外にも私たちの知らない暮らしがあります。'+continent.climate+'を旅するなら気をつけて。',
  '【'+story.title+'】'+continent.conflict,
  story.dialogues[index%story.dialogues.length]?.line||story.narration];
 return {id:npcId||'street-0',name:speaker,role:citizen?.role||role||'civilian',panel:null,
  modelId:CHARACTER_MODEL_REGISTRY[index%4===0?'female':'male'].id,lines};
}
