import * as THREE from 'three';

/**
 * V120 independent neutral portrait head. It has NO animations, wig, body,
 * character rig, or destructive dependency on v119 / the external donor GLB.
 *
 * Coordinates in metres: Y up, face forward +Z, facial midline X=0.
 * Stable indexed topology, UV and named rest landmarks support later
 * FACS morph targets / eyelid and mouth rigs WITHOUT reordering vertices.
 *
 * The portrait is hand-built as a 3D interpretation of the user reference:
 * this is NOT a photogrammetric scan or a copy of an unavailable Hi3D/Alina GLB.
 */
export const NEUTRAL_FACE_V120=Object.freeze({
 version:120,source:'original-parametric-neutral-face',
 expressionState:'neutral-only; all future animation channels unset',
 license:'project-original',units:'metre',forward:'+Z',
 latitudes:112,longitudes:144,
 intendedGender:'female',futureRig:'stable-original-vertex-index-and-region-groups',
 referenceAnalysis:'eyebrow/eyes/nose/lips/cheek/jaw positions from supplied two-view art'
});
const PI=Math.PI;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,x)=>{const q=clamp((x-a)/(b-a));return q*q*(3-2*q)};
const gaussian=(x,y,cx,cy,rx,ry)=>Math.exp(-.5*(((x-cx)/rx)**2+((y-cy)/ry)**2));
const sample=(arr,u)=>{
 if(u<=arr[0][0])return arr[0][1];
 for(let i=1;i<arr.length;i++){
  const [b,v]=arr[i],p=arr[i-1];
  if(u<=b){const t=smooth(0,1,(u-p[0])/(b-p[0]));return p[1]+(v-p[1])*t;}
 }
 return arr[arr.length-1][1];
};
const faceWidth=[
 [0,.011],[.045,.024],[.12,.040],[.20,.053],[.32,.064],[.42,.074],
 [.51,.079],[.62,.076],[.73,.077],[.86,.080],[.92,.064],[.97,.034],[1,.002]
];
const skullDepth=[
 [0,.027],[.05,.046],[.16,.063],[.28,.071],[.42,.081],[.59,.082],
 [.76,.081],[.89,.074],[.965,.040],[1,.002]
];
function headBase(u,theta){
 const rX=sample(faceWidth,u),rZ=sample(skullDepth,u);
 const y=.276*(u-.49),x=rX*Math.sin(theta);
 // The face is softly anterior with an oval skull, no carved cheek holes.
 const z=-.003+rZ*Math.cos(theta)+(.008*(1-u))*smooth(.18,.42,u);
 return {x,y,z};
}
const depthField=(x,u)=>{
 const ax=Math.abs(x);
 const cheek=.0085*(gaussian(x,u,-.044,.46,.025,.091)+gaussian(x,u,.044,.46,.025,.091));
 const malar=.0035*(gaussian(x,u,-.040,.56,.027,.07)+gaussian(x,u,.040,.56,.027,.07));
 const subcheek=.0045*(gaussian(x,u,-.044,.345,.029,.085)+gaussian(x,u,.044,.345,.029,.085));
 const noseBridge=.011*gaussian(x,u,0,.603,.013,.099);
 const noseTip=.021*gaussian(x,u,0,.464,.014,.038);
 const noseAlar=.008*(gaussian(x,u,-.016,.445,.009,.026)+gaussian(x,u,.016,.445,.009,.026));
 const columella=.006*gaussian(x,u,0,.417,.010,.027);
 const eyeSockets=-.0085*(gaussian(x,u,-.034,.682,.021,.028)+gaussian(x,u,.034,.682,.021,.028));
 const lowerLids=.0025*(gaussian(x,u,-.034,.645,.023,.011)+gaussian(x,u,.034,.645,.023,.011));
 const upperLids=.003*(gaussian(x,u,-.034,.710,.020,.010)+gaussian(x,u,.034,.710,.020,.010));
 const upperLip=.0060*gaussian(x,u,0,.323,.024,.013);
 const lowerLip=.0072*gaussian(x,u,0,.288,.025,.018);
 const mouthCrease=-.0030*gaussian(x,u,0,.305,.024,.006);
 const filtrum=.0025*(gaussian(x,u,-.008,.365,.004,.018)+gaussian(x,u,.008,.365,.004,.018));
 const chin=.0050*gaussian(x,u,0,.174,.031,.055);
 const jaw=.0025*(gaussian(x,u,-.045,.24,.024,.070)+gaussian(x,u,.045,.24,.024,.070));
 return {depth:cheek+malar+subcheek+noseBridge+noseTip+noseAlar+columella+
  eyeSockets+lowerLids+upperLids+upperLip+lowerLip+mouthCrease+filtrum+chin+jaw,
  cheek,mouth:upperLip+lowerLip,eyes:eyeSockets,nose:noseBridge+noseTip};
};
function surface(x,u){
 const rx=sample(faceWidth,u),theta=Math.asin(clamp(x/Math.max(.0001,rx),-.96,.96));
 const p=headBase(u,theta);
 const frontal=smooth(.04,.65,Math.cos(theta));
 return p.z+depthField(x,u).depth*frontal;
}
function colorFor(x,u,frontal){
 // Subtle vertex-color blush and lip tone. No detached lipstick cards.
 const cheek=(gaussian(x,u,.046,.49,.024,.045)+gaussian(x,u,-.046,.49,.024,.045))*frontal;
 const lip=gaussian(x,u,0,.308,.024,.023)*frontal;
 const baseline=new THREE.Color(0xd9ab9d);
 const pink=new THREE.Color(0xc77f82);
 const blush=new THREE.Color(0xd99b97);
 baseline.lerp(blush,clamp(cheek*.21));
 baseline.lerp(pink,clamp(lip*.56));
 return baseline;
}
function buildSkin(){
 const N=NEUTRAL_FACE_V120.longitudes,M=NEUTRAL_FACE_V120.latitudes;
 const xyz=[],uv=[],color=[],index=[],zones={leftEye:[],rightEye:[],mouth:[],nose:[],leftCheek:[],rightCheek:[]};
 const landmarks=[];
 for(let row=0;row<=M;row++){
  const u=.005+.99*row/M;
  for(let c=0;c<N;c++){
   const theta=(c/N)*2*PI-PI;
   const p=headBase(u,theta),front=Math.cos(theta);
   const face=smooth(.08,.63,front);
   const d=depthField(p.x,u);
   p.z+=face*d.depth;
   xyz.push(p.x,p.y,p.z);
   uv.push(c/N,u);
   const col=colorFor(p.x,u,face);
   color.push(col.r,col.g,col.b);
   const k=row*N+c;
   if(front>.26){
    if(gaussian(p.x,u,-.034,.684,.029,.051)>.24)zones.leftEye.push(k);
    if(gaussian(p.x,u,.034,.684,.029,.051)>.24)zones.rightEye.push(k);
    if(gaussian(p.x,u,0,.307,.034,.061)>.17)zones.mouth.push(k);
    if(gaussian(p.x,u,0,.50,.022,.13)>.18)zones.nose.push(k);
    if(gaussian(p.x,u,-.047,.45,.026,.12)>.15)zones.leftCheek.push(k);
    if(gaussian(p.x,u,.047,.45,.026,.12)>.15)zones.rightCheek.push(k);
   }
  }
 }
 for(let row=0;row<M;row++){
  for(let col=0;col<N;col++){
   const a=row*N+col,b=row*N+(col+1)%N,c=(row+1)*N+col,d=(row+1)*N+(col+1)%N;
   // Winding: +Z outward on the front; both sides use same quad ordering.
   index.push(a,b,c,b,d,c);
  }
 }
 // Cap skull poles, do not leave holes in the neutral skin.
 const bottom=xyz.length/3;
 xyz.push(0,.276*(.005-.49),-.003);uv.push(.5,0);
 color.push(.83,.66,.61);
 const top=xyz.length/3;
 xyz.push(0,.276*(.995-.49),-.003);uv.push(.5,1);
 color.push(.83,.66,.61);
 for(let c=0;c<N;c++){
  const next=(c+1)%N;
  index.push(bottom,next,c);
  index.push(top,M*N+c,M*N+next);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(xyz.length),3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
 g.setIndex(index);
 g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();
 // These named sets are saved in glTF extras, and stay stable in v120.
 const regionCounts={};for(const [key,v]of Object.entries(zones))regionCounts[key]=v.length;
 g.userData={v120:true,neutralOnly:true,vertexCount:xyz.length/3,
  fixedTopology:true,regionVertexIds:zones,regionCounts,
  features:'nose/cheeks/lips live in one connected indexed skin surface',
  noMorphTargetsYet:true};
 return g;
}
function eyeDisk(side){
 const x0=side*.034,u0=.681;
 const w=.0201,h=.0105;
 const positions=[],indices=[],normals=[],uvs=[];
 // Elliptical almond is parametric, and shares coordinates with cheek surface.
 const rows=8,columns=50;
 for(let r=0;r<=rows;r++){
  const t=r/rows;
  for(let j=0;j<columns;j++){
   const a=2*PI*j/columns;
   const taper=Math.pow(1-t*t,.3);
   const x=x0+w*t*Math.cos(a);
   const eyeHeight=h*t*Math.sin(a)*(1-.13*side*Math.cos(a));
   const y=u0+eyeHeight/.276;
   const z=surface(x,y)+.0017+(.0032*(1-t*t));
   positions.push(x,.276*(y-.49),z);
   uvs.push(.5+.5*t*Math.cos(a),.5+.5*t*Math.sin(a));
  }
 }
 for(let r=0;r<rows;r++)for(let j=0;j<columns;j++){
  const a=r*columns+j,b=r*columns+(j+1)%columns,
        c=(r+1)*columns+j,d=(r+1)*columns+(j+1)%columns;
  indices.push(a,b,c,b,d,c);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 const white=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({
  color:0xece1d7,roughness:.32,metalness:0,side:THREE.DoubleSide
 }));
 white.name=side<0?'EYE_LEFT_NEUTRAL':'EYE_RIGHT_NEUTRAL';
 white.userData={v120Feature:'eye-white',futureEyeRig:true,side};
 return white;
}
function iris(side){
 const x=side*.034-side*.002,u=.680;
 const group=new THREE.Group();group.name=side<0?'IRIS_L_NEUTRAL':'IRIS_R_NEUTRAL';
 const z=surface(x,u)+.007;
 for(const [r,d,c] of [
  [.0067,.0006,0x49392f],[.0049,.0014,0x775943],
  [.0030,.0025,0x19181b],[.00105,.0034,0xf4ece4]
 ]){
  const geom=new THREE.CircleGeometry(r,48);
  const m=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({
   color:c,roughness:d>.002?.25:.48,side:THREE.DoubleSide
  }));
  m.position.set(x+(d>.003?.0028:0),.276*(u-.49)+(d>.003?.0025:0),z+d);
  group.add(m);
 }
 return group;
}
function curvedStrip(name,points,radius,color){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const mesh=new THREE.Mesh(
  new THREE.TubeGeometry(curve,34,radius,6,false),
  new THREE.MeshStandardMaterial({color,roughness:.84})
 );
 mesh.name=name;
 return mesh;
}
function eyeLids(side){
 const x0=side*.034,u=.681,w=.020,h=.0106;
 const group=new THREE.Group();group.name=side<0?'EYELID_L_NEUTRAL':'EYELID_R_NEUTRAL';
 const upper=[],lower=[],brow=[];
 for(let i=0;i<=16;i++){
  const t=-1+i/8,shape=Math.sqrt(Math.max(0,1-t*t));
  const x=x0+w*t;
  const upperY=u+(h/.276)*shape*(1+.10*t);
  const lowerY=u-(h/.276)*shape*(.76+.08*t);
  upper.push([x,.276*(upperY-.49),surface(x,upperY)+.006]);
  lower.push([x,.276*(lowerY-.49),surface(x,lowerY)+.004]);
  const bx=x0+w*t*1.04,by=u+.103+.011*shape+.002*t;
  brow.push([bx,.276*(by-.49),surface(bx,by)+.0023]);
 }
 group.add(curvedStrip('UPPER_LID_'+(side<0?'L':'R'),upper,.0010,0x694e4a));
 group.add(curvedStrip('LOWER_LID_'+(side<0?'L':'R'),lower,.00054,0x966d67));
 group.add(curvedStrip('BROW_'+(side<0?'L':'R'),brow,.00113,0x8a7065));
 return group;
}
function ears(side){
 const group=new THREE.Group();group.name=side<0?'EAR_L':'EAR_R';
 const ear=new THREE.Mesh(new THREE.SphereGeometry(1,28,20),
  new THREE.MeshStandardMaterial({color:0xd5a398,roughness:.78}));
 ear.scale.set(.011,.022,.009);
 ear.position.set(side*.083,.276*(.565-.49),-.009);
 ear.rotation.z=-side*.12;
 ear.name='EAR_SURFACE_'+side;
 group.add(ear);
 const concha=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),
  new THREE.MeshStandardMaterial({color:0xb88680,roughness:.9}));
 concha.scale.set(.0018,.0105,.0050);
 concha.position.set(side*.092,.276*(.570-.49),-.005);
 group.add(concha);
 return group;
}
function lipsContour(){
 const group=new THREE.Group();group.name='LIPS_NEUTRAL_NO_MORPH';
 const corners=24;
 const line=[];
 for(let i=0;i<=corners;i++){
  const t=-1+2*i/corners;
  const x=t*.028;
  const u=.305+.004*(1-t*t)*Math.cos(t*PI);
  line.push([x,.276*(u-.49),surface(x,u)+.0009]);
 }
 group.add(curvedStrip('MOUTH_SEAL_REST',line,.0005,0x986464));
 return group;
}
/**
 * Standalone, newly generated head geometry. The output is deliberately
 * NOT passed into the legacy 3490-vertex morph pipeline.
 */
export function createNeutralFaceV120({showEyes=true}={}){
 const root=new THREE.Group();root.name='V120_ORIGINAL_NEUTRAL_FACE_MASTER';
 const skin=new THREE.Mesh(buildSkin(),new THREE.MeshPhysicalMaterial({
  color:0xffffff,vertexColors:true,roughness:.76,metalness:0,
  clearcoat:.04,clearcoatRoughness:.84,side:THREE.DoubleSide
 }));
 skin.name='V120_SKIN_CONNECTED_NEUTRAL';
 skin.userData={kind:'skin',futureMorphTargetBase:true,
  unalteredRestPosition:true,facialZones:Object.keys(skin.geometry.userData.regionVertexIds)};
 root.add(skin);
 const parts=new THREE.Group();parts.name='V120_FUTURE_ANIMATION_PARTS';
 for(const side of [-1,1]){
  parts.add(eyeDisk(side),iris(side),eyeLids(side),ears(side));
 }
 parts.add(lipsContour());
 parts.visible=showEyes;
 root.add(parts);
 const metrics={
  vertices:skin.geometry.getAttribute('position').count,
  triangles:skin.geometry.getIndex().count/3,
  eyeRegionVertices:skin.geometry.userData.regionCounts.leftEye+
                    skin.geometry.userData.regionCounts.rightEye,
  mouthRegionVertices:skin.geometry.userData.regionCounts.mouth,
  meshParts:parts.children.length+1,
  hasMorphTargets:false,
  sourceGeometryUsed:false,
  hairIncluded:false,
  rigIncluded:false
 };
 root.userData={...NEUTRAL_FACE_V120,metrics,
  futureExpressionChannels:['blinkLeft','blinkRight','eyeLook','smile',
   'jawOpen','mouthNarrow','browRaise','cheekRaise'],
  futureChannelsStatus:'reserved names only; all channels deliberately unimplemented',
  restLandmarks:{
   leftEye:[-.034,.276*(.681-.49),surface(-.034,.681)],
   rightEye:[.034,.276*(.681-.49),surface(.034,.681)],
   noseTip:[0,.276*(.464-.49),surface(0,.464)],
   upperLip:[0,.276*(.323-.49),surface(0,.323)],
   lowerLip:[0,.276*(.288-.49),surface(0,.288)],
   chin:[0,.276*(.045-.49),surface(0,.045)]
  }};
 return {root,skin,parts,metrics};
}
