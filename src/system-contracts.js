/** v88 UI control data is the single source of truth for visual tap sizes. */
export const UI_LAYOUT=Object.freeze({
 mobile:{touchMin:56,combatButton:86,combatGap:10,joystick:174,side:12,bottom:20},
 compact:{touchMin:52,combatButton:74,combatGap:8,joystick:145,side:8,bottom:12},
 desktop:{touchMin:52,combatButton:92,combatGap:12,joystick:180,side:18,bottom:22},
});
export const WORLD_RENDER_CONTRACT=Object.freeze({
 units:'meters',adultHeight:[1.57,2.25],childHeight:[1.05,1.55],
 playerRole:'hero',animationOwner:'canonical-motion-controller',
 equipmentOwner:'rig-attachment',collisionSource:'world-composition',
 renderCoordinates:'world',uiCoordinates:'css-viewport'
});
export function selectLayout(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid UI viewport');
 return width<=370||height<=640?UI_LAYOUT.compact:width<=760?UI_LAYOUT.mobile:UI_LAYOUT.desktop;
}
export function validateUiLayout(){
 for(const [name,layout] of Object.entries(UI_LAYOUT)){
  if(layout.combatButton<layout.touchMin||layout.joystick<layout.touchMin)throw Error('Undersized controls: '+name);
 }
 return true;
}
