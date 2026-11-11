/**
 * Story-only pronunciation dictionary. Display/subtitle text is never mutated.
 * Only VOICEVOX synthesis and device speech synthesis receive this version.
 * Ordered longest-first, so e.g. 星鐘守 is not broken by 星鐘.
 */
export const STORY_READINGS=Object.freeze({
 '灰銀のレゾナンス':'はいぎんのレゾナンス',
 '灰銀王国':'はいぎんおうこく',
 '紅炎帝国':'こうえんていこく',
 '翠嵐王国':'すいらんおうこく',
 '星鐘守':'せいしょうもり',
 '灰銀':'はいぎん','紅炎':'こうえん','翠嵐':'すいらん',
 '星鐘':'せいしょう','鐘守':'かねもり','記録院':'きろくいん',
 'レヴナ':'れぶな','リュシア':'りゅしあ','ガラン':'がらん',
 'イリス':'いりす','シオン':'しおん','カイ':'かい',
 'レオン':'れおん','フィオ':'ふぃお','エド':'えど',
 'ミナ':'みな','ノエル':'のえる','ライゼン':'らいぜん',
 'ヴァルド':'ゔぁるど','セリカ':'せりか','ザハル':'ざはる',
 'グラド':'ぐらど','アルテア':'あるてあ','オルフェ':'おるふぇ',
 'メーヴ':'めーゔ','エルネ':'えるね','ヴェス':'ゔぇす',
 '王都':'おうと','軍師':'ぐんし','王印':'おういん',
 '戦死者':'せんししゃ','先王':'せんおう'
});
const entries=Object.freeze(Object.entries(STORY_READINGS).sort((a,b)=>b[0].length-a[0].length));
const escaped=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp(entries.map(([k])=>escaped(k)).join('|'),'g');
export function storyVoiceText(displayText){
 const text=String(displayText??'');
 return text.replace(pattern,key=>STORY_READINGS[key]||key)
  .replace(/([。！？])/g,'$1 ').replace(/[\u200b-\u200d]/g,'').trim();
}
export function storyRubyTokens(displayText){
 const text=String(displayText??'');
 const tokens=[];let cursor=0;
 for(const match of text.matchAll(new RegExp(pattern.source,'g'))){
  if(match.index>cursor)tokens.push({text:text.slice(cursor,match.index),ruby:null});
  tokens.push({text:match[0],ruby:STORY_READINGS[match[0]]});
  cursor=match.index+match[0].length;
 }
 if(cursor<text.length)tokens.push({text:text.slice(cursor),ruby:null});
 return tokens;
}
