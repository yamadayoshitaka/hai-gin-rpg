import {UI_LAYOUT,selectLayout,validateUiLayout,WORLD_RENDER_CONTRACT} from './system-contracts.js?v=88.0';
validateUiLayout();
const root=document.documentElement;
function update(){
 const viewport=window.visualViewport;
 const w=Math.round(viewport?.width||window.innerWidth);
 const h=Math.round(viewport?.height||window.innerHeight);
 const layout=selectLayout(w,h);
 const set=(key,value)=>root.style.setProperty(key,value+'px');
 set('--v88-combat-size',layout.combatButton);
 set('--v88-combat-gap',layout.combatGap);
 set('--v88-combat-side',layout.side);
 set('--v88-combat-bottom',layout.bottom);
 set('--v88-stick-size',layout.joystick);
 root.dataset.uiLayout=layout===UI_LAYOUT.compact?'compact':layout===UI_LAYOUT.mobile?'mobile':'desktop';
 window.__haiGinLayoutQA={viewport:[w,h],layout:root.dataset.uiLayout,buttonSize:layout.combatButton,contract:WORLD_RENDER_CONTRACT,at:Date.now()};
}
window.addEventListener('resize',update);
window.visualViewport?.addEventListener('resize',update);
document.addEventListener('DOMContentLoaded',update);
update();
