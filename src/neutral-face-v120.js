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
 [0,.009],[.14,.018],[.19,.026],[.26,.042],[.34,.059],[.42,.073],
 [.51,.081],[.62,.078],[.73,.078],[.85,.079],[.92,.068],[.975,.025],[1,.002]
];
const skullDepth=[
 [0,.025],[.14,.051],[.22,.059],[.34,.072],[.48,.076],[.61,.081],
 [.76,.082],[.89,.073],[.970,.036],[1,.002]
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
 const cheek=.0105*(gaussian(x,u,-.044,.49,.029,.090)+gaussian(x,u,.044,.49,.029,.090));
 const malar=.0047*(gaussian(x,u,-.040,.58,.029,.07)+gaussian(x,u,.040,.58,.029,.07));
 const subcheek=.0060*(gaussian(x,u,-.044,.405,.031,.071)+gaussian(x,u,.044,.405,.031,.071));
 const noseBridge=.014*gaussian(x,u,0,.605,.0105,.078);
 const noseTip=.0168*gaussian(x,u,0,.515,.0120,.031);
 const noseAlar=.010*(gaussian(x,u,-.014,.493,.008,.023)+gaussian(x,u,.014,.493,.008,.023));
 const columella=.006*gaussian(x,u,0,.463,.009,.024);
 const eyeSockets=-.0057*(gaussian(x,u,-.034,.682,.020,.024)+gaussian(x,u,.034,.682,.020,.024));
 const lowerLids=.0025*(gaussian(x,u,-.034,.652,.020,.009)+gaussian(x,u,.034,.652,.020,.009));
 const upperLids=.0023*(gaussian(x,u,-.034,.709,.019,.008)+gaussian(x,u,.034,.709,.019,.008));
 const upperLip=.0084*gaussian(x,u,0,.413,.024,.012);
 const lowerLip=.0093*gaussian(x,u,0,.380,.025,.016);
 const mouthCrease=-.0024*gaussian(x,u,0,.397,.024,.0045);
 const filtrum=.0027*(gaussian(x,u,-.008,.448,.004,.017)+gaussian(x,u,.008,.448,.004,.017));
 const chin=.0065*gaussian(x,u,0,.25,.031,.050);
 const jaw=.0032*(gaussian(x,u,-.041,.306,.024,.063)+gaussian(x,u,.041,.306,.024,.063));
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
 const lip=gaussian(x,u,0,.395,.024,.028)*frontal;
 const baseline=new THREE.Color(0xd9ab9d);
 const pink=new THREE.Color(0xc38a88);
 const blush=new THREE.Color(0xd99b97);
 baseline.lerp(blush,clamp(cheek*.21));
 baseline.lerp(pink,clamp(lip*.64));
 return baseline;
}
function buildSkin(){
 const N=NEUTRAL_FACE_V120.longitudes,M=NEUTRAL_FACE_V120.latitudes;
 const xyz=[],uv=[],color=[],index=[],zones={leftEye:[],rightEye:[],mouth:[],nose:[],leftCheek:[],rightCheek:[]};
 const landmarks=[];
 for(let row=0;row<=M;row++){
  const u=.150+.845*row/M;
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
    if(gaussian(p.x,u,0,.395,.034,.061)>.17)zones.mouth.push(k);
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
 xyz.push(0,.276*(.150-.49),-.003);uv.push(.5,0);
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
 const w=.0171,h=.0079;
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
  [.0055,.0006,0x49392f],[.0044,.0014,0x775943],
  [.0025,.0025,0x19181b],[.0007,.0034,0xf4ece4]
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
 const x0=side*.034,u=.681,w=.0171,h=.0080;
 const group=new THREE.Group();group.name=side<0?'EYELID_L_NEUTRAL':'EYELID_R_NEUTRAL';
 const upper=[],lower=[],brow=[];
 for(let i=0;i<=16;i++){
  const t=-1+i/8,shape=Math.sqrt(Math.max(0,1-t*t));
  const x=x0+w*t;
  const upperY=u+(h/.276)*shape*(1+.10*t);
  const lowerY=u-(h/.276)*shape*(.76+.08*t);
  upper.push([x,.276*(upperY-.49),surface(x,upperY)+.006]);
  lower.push([x,.276*(lowerY-.49),surface(x,lowerY)+.004]);
  const bx=x0+w*t*1.10,by=u+.065+.007*shape+.002*t;
  brow.push([bx,.276*(by-.49),surface(bx,by)+.0023]);
 }
 group.add(curvedStrip('UPPER_LID_'+(side<0?'L':'R'),upper,.00076,0x694e4a));
 group.add(curvedStrip('LOWER_LID_'+(side<0?'L':'R'),lower,.00038,0x966d67));
 group.add(curvedStrip('BROW_'+(side<0?'L':'R'),brow,.00113,0x8a7065));
 return group;
}
function ears(side){
 const group=new THREE.Group();group.name=side<0?'EAR_L':'EAR_R';
 const ear=new THREE.Mesh(new THREE.SphereGeometry(1,28,20),
  new THREE.MeshStandardMaterial({color:0xd5a398,roughness:.78}));
 ear.scale.set(.0078,.0155,.0068);
 ear.position.set(side*.083,.276*(.585-.49),-.009);
 ear.rotation.z=-side*.12;
 ear.name='EAR_SURFACE_'+side;
 group.add(ear);
 const concha=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),
  new THREE.MeshStandardMaterial({color:0xb88680,roughness:.9}));
 concha.scale.set(.0013,.0075,.0036);
 concha.position.set(side*.089,.276*(.590-.49),-.006);
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
  const u=.397+.004*(1-t*t)*Math.cos(t*PI);
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
   noseTip:[0,.276*(.515-.49),surface(0,.515)],
   upperLip:[0,.276*(.413-.49),surface(0,.413)],
   lowerLip:[0,.276*(.380-.49),surface(0,.380)],
   chin:[0,.276*(.150-.49),surface(0,.150)]
  }};
 return {root,skin,parts,metrics};
}
