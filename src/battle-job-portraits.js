/** Canonical 4x4 job-face atlases already shipped with the campaign.
 * Share the exact sheet/row convention with story-mode.html; no new assets.
 */
const JOB_SHEETS=[
 ['騎士','a',0],['盾騎士','a',1],['忍者','a',2],['シーフ','a',3],
 ['僧侶','b',0],['魔法使い','b',1],['召喚士','b',2],['格闘家','b',3]
];
const ALIASES={'剣士':'騎士','盾戦士':'盾騎士','弓使い':'忍者','弓兵':'忍者','盗賊':'シーフ','部隊':'騎士'};
export const JOB_PORTRAIT_FILES=Object.freeze({
 a:'./assets/story-job-portraits-frontline-v1.webp',
 b:'./assets/story-job-portraits-magic-v1.webp'
});
export function battleJobPortrait(job='',id='',team=0){
 const normalized=String(job||'').trim();
 const exact=JOB_SHEETS.find(([name])=>name===normalized)||
  JOB_SHEETS.find(([name])=>normalized.includes(name))||
  JOB_SHEETS.find(([name])=>name===ALIASES[normalized])||
  JOB_SHEETS[0];
 const [name,sheet,row]=exact;
 const match=/\d+/.exec(String(id));
 const num=match?Number(match[0]):0;
 const column=(Math.abs(num)+(Number(team)===1?1:0))%4;
 return {sheet,file:JOB_PORTRAIT_FILES[sheet],x:column*100/3,y:row*100/3,
  sourceJob:name,fallback:name!==normalized};
}
export function setBattleJobPortrait(element,job,id,team=0){
 const face=battleJobPortrait(job,id,team);
 element.style.backgroundImage='url("'+face.file+'")';
 element.style.backgroundPosition=face.x+'% '+face.y+'%';
 element.title=String(job||'兵士')+'の顔アイコン';
 element.setAttribute('aria-label',element.title);
 return face;
}
