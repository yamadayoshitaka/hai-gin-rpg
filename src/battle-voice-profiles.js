/**
 * Commercially usable VOICEVOX voice-library profile registry.
 * The audio credit and the library's own terms must be respected.
 * Excludes voices needing individual permission for commercial game distribution
 * (No.7 / もち子さん / 後鬼 / ぞん子, etc.).
 */
export const BATTLE_VOICE_SPEAKERS=Object.freeze({
 male:Object.freeze([
  '玄野武宏','白上虎太郎','剣崎雌雄','雀松朱司','麒ヶ島宗麟',
  'ちび式じい','†聖騎士 紅桜†','栗田まろん'
 ]),
 female:Object.freeze([
  '四国めたん','波音リツ','冥鳴ひまり','九州そら','春日部つむぎ',
  '雨晴はう','WhiteCUL','櫻歌ミコ','小夜/SAYO','猫使アル',
  '猫使ビィ','中国うさぎ','春歌ナナ','ナースロボ＿タイプＴ',
  'ずんだもん'
 ])
});
const JOBS=['剣士','騎士','盾騎士','盾戦士','格闘家','忍者','盗賊','弓使い','魔法使い','僧侶','召喚士','軍師','槍兵'];
export function voiceGender(actor={}){
 if(actor.sex==='female'||actor.gender==='female')return 'female';
 if(actor.sex==='male'||actor.gender==='male')return 'male';
 return Number(actor.id)%5===0?'female':'male';
}
export function voiceOptionsForJob(job,gender='male'){
 const pool=BATTLE_VOICE_SPEAKERS[gender]||BATTLE_VOICE_SPEAKERS.male;
 const i=JOBS.indexOf(job);
 const offset=((i<0?0:i)*3)%pool.length;
 return [0,1,2,3].map(n=>pool[(offset+n)%pool.length]);
}
export function voiceSpeakerForActor(job,actor={}){
 const gender=voiceGender(actor);
 const choices=voiceOptionsForJob(job,gender);
 if(choices.includes(actor.voiceName))return actor.voiceName;
 const hash=String(actor.id??'0').split('').reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,0);
 return choices[(hash>>>0)%choices.length];
}
export function battleVoiceClipKey(job,event,line,gender,speaker=''){
 return [job,event,line,gender,...(speaker?[speaker]:[])].join('::');
}
