import {
 PART_CATALOG,PART_GROUPS,PART_GROUP_LABELS,OFFSET_CHOICES,ANGLE_CHOICES,
 normalizePartSelection,HAIR_COLORS
} from './face-part-catalog-v32.js?v=33';
import {WIG_BASE_VOLUME_PROFILES} from './face-wig-styles.js?v=33';

/** v32: select ten real 3D geometric presets, not independent morph sliders. */
export function createPartSelectorUI(target,gender,current,onChange){
 if(!target||!PART_CATALOG[gender])throw Error('Invalid v32 part selector');
 const state=normalizePartSelection(current);
 target.replaceChildren();
 target.classList.add('v32-part-picker');
 const head=document.createElement('p');
 head.textContent='各部位は10種類。パーツを選ぶと顔の頂点も一緒になじませます。位置・角度は段階式です。';
 target.append(head);
 const ids={
  face:[],eye:['eyeX','eyeY','eyeZ','eyeAngle'],
  nose:['noseX','noseY','noseZ','noseAngle'],
  mouth:['mouthX','mouthY','mouthZ','mouthAngle'],
  hair:['hairX','hairY','hairAngle'],makeup:[]
 };
 const adjustmentLabels={
  eyeX:'左右の間隔',eyeY:'高さ',eyeZ:'前後',eyeAngle:'目尻角度',
  noseX:'左右位置',noseY:'高さ',noseZ:'前後',noseAngle:'傾き',
  mouthX:'左右位置',mouthY:'高さ',mouthZ:'前後',mouthAngle:'口元角度',
  hairX:'左右位置',hairY:'高さ',hairAngle:'傾き'
 };
 const select=(id,values,chosen,onSelect)=>{
  const field=document.createElement('select');field.id=id;
  for(const [v,caption] of values){
   const opt=document.createElement('option');opt.value=String(v);
   opt.textContent=caption;field.append(opt);
  }
  field.value=String(chosen);
  field.addEventListener('change',()=>onSelect(Number(field.value)));
  return field;
 };
 const announce=()=>onChange({...state});
 for(const group of PART_GROUPS){
  const panel=document.createElement('details');
  panel.className='v32-part-group';
  if(group==='eye'||group==='hair')panel.open=true;
  const summary=document.createElement('summary');
  summary.textContent=PART_GROUP_LABELS[group]+'（'+PART_CATALOG[gender][group].length+'種類）';
  panel.append(summary);
  const label=document.createElement('label');
  label.textContent=PART_GROUP_LABELS[group]+'の3Dタイプ';
  const choices=PART_CATALOG[gender][group];
  label.append(select('v32'+(gender==='female'?'Female':'Male')+
   group[0].toUpperCase()+group.slice(1),
   choices.map((item,i)=>[i, String(i+1).padStart(2,'0')+' '+item.label]),
   state[group],v=>{state[group]=v;announce();}));
  panel.append(label);
  if(group==='hair'){
   const colorLabel=document.createElement('label');
   colorLabel.textContent='髪色（16色プリセット）';
   const colorSelect=document.createElement('select');
   colorSelect.id='v33'+(gender==='female'?'Female':'Male')+'HairColor';
   for(const [key,choice] of Object.entries(HAIR_COLORS)){
    const opt=document.createElement('option');opt.value=key;
    opt.textContent=choice.label;colorSelect.append(opt);
   }
   colorSelect.value=state.hairColor;
   colorSelect.addEventListener('change',()=>{
    state.hairColor=colorSelect.value;announce();
   });
   colorLabel.append(colorSelect);panel.append(colorLabel);
   const baseLabel=document.createElement('label');
   baseLabel.textContent='ウィッグの土台（根元の盛り上がり）';
   const baseSelect=document.createElement('select');
   baseSelect.id='v33'+(gender==='female'?'Female':'Male')+'WigVolume';
   for(const [key,profile] of Object.entries(WIG_BASE_VOLUME_PROFILES)){
    const opt=document.createElement('option');opt.value=key;
    opt.textContent=profile.label;baseSelect.append(opt);
   }
   baseSelect.value=state.hairVolume;
   baseSelect.addEventListener('change',()=>{
    state.hairVolume=baseSelect.value;announce();
   });
   baseLabel.append(baseSelect);panel.append(baseLabel);
  }
  if(ids[group].length){
   const grid=document.createElement('div');grid.className='v32-pose-grid';
   for(const key of ids[group]){
    const l=document.createElement('label');l.textContent=adjustmentLabels[key];
    const angles=key.toLowerCase().includes('angle');
    const opts=angles?
     ANGLE_CHOICES.map(v=>[v,(v>0?'+':'')+v+'°']):
     OFFSET_CHOICES.map(o=>[o.value,o.label]);
    l.append(select('v32'+(gender==='female'?'Female':'Male')+
     key[0].toUpperCase()+key.slice(1),opts,state[key],
     v=>{state[key]=v;announce();}));
    grid.append(l);
   }
   panel.append(grid);
  }
  target.append(panel);
 }
 const tip=document.createElement('p');
 tip.className='v32-tip';
 tip.textContent='髪は物理演算なしの厚み付き4層ヘアカード。土台の盛り上がりに合わせて毛束の根元も動きます。';
 target.append(tip);
 return {getSelection:()=>({...state})};
}
