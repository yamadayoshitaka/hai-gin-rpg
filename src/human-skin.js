/**
 * v43 anatomical character surface (procedural high-detail LOD).
 * Geometry is shared by BOM actors' topology and driven by the existing joint pivots.
 * Keep coordinates in the canonical 1.96m rig space.
 */
export function attachSmoothHumanSkin(T, root, joints, material) {
 const bones=[joints.spine,joints.neck,joints.head,
  joints.hips[0],joints.knees[0],joints.ankles[0],
  joints.hips[1],joints.knees[1],joints.ankles[1],
  joints.shoulders[0],joints.elbows[0],joints.wrists[0],
  joints.shoulders[1],joints.elbows[1],joints.wrists[1]];
 const pos=[],uv=[],idx=[],si=[],sw=[],groups=[];
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const weight=(a,b,t)=>[[a,1-clamp(t)],[b,clamp(t)]];
 function surface(rings,segments,matId,weights,phase=0){
  const start=idx.length,first=pos.length/3;
  for(let i=0;i<rings.length;i++){
   const r=rings[i],v=i/(rings.length-1);
   for(let j=0;j<=segments;j++){
    const u=j/segments,theta=u*Math.PI*2+phase,cs=Math.cos(theta),sn=Math.sin(theta);
    const width=r.rx*(1+.025*Math.cos(theta*4+v*11));
    const depth=r.rz*(1+.018*Math.sin(theta*3+v*14));
    const asym=(r.anatomy||0)*Math.sin(theta)*Math.sin(v*Math.PI);
    pos.push(r.x+width*cs,r.y+asym,r.z+depth*sn);
    uv.push(u,v);
    const w=weights(v,r.y);
    si.push(w[0][0],w[1][0],0,0);sw.push(w[0][1],w[1][1],0,0);
   }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){
   const a=first+i*(segments+1)+j,b=a+segments+1;
   idx.push(a,b,a+1,a+1,b,b+1);
  }
  groups.push({start,count:idx.length-start,materialIndex:matId});
 }
 function sample(steps,min,max,fn){return Array.from({length:steps+1},(_,i)=>{const t=i/steps;return fn(mix(min,max,t),t);});}
 // Anatomical torso: pelvic crests, pinched waist, ribcage, pectoral and trapezius slopes.
 surface(sample(48,.84,1.59,(y,t)=>{
  const waist=Math.exp(-Math.pow((y-1.08)/.13,2));
  const chest=Math.exp(-Math.pow((y-1.34)/.19,2));
  const shoulder=Math.exp(-Math.pow((y-1.49)/.105,2));
  return {y,x:0,z:-.008+chest*.015,rx:.166-.021*waist+.073*chest+.025*shoulder,
   rz:.123-.008*waist+.042*chest-.04*shoulder,anatomy:.005};
 }),36,0,(_,y)=>weight(0,1,(y-1.39)/.19));
 // Smooth neck volume, narrower than the shoulders.
 surface(sample(16,1.53,1.69,(y,t)=>({y,x:0,z:.003,rx:mix(.097,.063,t),rz:mix(.087,.06,t)})),
 24,2,(_,y)=>weight(1,2,(y-1.63)/.065));
 // Arms: upper arms attach at shoulder; elbow, forearm muscle and tapered wrist.
 for(let side=0;side<2;side++){
  const sign=side?1:-1,shoulder=side?12:9,elbow=side?13:10,wrist=side?14:11;
  surface(sample(50,.70,1.44,(y,t)=>{
   const deltoid=Math.exp(-Math.pow((y-1.39)/.12,2));
   const forearm=Math.exp(-Math.pow((y-.92)/.18,2));
   const elbowDip=Math.exp(-Math.pow((y-1.075)/.055,2));
   return {y,x:sign*(.257+.017*deltoid),z:-.004,
    rx:.051+.052*deltoid+.022*forearm-.01*elbowDip,
    rz:.049+.038*deltoid+.018*forearm-.008*elbowDip};
  }),24,0,(_,y)=>y>1.07?weight(elbow,shoulder,(y-1.07)/.24):weight(wrist,elbow,(y-.72)/.30));
  // Separate five-finger hand geometry stays on the wrist joint.
  const indexBase=side?14:11;
  surface(sample(12,.57,.735,(y,t)=>({y,x:sign*.258,z:.021+(.04*t),rx:.052*(.88+.12*t),rz:.023+.017*t})),
   16,2,()=>[[indexBase,1],[indexBase,0]]);
  for(let finger=0;finger<5;finger++){
   const fx=sign*.258+(finger-2)*.020,depth=finger===0?.060:.066;
   const y0=finger===0?.66:.588, span=finger===0?.094:.083+(.013*(2-Math.abs(finger-2)));
   surface(sample(8,y0-span,y0,(y,t)=>({
    y,x:fx+(finger===0?sign*(1-t)*.018:0),z:depth+(finger===0?(1-t)*.03:0),
    rx:mix(.005,.010,t),rz:mix(.005,.011,t)
   })),10,2,()=>[[indexBase,1],[indexBase,0]]);
  }
  // Leg profiles: gluteal hip, quadriceps, knee, calf and ankle contour.
  const hip=side?6:3,knee=side?7:4,ankle=side?8:5;
  surface(sample(60,.07,.91,(y,t)=>{
   const thigh=Math.exp(-Math.pow((y-.70)/.24,2));
   const calf=Math.exp(-Math.pow((y-.31)/.135,2));
   const kneeIndent=Math.exp(-Math.pow((y-.48)/.067,2));
   const r=.061+.076*thigh+.031*calf-.012*kneeIndent;
   return {y,x:sign*(.119+.021*thigh),z:.006+calf*.014,
    rx:r,rz:r*(.87+.075*thigh),anatomy:.004};
  }),30,1,(_,y)=>y>.47?weight(knee,hip,(y-.47)/.33):weight(ankle,knee,(y-.085)/.34));
  // Shaped shoe with a toe box projecting forward instead of a spherical boot.
  surface(sample(13,.024,.20,(y,t)=>({
   y,x:sign*.119,z:.059+.047*(1-t),
   rx:mix(.109,.078,t),rz:mix(.174,.078,t)
  })),20,3,()=>[[ankle,1],[ankle,0]]);
 }
 // Facial/head geometry: jaw, cheekbones, brow ridge, forehead and skull silhouette.
 surface(sample(54,1.638,1.948,(y,t)=>{
  const forehead=Math.exp(-Math.pow((y-1.839)/.094,2));
  const cheek=Math.exp(-Math.pow((y-1.759)/.050,2));
  const jaw=clamp((y-1.64)/.10);
  const crown=clamp((1.946-y)/.066);
  return {y,x:0,z:.004+cheek*.009,
   rx:(.058+.056*forehead+.044*cheek)*Math.min(1,Math.sqrt(Math.max(.001,jaw))*1.12,Math.sqrt(Math.max(.001,crown))*1.25),
   rz:(.069+.043*forehead+.032*cheek)*Math.min(1,Math.sqrt(Math.max(.001,jaw))*1.15,Math.sqrt(Math.max(.001,crown))*1.3)};
 }),40,2,()=>[[2,1],[2,0]]);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
 geometry.setIndex(idx);geometry.computeVertexNormals();
 for(const g of groups)geometry.addGroup(g.start,g.count,g.materialIndex);
 const mats=[material('linen'),material('leather'),material('skin'),material('walnut')];
 const mesh=new T.SkinnedMesh(geometry,mats);
 mesh.name='high-detail-anatomical-skin';mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.frustumCulled=false;root.add(mesh);root.updateMatrixWorld(true);
 mesh.bind(new T.Skeleton(bones));
 mesh.userData.skinDrivenBy='human-joint-bom';
 mesh.userData.vertexCount=pos.length/3;
 mesh.userData.characterMeshVersion=43;
 return mesh;
}
