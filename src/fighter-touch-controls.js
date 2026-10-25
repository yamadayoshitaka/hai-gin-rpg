/** v118.1: Fighter touch controls. All actions resolve through battle-controller data, not duplicate combat handlers. */
globalThis.__haiGinFighterButtons={crouch:false,jump:false,guard:false};
function initFighterButtons(){
 const strike=document.getElementById('battle-strike-pad');
 if(!strike||document.getElementById('fighter-posture-pad'))return false;
 const pad=document.createElement('div');pad.id='fighter-posture-pad';
 for(const [key,label] of [['jump','ジャンプ'],['crouch','しゃがみ'],['guard','ガード']]){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.className='fighter-posture-button';button.dataset.fighterInput=key;
  const reset=()=>{globalThis.__haiGinFighterButtons[key]=false;button.classList.remove('pressed');};
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();globalThis.__haiGinFighterButtons[key]=true;button.classList.add('pressed');button.setPointerCapture?.(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,reset);
  pad.appendChild(button);
 }
 document.body.appendChild(pad);
 window.addEventListener('blur',()=>{for(const k of ['jump','crouch','guard'])globalThis.__haiGinFighterButtons[k]=false;});
 return true;
}
if(!initFighterButtons()){
 const wait=setInterval(()=>{if(initFighterButtons())clearInterval(wait);},250);
 setTimeout(()=>clearInterval(wait),30000);
}
