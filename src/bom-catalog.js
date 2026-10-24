/** Hierarchical BOM catalog. Every visual assembly resolves catalog part IDs. */
export const PART_CATALOG=Object.freeze({
 timber:{shape:'box',size:[1,.2,.2],material:'oak'},
 plank:{shape:'box',size:[2,.12,.6],material:'oak'},
 stone:{shape:'box',size:[1,.5,.35],material:'stone'},
 metal:{shape:'box',size:[.12,1,.12],material:'iron'},
 fabric:{shape:'box',size:[1,.09,1],material:'linen'},
 glass:{shape:'box',size:[1,1,.08],material:'glass'},
 brass:{shape:'box',size:[.12,.12,.12],material:'brass'},
 roof:{shape:'box',size:[2,.18,1],material:'tile'},
 column:{shape:'cylinder',size:[.24,2.8,.24],material:'oak'},
 leg:{shape:'box',size:[.2,1,.2],material:'oak'},
 lamp:{shape:'box',size:[.6,.6,.6],material:'lamp'},
 barrel:{shape:'cylinder',size:[1.2,1.5,1.2],material:'oak'}
});
const P=(partId,position,extra={})=>({partId,position,...extra});
export const OBJECT_BOMS=Object.freeze({
 table_low:{parts:[P('plank',[0,1.1,0]),...[-1,1].flatMap(x=>[-1,1].map(z=>P('leg',[x*.75,.53,z*.46])))],collision:[3.4,1.2,2.6]},
 desk:{parts:[P('plank',[0,1.3,0]),...[-1,1].flatMap(x=>[-1,1].map(z=>P('leg',[x*.8,.62,z*.42])))],collision:[3.7,1.5,2.3]},
 chair_A_wood:{parts:[P('plank',[0,.7,0]),P('plank',[0,1.4,-.48],{rotation:[Math.PI/2,0,0]}),...[-1,1].flatMap(x=>[-1,1].map(z=>P('leg',[x*.43,.37,z*.39])))],collision:[1.25,1.6,1.2]},
 bed_single_A:{parts:[P('plank',[0,.5,0]),P('fabric',[0,.83,0]),P('fabric',[-1,.99,0],{material:'linen'})],collision:[3.5,1.1,2.6]},
 counter:{parts:[P('plank',[0,1.35,0]),P('plank',[0,.7,-.4]),P('plank',[0,.7,.4]),...[-1,1].map(x=>P('leg',[x*2.35,.7,0]))],collision:[5.8,1.5,1.8]},
 shelf_A_big:{parts:[...[-1,1].map(x=>P('column',[x*1.45,1.55,0])),...[.45,1.4,2.35].map(y=>P('plank',[0,y,0]))],collision:[3.4,3.2,1.5]},
 cabinet_medium:{alias:'shelf_A_big'},
 barrel:{parts:[P('barrel',[0,.75,0])],collision:[1.2,1.5,1.2]},
 chest:{parts:[P('plank',[0,.48,0]),P('plank',[0,1,0],{material:'brass'})],collision:[1.9,1.1,1.15]},
 throne:{parts:[P('plank',[0,.62,0]),P('plank',[0,2.2,-.85],{rotation:[Math.PI/2,0,0],material:'royal'}),...[-1,1].map(x=>P('column',[x*1.6,1.4,0],{material:'brass'}))],collision:[3.5,4,2.4]},
 pew:{parts:[P('plank',[0,.72,0]),P('plank',[0,1.3,-.7],{rotation:[Math.PI/2,0,0]})],collision:[4.8,1.6,1.8]},
 weapon_rack:{alias:'weapon-rack'},
 'weapon-rack':{parts:[P('plank',[0,1.7,0]),...[-1,0,1].map(x=>P('metal',[x,1.75,.2]))],collision:[3.2,2.5,.8]},
 'armor-stand':{parts:[P('column',[0,1.3,0]),P('metal',[0,1.9,0])],collision:[1.8,2.8,1]},
 'lamp_standing':{parts:[P('column',[0,1.45,0],{material:'brass'}),P('lamp',[0,3.1,0])],collision:[.8,3.5,.8]},
 fireplace:{parts:[P('stone',[0,1.5,-.4]),P('stone',[0,.4,0],{material:'charcoal'})],collision:[4,3.5,1]},
 altar:{parts:[P('stone',[0,.8,0]),P('brass',[0,1.7,0])],collision:[5.4,1.8,2]},
 banner:{parts:[P('fabric',[0,2.5,0],{material:'royal'})],collision:null},
 piano:{parts:[P('plank',[0,1.1,0],{material:'walnut'}),P('plank',[0,1.7,-.55],{material:'walnut'})],collision:[4.5,2.2,2.2]},
 king:{parts:[P('fabric',[0,1.3,0],{material:'royal'}),P('brass',[0,3.25,0])],collision:[1.6,3.4,1]},
 guard:{parts:[P('metal',[0,1.4,0]),P('brass',[0,2.9,0])],collision:[1.4,3.2,1]},
 carpet:{parts:[P('fabric',[0,.055,0],{material:'royal'})],collision:null},
 'stair-marker':{parts:[P('stone',[0,.25,0])],collision:null},
 'window-ornament':{parts:[P('timber',[-.57,0,0],{rotation:[0,0,Math.PI/2]}),P('timber',[.57,0,0],{rotation:[0,0,Math.PI/2]}),P('plank',[0,.72,0]),P('plank',[0,-.72,0]),P('glass',[0,0,.05])],collision:null},
 'door-ornament':{parts:[P('column',[-1.05,1.4,0]),P('column',[1.05,1.4,0]),P('plank',[0,2.8,0]),P('brass',[.58,1.35,.14])],collision:null},
 'shop-ornament':{parts:[P('plank',[0,.25,0]),P('brass',[-.83,.25,.16]),P('brass',[.83,.25,.16])],collision:null}
});
export function resolveBom(id){
 const seen=new Set();let key=id;
 while(OBJECT_BOMS[key]?.alias){if(seen.has(key))throw Error('Cyclic BOM alias '+id);seen.add(key);key=OBJECT_BOMS[key].alias;}
 const bom=OBJECT_BOMS[key];if(!bom)throw Error('Unknown BOM: '+id);
 for(const part of bom.parts){if(!PART_CATALOG[part.partId])throw Error('Missing catalog part '+part.partId);}
 return {...bom,id:key};
}
export function validateBomCatalog(){
 const errors=[];
 for(const key of Object.keys(OBJECT_BOMS))try{resolveBom(key);}catch(e){errors.push(key+': '+e.message);}
 return errors;
}
