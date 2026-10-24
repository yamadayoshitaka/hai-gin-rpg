/**
 * Human wire-mesh BOM v45.
 * Source of truth for editable surface topology: each part defines cross-section rings,
 * triangulation density, UV domain, material slot and bone-weight strategy.
 * Dimensions are canonical rig metres. A rendered mesh is an instance of this BOM.
 */
const part=(id,values)=>Object.freeze({id,topology:'quad-ring-triangulated',uv:'cylindrical',...values});
export const HUMAN_MESH_BOM=Object.freeze([
 part('torso',{material:'linen',segments:36,rings:49,y:[.84,1.59],bone:[0,1],transition:[1.39,1.58],shape:'torso'}),
 part('neck',{material:'skin',segments:24,rings:17,y:[1.53,1.69],bone:[1,2],transition:[1.63,1.695],shape:'neck'}),
 part('head',{material:'skin',segments:40,rings:55,y:[1.638,1.948],bone:[2,2],shape:'head'}),
 ...[-1,1].flatMap((sign,index)=>[
  part('arm-'+index,{material:'linen',segments:24,rings:51,y:[.70,1.44],bone:[index?14:11,index?13:10,index?12:9],shape:'arm',sign}),
  part('palm-'+index,{material:'skin',segments:16,rings:13,y:[.57,.735],bone:[index?14:11],shape:'palm',sign}),
  ...Array.from({length:5},(_,finger)=>part('finger-'+index+'-'+finger,{
   material:'skin',segments:10,rings:9,y:[(finger===0?.66:.588)-(finger===0?.094:.083+.013*(2-Math.abs(finger-2))),finger===0?.66:.588],
   bone:[index?14:11],shape:'finger',sign,finger
  })),
  part('leg-'+index,{material:'leather',segments:30,rings:61,y:[.07,.91],bone:[index?8:5,index?7:4,index?6:3],shape:'leg',sign}),
  part('shoe-'+index,{material:'walnut',segments:20,rings:14,y:[.024,.20],bone:[index?8:5],shape:'shoe',sign})
 ])
]);
const exp=(v,c,w)=>Math.exp(-Math.pow((v-c)/w,2));
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=v=>Math.max(0,Math.min(1,v));
export function meshBomRing(part,t){
 const y=mix(part.y[0],part.y[1],t),s=part.sign||1,f=part.finger||0;
 switch(part.shape){
 case 'torso':{const waist=exp(y,1.08,.13),chest=exp(y,1.34,.19),shoulder=exp(y,1.49,.105);
  return {x:0,y,z:-.008+chest*.015,rx:.166-.021*waist+.073*chest+.025*shoulder,rz:.123-.008*waist+.042*chest-.04*shoulder};}
 case 'neck':return {x:0,y,z:.003,rx:mix(.097,.063,t),rz:mix(.087,.06,t)};
 case 'head':{const forehead=exp(y,1.839,.094),cheek=exp(y,1.759,.05),jaw=clamp((y-1.64)/.10),crown=clamp((1.946-y)/.066);
  const edge=Math.min(1,Math.sqrt(Math.max(.001,jaw))*1.12,Math.sqrt(Math.max(.001,crown))*1.25);
  return {x:0,y,z:.004+cheek*.009,rx:(.058+.056*forehead+.044*cheek)*edge,rz:(.069+.043*forehead+.032*cheek)*edge};}
 case 'arm':{const d=exp(y,1.39,.12),fore=exp(y,.92,.18),elbow=exp(y,1.075,.055);
  return {x:s*(.257+.017*d),y,z:-.004,rx:.051+.052*d+.022*fore-.01*elbow,rz:.049+.038*d+.018*fore-.008*elbow};}
 case 'palm':return {x:s*.258,y,z:.021+.04*t,rx:.052*(.88+.12*t),rz:.023+.017*t};
 case 'finger':return {x:s*.258+(f-2)*.020+(f===0?s*(1-t)*.018:0),y,z:(f===0?.060:.066)+(f===0?(1-t)*.03:0),rx:mix(.005,.010,t),rz:mix(.005,.011,t)};
 case 'leg':{const thigh=exp(y,.70,.24),calf=exp(y,.31,.135),knee=exp(y,.48,.067),r=.061+.076*thigh+.031*calf-.012*knee;
  return {x:s*(.119+.021*thigh),y,z:.006+calf*.014,rx:r,rz:r*(.87+.075*thigh)};}
 case 'shoe':return {x:s*.119,y,z:.059+.047*(1-t),rx:mix(.109,.078,t),rz:mix(.174,.078,t)};
 default:throw Error('Unknown mesh BOM shape '+part.shape);
 }
}
export function meshBomWeights(part,y){
 const b=part.bone;
 const blend=(a,c,t)=>[[a,1-clamp(t)],[c,clamp(t)]];
 if(b.length===1||b[0]===b[1])return [[b[0],1],[b[0],0]];
 if(b.length===2){const [lo,hi]=part.transition;return blend(b[0],b[1],(y-lo)/(hi-lo));}
 if(part.shape==='arm')return y>1.07?blend(b[1],b[2],(y-1.07)/.24):blend(b[0],b[1],(y-.72)/.30);
 if(part.shape==='leg')return y>.47?blend(b[1],b[2],(y-.47)/.33):blend(b[0],b[1],(y-.085)/.34);
 throw Error('Unknown skin strategy '+part.id);
}
export function validateHumanMeshBom(){
 const ids=new Set();
 for(const p of HUMAN_MESH_BOM){
  if(ids.has(p.id)||p.rings<2||p.segments<3||!p.bone.length||p.y[1]<=p.y[0])throw Error('Invalid human mesh BOM: '+p.id);
  ids.add(p.id);
  for(const t of [0,.5,1]){const r=meshBomRing(p,t);if(![r.x,r.y,r.z,r.rx,r.rz].every(Number.isFinite)||r.rx<=0||r.rz<=0)throw Error('Bad BOM ring '+p.id);}
 }
 return true;
}
