// Armor and handheld props are independent data records, not baked into jobs.
// Separate slots permit replacing a helmet, cuirass, weapon or shield without
// regenerating a person's body, outfit mesh, or animation.
export const EQUIPMENT_TYPES = Object.freeze({
  plate: {id:'plate',kind:'armor',label:'鋼板鎧',parts:['head','chest','hands','legs','feet']},
  sword: {id:'sword',kind:'weapon',label:'片手剣',asset:'Sword_Bronze'},
  dagger: {id:'dagger',kind:'weapon',label:'短剣',asset:'Sword_Bronze'},
  shield: {id:'shield',kind:'shield',label:'盾',asset:'Shield_Wooden',
    mount:{bone:'lowerarm_l',forearmBlend:.48,forwardOffset:.115,face:'+z',scale:.74}},
  axe: {id:'axe',kind:'tool',label:'斧',asset:'Axe_Bronze'},
  bow: {id:'bow',kind:'weapon',label:'弓'},
  spear: {id:'spear',kind:'weapon',label:'槍'},
  staff: {id:'staff',kind:'weapon',label:'杖'},
  'command-baton': {id:'command-baton',kind:'ceremonial',label:'軍師の指揮杖'},
  scepter: {id:'scepter',kind:'ceremonial',label:'王笏'}
});

const presets={
  job01:{armor:'plate',main:'sword'},
  job02:{},job03:{main:'staff'},job04:{main:'bow'},
  job05:{armor:'plate',main:'sword',offhand:'shield'},
  job06:{main:'dagger'},job07:{main:'dagger',offhand:'dagger'},
  job08:{main:'axe'},job09:{main:'staff'},job10:{main:'staff'},
  king:{main:'scepter'},minister:{},servant:{},princess:{},
  prince:{main:'sword'},queen:{},strategist:{main:'command-baton'}
};
export const equipmentForJob=id=>presets[id]||presets.job01;
export const EQUIPMENT_PRESETS=Object.freeze(presets);

export function assertEquipmentCatalog(){
  for(const [job,preset] of Object.entries(presets)){
    for(const slot of ['armor','main','offhand']){
      if(preset[slot]&&!EQUIPMENT_TYPES[preset[slot]])throw Error(`Unregistered ${slot}: ${job}/${preset[slot]}`);
    }
  }
}
