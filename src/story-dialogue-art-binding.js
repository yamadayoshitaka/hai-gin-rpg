/**
 * Image-first dialogue binding for the compact story.
 * A character CG never narrates an unrelated person's dialogue.
 * A recap belongs on its own gender-neutral overview image.
 */
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
import {screenplayRubyTokens,screenplayVoiceText} from './story-screenplay-v2.js';
const cast=Object.freeze(Object.fromEntries(STORY_KEY_PEOPLE.map(p=>[p.id,p])));
const APPROVED_SCENE_SPEAKERS=Object.freeze({
 // In the existing S03/S05 first-CG screenshots the main figure is the
 // blonde royal woman, not Iris or the old knight. Avoid the wrong-face UI.
 'c01-s03-m1':'lucia',
 'c01-s05-m1':'lucia'
});
const SCRIPTED_CG_LINES=Object.freeze({
 'c01-s03-m1':'外郭の陣地を確保しましょう。兵が行き来する道を調べて、補給を絶やさないようにしてください。',
 'c01-s05-m1':'城壁の外には、まだ逃げ遅れた人たちがいます。防衛線を整える前に、安全に戻れる道を確保してください。'
});
function voiced({id,speaker,characterId=null,role='物語',faction='',text}){
 const value=String(text||'').trim();
 if(!value)throw Error('Empty dialogue '+id);
 return Object.freeze({id,speaker,characterId,role,faction,text:value,
  subtitleText:value,voiceText:screenplayVoiceText(value),
  rubyTokens:screenplayRubyTokens(value),hasVoice:true});
}
export const STORY_RECAP_ART='./assets/story/recap/owner-approved-kingdom-overview.webp';
export function recapForStage(stage,script,{chapterOpening=false}={}){
 const setup=script.pre.find(x=>x.kind==='stage-setup')?.text||'';
 const objective=script.pre.find(x=>x.kind==='stage-objective')?.text||'';
 const chapter=script.pre.find(x=>x.kind==='chapter-opening')?.text||'';
 const text=[chapterOpening?chapter:'ここまでのあらすじ。',setup,objective].filter(Boolean).join(' ');
 return Object.freeze({...voiced({id:stage.id+'-recap',speaker:'語り手',
  text}),kind:'recap',isNarrationRecap:true,artAsset:STORY_RECAP_ART,
  noPortrait:true,sharedAcrossGenders:true,extraCGSlot:false});
}
function actorForArt(shot,stage){
 const preferred=APPROVED_SCENE_SPEAKERS[shot.id];
 const id=preferred||shot.characterId||shot.secondaryId||
  (stage.chapter===1?'lucia':'');
 return id&&cast[id]?cast[id]:null;
}
function authoredFallback(person,stage,phase){
 const title=stage.name;
 if(phase==='post')return 'この地で起きたことを記録しましょう。仲間の無事を確かめ、次に備えてください。';
 if(stage.kind==='defend')return '「'+title+'」では、守るべき人と場所を先に確認しておきましょう。';
 if(stage.kind==='capture')return '「'+title+'」へ進みます。兵の進む道と補給路を、まず確認してください。';
 if(stage.kind==='siege')return '「'+title+'」に進む前に、敵だけでなく町の人たちの動きにも気を配りましょう。';
 if(stage.kind==='town')return 'ここで情報を集めてから出発しましょう。皆の話を聞かせてください。';
 return '「'+title+'」には、まだ分からないことがあります。落ち着いて確かめましょう。';
}
export function dialogueForIllustration(shot,{stage,script,phase,used=new Set()}){
 const actor=actorForArt(shot,stage);
 if(!actor){
  // Unknown character identity is never guessed from narration. Keep it
  // out of the portrait strip until a visually verified actor is supplied.
  return Object.freeze([voiced({id:shot.id+'-scene',
   speaker:'語り手',text:phase==='post'
    ?'戦いの結果を確認して、仲間たちのその後を確かめよう。'
    :'この舞台では、仲間と協力して進んでいこう。'})]);
 }
 let value=SCRIPTED_CG_LINES[shot.id]||'';
 if(!value){
  const candidates=(phase==='pre'?script.pre:script.post)
   .filter(x=>x.characterId===actor.id&&!used.has(x.text));
  const match=candidates[0];
  if(match)value=match.text;
 }
 if(!value&&shot.characterId===actor.id&&!/^(第\d+章|作戦目標：)/.test(shot.text||'')){
  value=shot.text||'';
 }
 if(!value)value=authoredFallback(actor,stage,phase);
 if(used.has(value))value=authoredFallback(actor,stage,phase)+' 仲間の声も聞きましょう。';
 used.add(value);
 return Object.freeze([voiced({id:shot.id+'-scene',speaker:actor.name,
  characterId:actor.id,role:actor.role,faction:actor.faction,text:value})]);
}
