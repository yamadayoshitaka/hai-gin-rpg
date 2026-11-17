/**
 * Physically timed nonhuman effects for the m001-derived flame wolf and
 * m007-derived cat family. Only the active high/source actor allocates
 * three pooled GPU meshes. 1000v1000 low/medium models never allocate FX.
 * m001's original reference effects remain unchanged.
 */
const supported=new Set(['m002','m007','m008','m009','m010']);
const colors=Object.freeze({
 m002:0xff7a37,m007:0xa6def1,m008:0xe5b46b,
 m009:0xc6aa75,m010:0xb99cfc
});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,t)=>{
 const u=clamp((t-a)/Math.max(.001,b-a));
 return u*u*(3-2*u);
};
const pulse=(v,a,b,c)=>smooth(a,b,v)*(1-smooth(b,c,v));
function makeFx(THREE,geometry,color,name){
 const material=new THREE.MeshBasicMaterial({
   color,transparent:true,opacity:0,depthWrite:false,
   side:THREE.DoubleSide,toneMapped:false
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=name;mesh.visible=false;mesh.renderOrder=3;
 mesh.userData.ownedEffectMaterial=true;
 mesh.userData.ownedGeometry=true;
 mesh.userData.beastActionFx=true;
 return mesh;
}
function buildSlash(THREE){
 // One tapered, parallel three-claw arc for a physical paw swing.
 const vertices=[],indices=[];
 for(let claw=0;claw<3;claw++){
  const offset=vertices.length/3;
  for(let i=0;i<=10;i++){
   const t=i/10;
   const x=(claw-1)*.124+.16*Math.sin(Math.PI*t*.77);
   const y=.22-.49*t+.07*Math.sin(Math.PI*t);
   const r=.017*(1-t)+.0025;
   vertices.push(x-r,y,0,x+r,y,.008);
  }
  for(let i=0;i<10;i++){
   const base=offset+i*2;
   indices.push(base,base+1,base+2,base+1,base+3,base+2);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setIndex(indices);g.computeVertexNormals();return g;
}
function ensure(model){
 const data=model.userData;
 if(data.referenceBeastFx)return data.referenceBeastFx;
 if(!supported.has(data.speciesId)||
    !['source','high'].includes(data.detail)||
    data.disableMonsterActionEffects)return null;
 const T=model.beastFxThree;
 if(!T)return null;
 const color=colors[data.speciesId]||0xc7d0d8;
 const slash=makeFx(T,buildSlash(T),color,'reference-beast-claw-swing');
 slash.position.set(0,1.12,1.11);
 const impact=makeFx(T,new T.TorusGeometry(.31,.020,7,36),
   color,'reference-beast-jump-landing');
 impact.rotation.x=-Math.PI/2;
 impact.position.set(0,.045,.50);
 const dust=makeFx(T,new T.TorusGeometry(.17,.018,7,30),
   data.speciesId==='m002'?0xb88862:0x9c9c9c,
   'reference-beast-walk-dust');
 dust.rotation.x=-Math.PI/2;
 dust.position.set(0,.05,.75);
 model.add(slash,impact,dust);
 return data.referenceBeastFx={slash,impact,dust};
}
const reveal=(mesh,power,scale)=>{
 mesh.visible=power>.015;
 mesh.material.opacity=clamp(power);
 mesh.scale.setScalar(scale);
};
export function updateReferenceBeastFx(model,{
 action='idle',progress=0,time=0
}={}){
 if(!model||!supported.has(model.userData?.speciesId))return false;
 const active=['walk','run','attack','special','leap',
   'roar','hit','dodge'].includes(action);
 const fx=model.userData.referenceBeastFx||(active?ensure(model):null);
 if(!fx)return false;
 const p=clamp(progress);
 const slash=(action==='attack'||action==='special')?
   pulse(p,.22,.46,.73):0;
 // The beast's forward paw already hits, then a ground ring travels
 // outward ONLY during the leap landing or a heavy special impact.
 const land=action==='leap'?pulse(p,.76,.84,.96):
   action==='special'?pulse(p,.38,.52,.72):0;
 const stride=action==='walk'?.12+.09*Math.pow(Math.sin(time*7),2):
   action==='run'?.18+.16*Math.pow(Math.sin(time*13),2):
   action==='leap'?pulse(p,.15,.28,.37)*.25+
     pulse(p,.74,.85,.96)*.35:
   action==='dodge'?.24*pulse(p,.14,.32,.81):0;
 reveal(fx.slash,slash*.72,.67+.48*p);
 reveal(fx.impact,land*.66,.53+1.65*p);
 reveal(fx.dust,stride,.72+.23*Math.abs(Math.sin(time*10)));
 return true;
}
export const referenceBeastFxBudget=model=>{
 const fx=model?.userData?.referenceBeastFx;
 return {meshes:fx?3:0,visible:fx?
   Object.values(fx).filter(m=>m.visible).length:0};
};
