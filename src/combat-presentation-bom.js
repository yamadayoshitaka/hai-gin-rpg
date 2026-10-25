/** Combat presentation BOM v114.2. Visual-only, never mutates actor physics. */
export const COMBAT_PRESENTATION=Object.freeze({
  faceTargetDuringBattle:true,
  facingSpeed:14,
  weaponMountScale:0.72,
  equipment:Object.freeze({
    sword:Object.freeze({asset:'Sword_Bronze',length:0.58,offset:[0,-0.12,0],rotation:[Math.PI,0,0]}),
    katana:Object.freeze({asset:'Sword_Bronze',length:0.63,offset:[0,-0.12,0],rotation:[Math.PI,0,0]}),
    dagger:Object.freeze({asset:'Sword_Bronze',length:0.32,offset:[0,-0.08,0],rotation:[Math.PI,0,0]}),
    hammer:Object.freeze({asset:'Axe_Bronze',length:0.53,offset:[0,-0.12,0],rotation:[0,0,Math.PI/2]}),
    staff:Object.freeze({asset:null,length:0.82,offset:[0,0,0],rotation:[0,0,0]}),
    bow:Object.freeze({asset:null,length:0.72,offset:[0,0,0],rotation:[0,0,0]})
  })
});
export const equipmentVisual=(type)=>COMBAT_PRESENTATION.equipment[type]||COMBAT_PRESENTATION.equipment.sword;
