export const JOBS=Object.freeze({swordsman:{label:'剣士',weapons:['steel_sword','training_sword'],outfits:['plate','leather']},shield:{label:'盾騎士'},knight:{label:'騎士'},thief:{label:'シーフ'},ninja:{label:'忍者'},monk:{label:'格闘家'},mage:{label:'魔法使い'},priest:{label:'僧侶'},archer:{label:'弓使い'},summoner:{label:'召喚士'}});
export const WEAPONS={none:{label:'なし'},steel_sword:{label:'灰銀の片手剣',asset:'steel_sword',length:.895},training_sword:{label:'木製訓練剣',asset:'training_sword',length:.895}};
export const OUTFITS={none:{label:'なし',parts:[]},plate:{label:'灰銀の板金鎧',parts:['chest','waist','shoulder','bracer','thigh','greave','boot']},leather:{label:'革鎧',parts:['chest','waist','shoulder','bracer','thigh','greave','boot']}};
export const PARTS={chest:'胸甲',waist:'腰甲',shoulder:'肩甲（左右）',bracer:'前腕甲（左右）',thigh:'大腿甲（左右）',greave:'すね甲（左右）',boot:'足首甲（左右）'};
export const assetUrl=id=>'./assets/equipment-studio/'+id+'.glb';
export const DEFAULT={job:'swordsman',weapon:'none',outfit:'none',hand:'r',hidden:[]};
export const KEY='hai-gin-equipment-studio-v1';
export function normalize(x={}){const job=Object.hasOwn(JOBS,x.job)?x.job:'swordsman',j=JOBS[job];return {job,weapon:j.weapons?.includes(x.weapon)?x.weapon:'none',outfit:j.outfits?.includes(x.outfit)?x.outfit:'none',hand:x.hand==='l'?'l':'r',hidden:Array.isArray(x.hidden)?x.hidden.filter(k=>Object.hasOwn(PARTS,k)):[]}}
export function readSelection(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return {...DEFAULT,hidden:[]}}}
export function saveSelection(x){const v=normalize(x);localStorage.setItem(KEY,JSON.stringify(v));return v}
export function fillChoices(job,weapon,outfit,state){job.replaceChildren(...Object.entries(JOBS).map(([id,j])=>new Option(j.label+(j.weapons?'':'（準備中）'),id)));job.value=state.job;const j=JOBS[state.job];weapon.replaceChildren(...['none',...(j.weapons||[])].map(id=>new Option(WEAPONS[id].label,id)));outfit.replaceChildren(...['none',...(j.outfits||[])].map(id=>new Option(OUTFITS[id].label,id)));weapon.value=state.weapon;outfit.value=state.outfit}
