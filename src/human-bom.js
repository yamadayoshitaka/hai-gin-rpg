/** Anthropometric character BOM in metres. Reusable parts with explicit IDs. */
export const HUMAN_PARTS=Object.freeze({
 torso:{shape:'capsule',size:[.43,.61,.26],material:'leather'},
 pelvis:{shape:'box',size:[.37,.22,.25],material:'leather'},
 head:{shape:'sphere',size:[.19,.245,.20],material:'skin'},
 hair:{shape:'sphere',size:[.20,.12,.215],material:'hair'},
 neck:{shape:'cylinder',size:[.115,.13,.115],material:'skin'},
 upperArm:{shape:'capsule',size:[.125,.32,.13],material:'leather'},
 forearm:{shape:'capsule',size:[.108,.29,.11],material:'skin'},
 hand:{shape:'sphere',size:[.085,.095,.09],material:'skin'},
 thigh:{shape:'capsule',size:[.17,.41,.18],material:'leather'},
 shin:{shape:'capsule',size:[.13,.39,.14],material:'leather'},
 boot:{shape:'box',size:[.17,.17,.29],material:'walnut'},
 eye:{shape:'sphere',size:[.023,.025,.016],material:'charcoal'},
 breastplate:{shape:'box',size:[.4,.37,.08],material:'iron'},
 belt:{shape:'box',size:[.39,.075,.28],material:'walnut'},
 cape:{shape:'box',size:[.44,.67,.028],material:'royal'},
 nose:{shape:'sphere',size:[.035,.052,.057],material:'skin'},
 ear:{shape:'sphere',size:[.043,.067,.024],material:'skin'},
 brow:{shape:'box',size:[.065,.016,.015],material:'hair'},
 mouth:{shape:'box',size:[.085,.012,.011],material:'lip'}
});
const item=(partId,position,attach='body',materialId)=>({partId,position,attach,...(materialId?{materialId}:{})});
export const HUMAN_BOMS=Object.freeze({
 civilian:{height:1.69,parts:[
  item('torso',[0,1.18,0]),item('pelvis',[0,.91,0]),item('neck',[0,1.53,0]),item('head',[0,1.68,0]),
  item('hair',[0,1.84,-.015]),item('belt',[0,.90,0]),
  item('thigh',[0,-.20,0],'legLeft'),item('shin',[0,-.57,0],'legLeft'),item('boot',[0,-.79,.06],'legLeft'),
  item('thigh',[0,-.20,0],'legRight'),item('shin',[0,-.57,0],'legRight'),item('boot',[0,-.79,.06],'legRight'),
  item('upperArm',[0,-.17,0],'armLeft'),item('forearm',[0,-.49,0],'armLeft'),item('hand',[0,-.67,0],'armLeft'),
  item('upperArm',[0,-.17,0],'armRight'),item('forearm',[0,-.49,0],'armRight'),item('hand',[0,-.67,0],'armRight'),
  item('eye',[-.075,1.69,.189]),item('eye',[.075,1.69,.189])
 ]},
 hero:{extends:'civilian',height:1.76,parts:[item('breastplate',[0,1.22,.155]),item('cape',[0,1.12,-.22])]},
 guard:{extends:'civilian',height:1.81,parts:[item('breastplate',[0,1.22,.155],'body','iron')]},
 royal:{extends:'civilian',height:1.75,parts:[item('cape',[0,1.13,-.22],'body','royal')]}
});
export function expandHumanBom(id){
 const own=HUMAN_BOMS[id];if(!own)throw Error('Unknown humanoid BOM: '+id);
 const base=own.extends?expandHumanBom(own.extends).parts:[];
 const parts=[...base,...own.parts];
 for(const p of parts)if(!HUMAN_PARTS[p.partId])throw Error('Missing human part '+p.partId);
 return {id,height:own.height,parts:parts.map((p,i)=>({...p,id:id+':'+i}))};
}
