// Deterministic mesh fallback for equipment absent from the imported prop library.
// Never silently render a sword for an unrelated slot.
export const EQUIPMENT_KINDS=Object.freeze(['none','sword','guard','staff','dagger','shortsword','katana','twinblade','bow','hammer','mace','knife','sickle','fists','shield','book','pouch','lute','coins']);
export function makeEquipmentFallback(THREE,kind){
 if(kind==='none')return null;
 const g=new THREE.Group();g.name='equipment-'+kind;
 const mat=(c,metalness=0)=>new THREE.MeshStandardMaterial({color:c,metalness,roughness:metalness?.37:.72});
 const wood=mat(0x69462b),steel=mat(0xb7c3cc,.73),gold=mat(0xd2a64b,.62),leather=mat(0x62452e);
 function box(w,h,d,x=0,y=0,z=0,m=wood){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;}
 function tube(r1,r2,h,x=0,y=0,z=0,m=wood){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,12),m);o.position.set(x,y,z);g.add(o);return o;}
 function ball(r,x,y,z,m=steel){const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),m);o.position.set(x,y,z);g.add(o);}
 if(['sword','guard','shortsword','katana','dagger','knife','twinblade','shield'].includes(kind)){
  const short=['dagger','knife','twinblade'].includes(kind),blade=short?.27:kind==='katana'?.63:kind==='shortsword'?.37:.54;
  tube(.023,.024,.19,0,.09,0,leather);box(.21,.033,.065,0,.19,0,gold);
  box(kind==='katana'?.034:.056,blade,.025,0,.19+blade/2,0,steel);
 }else if(kind==='staff'){tube(.025,.035,1.23,0,.52,0,wood);ball(.09,0,1.17,0,gold);}
 else if(['hammer','mace'].includes(kind)){tube(.028,.032,.68,0,.25,0,wood);if(kind==='hammer')box(.34,.2,.18,0,.60,0,steel);else ball(.16,0,.62,0,steel);}
 else if(kind==='sickle'){tube(.025,.028,.48,0,.22,0,wood);const arc=new THREE.Mesh(new THREE.TorusGeometry(.18,.024,7,28,Math.PI*1.35),steel);arc.position.set(.09,.50,0);g.add(arc);}
 else if(kind==='bow'){const arc=new THREE.Mesh(new THREE.TorusGeometry(.43,.026,8,32,Math.PI),wood);arc.rotation.z=Math.PI/2;arc.position.y=.37;g.add(arc);box(.008,.87,.008,0,.37,0,steel);}
 else if(kind==='book'){box(.28,.35,.075,0,.20,0,leather);box(.24,.31,.078,0,.20,0,gold);}
 else if(kind==='pouch'){ball(.16,0,.18,0,leather);tube(.105,.11,.05,0,.32,0,gold);}
 else if(kind==='lute'){ball(.21,0,.24,0,wood);tube(.038,.045,.58,0,.61,0,wood);box(.11,.035,.055,0,.95,0,gold);}
 else if(kind==='coins'){for(let i=0;i<5;i++)tube(.095,.095,.015,(i-2)*.055,.10+i*.027,0,gold);}
 else if(kind==='fists'){box(.16,.13,.14,0,.04,0,leather);}
 return g;
}
