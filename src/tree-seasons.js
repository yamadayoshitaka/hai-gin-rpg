import {OBJECT_CATALOG,createCatalogObject} from './object-catalog.js?v=castle-pillars-45';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildingPreviewPhase,buildingPreviewCamera} from './building-preview-tour.js?v=castle-pillars-45';
const $=id=>document.getElementById(id),view=$('view'),scene=new THREE.Scene(),tree=new THREE.Group();scene.add(tree);scene.background=new THREE.Color(0xa8c7db);scene.fog=new THREE.Fog(0xa8c7db,110,240);
// Populate the selector from the actual catalogue so future building parts cannot
// silently disappear from the object list when the 3D model has been registered.
const objectSelect=$('object');
const originalTrees=[...objectSelect.options].filter(option=>option.value==='tree'||option.value==='flower_tree');
objectSelect.replaceChildren(...originalTrees);
const catalogGroups=new Map();
for(const definition of Object.values(OBJECT_CATALOG)){
 if(definition.id.includes('_broken_'))continue; // bridge damage is selected through the state menu
 const category=definition.category||'その他';
 if(!catalogGroups.has(category)){
  const group=document.createElement('optgroup');group.label=category;
  catalogGroups.set(category,group);objectSelect.appendChild(group);
 }
 const option=document.createElement('option');option.value=definition.id;option.textContent=definition.name;
 catalogGroups.get(category).appendChild(option);
}
const camera=new THREE.PerspectiveCamera(43,1,.1,120);camera.position.set(14,11,20);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;view.appendChild(renderer.domElement);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,5.2,0);orbit.enableDamping=true;orbit.minDistance=2;orbit.maxDistance=180;
scene.add(new THREE.HemisphereLight(0xe8f4ff,0x56613b,2.3));const sun=new THREE.DirectionalLight(0xffe7bd,3.1);sun.position.set(10,20,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-13;scene.add(sun);const floor=new THREE.Mesh(new THREE.CircleGeometry(35,72),new THREE.MeshStandardMaterial({color:0x6a854f,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const cfg={assetId:'tree_deciduous_001',version:4,height:11.8,leafCount:48000,seed:4271,barkRidges:27,units:'meters',upAxis:'Y'};let seed=cfg.seed;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
const bark=new THREE.MeshStandardMaterial({color:0x635343,roughness:1,vertexColors:true});const baseColor=new THREE.Color(0x6e5b47),dark=new THREE.Color(0x392f2a);let branches=0;
function wood(points,r0,r1,detail=12){const curve=new THREE.CatmullRomCurve3(points),rings=Math.max(12,detail*4),radial=32,pos=[],col=[],ind=[];for(let i=0;i<=rings;i++){const t=i/rings,center=curve.getPoint(t),tangent=curve.getTangent(t),axis=Math.abs(tangent.x)>.9?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0),u=new THREE.Vector3().crossVectors(tangent,axis).normalize(),v=new THREE.Vector3().crossVectors(tangent,u).normalize();for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2,r=(r0*(1-t)+r1*t)*(1+.105*Math.sin(a*cfg.barkRidges+t*23)+.055*Math.sin(a*41-t*59)+.026*Math.sin(a*73+t*137)+.018*Math.sin(t*191+a*17));const p=center.clone().addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r);pos.push(p.x,p.y,p.z);const c=baseColor.clone().lerp(dark,.18+.44*Math.sin(a*cfg.barkRidges+t*23)**2+.10*Math.sin(t*91+a*17)**2);col.push(c.r,c.g,c.b);if(i<rings&&j<radial){const k=i*(radial+1)+j;ind.push(k,k+radial+1,k+1,k+1,k+radial+1,k+radial+2)}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ind);g.computeVertexNormals();const mesh=new THREE.Mesh(g,bark);mesh.name='Bark_'+(++branches);mesh.castShadow=true;tree.add(mesh)}
wood([new THREE.Vector3(0,0,0),new THREE.Vector3(.08,1.9,.04),new THREE.Vector3(-.12,4.1,.12),new THREE.Vector3(.23,6.5,-.08),new THREE.Vector3(.12,8.9,.12)],.94,.12,48);
for(let k=0;k<10;k++){const a=k*Math.PI*2/10;wood([new THREE.Vector3(Math.cos(a)*.32,.3,Math.sin(a)*.32),new THREE.Vector3(Math.cos(a)*.78,.12,Math.sin(a)*.78),new THREE.Vector3(Math.cos(a)*(1.8+rnd()*.8),.02,Math.sin(a)*(1.8+rnd()*.8))],.24,.035,8)}
const clusters=[];for(let level=0;level<6;level++){const y=2.4+level*1.1;for(let j=0;j<10;j++){const angle=(j+level*.49)/10*Math.PI*2+(rnd()-.5)*.28,reach=(5.3-level*.43)*(.75+rnd()*.4),a=new THREE.Vector3(.1,y,0),b=new THREE.Vector3(Math.cos(angle)*reach*.52,y+reach*.16,Math.sin(angle)*reach*.52),c=new THREE.Vector3(Math.cos(angle)*reach,y+reach*(.23+rnd()*.24),Math.sin(angle)*reach);wood([a,b,c],.3-level*.032,.025,11);for(let t=0;t<4;t++){const at=b.clone().lerp(c,.16+t*.23),off=new THREE.Vector3((rnd()-.5)*reach*.46,reach*(.08+rnd()*.2),(rnd()-.5)*reach*.46),end=at.clone().add(off);wood([at,end],.065,.006,4);clusters.push({center:end,radius:.5+rnd()*.45})}clusters.push({center:c,radius:.8})}}
// Static wood is merged once into one indexed geometry; no per-branch draw calls.
const woodParts=tree.children.filter(o=>o.isMesh&&o.name.startsWith('Bark_'));
if(woodParts.length){const pos=[],col=[],idx=[];let offset=0;for(const part of woodParts){const g=part.geometry,p=g.getAttribute('position'),c=g.getAttribute('color'),ix=g.getIndex();for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));col.push(c.getX(i),c.getY(i),c.getZ(i))}if(ix){for(let i=0;i<ix.count;i++)idx.push(ix.getX(i)+offset)}else{for(let i=0;i<p.count;i++)idx.push(i+offset)}offset+=p.count;tree.remove(part);g.dispose()}const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));merged.setAttribute('color',new THREE.Float32BufferAttribute(col,3));merged.setIndex(idx);merged.computeVertexNormals();const woodMesh=new THREE.Mesh(merged,bark);woodMesh.name='Wood_merged';woodMesh.castShadow=true;tree.add(woodMesh)}
const seasonColors={spring:[0x8dc46c,0xa3cd7b,0xb4d68a,0x6fab56,0xc5df91],summer:[0x275b2b,0x347335,0x4b8738,0x679946,0x7fa747,0x2f6a32],autumn:[0xa53b21,0xd66a20,0xe8a62e,0xb34b2a,0xe2c04b,0x8b3d20],winter:[]};const leafMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,side:THREE.DoubleSide,metalness:0});let foliage=null;let flowerTree=false;
// Leaf clusters are baked to a small transparent atlas; 40,000 leaf silhouettes need no individual geometry.
const leafCanvas=document.createElement('canvas');leafCanvas.width=256;leafCanvas.height=256;const ctx=leafCanvas.getContext('2d');ctx.clearRect(0,0,256,256);seed=72831;for(let i=0;i<110;i++){const x=20+rnd()*216,y=20+rnd()*216,w=4+rnd()*9,h=9+rnd()*14,rot=rnd()*6.283;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle='rgba(255,255,255,'+(.65+rnd()*.35)+')';ctx.beginPath();ctx.moveTo(0,-h);ctx.quadraticCurveTo(w*1.3,-h*.2,0,h);ctx.quadraticCurveTo(-w*1.3,-h*.2,0,-h);ctx.fill();ctx.restore()}const atlas=new THREE.CanvasTexture(leafCanvas);atlas.colorSpace=THREE.SRGBColorSpace;leafMat.map=atlas;leafMat.transparent=true;leafMat.alphaTest=.38;leafMat.depthWrite=true;leafMat.needsUpdate=true;
function buildSeason(name){if(foliage){tree.remove(foliage);foliage.geometry.dispose();foliage=null}seed=cfg.seed+9281;const flowerPalette=name==='spring'?[0xffa7ca,0xffc4d8,0xffdce7,0xf28db6]:name==='summer'?[0xf3f2dd,0xffe5b3,0xffffff]:[0xce693f,0xedb85e,0xb95437];const palette=(flowerTree&&name!=='winter'?flowerPalette:seasonColors[name]).map(c=>new THREE.Color(c));const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent),n=name==='winter'?0:mobile?600:1100;const pos=[],uv=[],colors=[],idx=[];for(let i=0;i<n;i++){const cl=clusters[Math.floor(rnd()*clusters.length)],center=cl.center.clone().add(new THREE.Vector3((rnd()-.5)*cl.radius,(rnd()-.5)*cl.radius,(rnd()-.5)*cl.radius)),size=cl.radius*(.85+rnd()*.75),angle=rnd()*6.283,up=new THREE.Vector3(0,1,0),side=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),c=palette[Math.floor(rnd()*palette.length)],base=i*4;for(const [x,y,u,v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){const p=center.clone().addScaledVector(side,x*size).addScaledVector(up,y*size);pos.push(p.x,p.y,p.z);uv.push(u,v);colors.push(c.r,c.g,c.b)}idx.push(base,base+1,base+2,base,base+2,base+3)}if(n){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();foliage=new THREE.Mesh(g,leafMat);foliage.name='Baked_leaf_clusters_'+name;tree.add(foliage)}tree.userData={...cfg,assetId:flowerTree?'flower_tree_001':'tree_deciduous_001',season:name,leafCount:'atlas',leafClusters:n,assetType:'single-tree',renderMeshes:n?2:1};$('stats').textContent='葉の画像アトラス / '+n+' 枚の板ポリゴン / 木1オブジェクト';$('status').textContent='季節：'+({spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[name])+' / 軽量モデル'}
// A tree is one logical game object. Damage visuals are state-driven and do not simulate each leaf.
const effectRoot=new THREE.Group();scene.add(effectRoot);let effect='normal',effectStart=performance.now(),effectMeshes=[],woodOriginal=bark.color.clone();
function clearEffect(){for(const o of effectMeshes){effectRoot.remove(o);o.geometry?.dispose();o.material?.dispose()}effectMeshes=[];tree.rotation.set(0,0,0);tree.position.set(0,0,0);bark.color.copy(woodOriginal);leafMat.color.set(0xffffff);leafMat.emissive.set(0x000000)}
function sphereAt(x,y,z,r,color,opacity=.6){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));mesh.position.set(x,y,z);effectRoot.add(mesh);effectMeshes.push(mesh);return mesh}
function setEffect(name){clearEffect();effect=name;effectStart=performance.now();tree.userData.state=name;const isWinter=$('season').value==='winter';if(name==='burn'){bark.color.set(0x30221c);leafMat.color.set(0x6c3420);leafMat.emissive.set(0x361000);for(let i=0;i<38;i++){const a=rnd()*Math.PI*2,rad=rnd()*3.3,y=.4+rnd()*8;const p=sphereAt(Math.cos(a)*rad,y,Math.sin(a)*rad,.12+rnd()*.3,i%3===0?0xffd047:i%3===1?0xff5722:0x5a5a5a,.48);p.userData.baseY=y;p.userData.phase=rnd()*6.28}}else if(name==='freeze'){bark.color.set(0x92c4d2);leafMat.color.set(isWinter?0xffffff:0xc4e8f4);for(let i=0;i<45;i++){const a=rnd()*6.283,rad=rnd()*3.6,y=.2+rnd()*9;sphereAt(Math.cos(a)*rad,y,Math.sin(a)*rad,.07+rnd()*.14,0xc7f3ff,.56)}}else if(name==='break'){bark.color.set(0x725c49);const woodCut=new THREE.MeshStandardMaterial({color:0xb88b58,roughness:1,flatShading:true}),barkCut=new THREE.MeshStandardMaterial({color:0x594433,roughness:1,flatShading:true});const sides=24,rings=3,vertices=[],indices=[];for(let ring=0;ring<rings;ring++){const y=ring===0?0:ring===1?.82:1.15;for(let i=0;i<sides;i++){const angle=i/sides*Math.PI*2,irregular=ring===2?.35*Math.sin(angle*7)+.22*Math.sin(angle*11):0,r=(ring===0?.98:ring===1?.74:.56)+irregular;vertices.push(Math.cos(angle)*r,y+(ring===2?.32*Math.sin(angle*5)+.23*Math.cos(angle*9):0),Math.sin(angle)*r)}}for(let j=0;j<rings-1;j++)for(let i=0;i<sides;i++){const n=(i+1)%sides,a=j*sides+i,b=j*sides+n,c=(j+1)*sides+i,d=(j+1)*sides+n;indices.push(a,c,b,b,c,d)}const stumpG=new THREE.BufferGeometry();stumpG.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));stumpG.setIndex(indices);stumpG.computeVertexNormals();const stump=new THREE.Mesh(stumpG,barkCut);stump.castShadow=true;effectRoot.add(stump);effectMeshes.push(stump);for(let i=0;i<19;i++){const angle=rnd()*6.283,radius=.14+rnd()*.45,height=.5+rnd()*1.05;const splinter=new THREE.Mesh(new THREE.ConeGeometry(.035+rnd()*.09,height,3),woodCut.clone());splinter.position.set(Math.cos(angle)*radius,1.05+height*.27,Math.sin(angle)*radius);splinter.rotation.z=(rnd()-.5)*.8;splinter.rotation.x=(rnd()-.5)*.8;effectRoot.add(splinter);effectMeshes.push(splinter)}const scar=new THREE.Mesh(new THREE.ConeGeometry(.6,.55,13),woodCut.clone());scar.position.y=1.13;scar.rotation.z=Math.PI;effectRoot.add(scar);effectMeshes.push(scar)}$('status').textContent='木：'+({normal:'通常',break:'折れる',burn:'燃焼中',freeze:'凍結中'}[name])}
let catalogPreview=null,bridgeEffectStarted=0,bridgeEffect='normal',bridgePieces=[],bridgeFlames=[];
let buildingTour=null;
orbit.addEventListener('start',()=>{if(buildingTour)buildingTour.holdUntil=performance.now()+12000});
function updateBuildingTour(){
 const tour=buildingTour;
 if(!tour||!catalogPreview||performance.now()<tour.holdUntil)return;
 const phase=tour.fixedFloor?
  {mode:'interior',floor:tour.fixedFloor}:buildingPreviewPhase(tour.structure,(performance.now()-tour.startedAt)/1000);
 if(!phase)return;
 if(tour.displayedFloor!==phase.floor){
  tour.displayedFloor=phase.floor;
  if(tour.roof)tour.roof.visible=phase.mode==='exterior';
  if(tour.walls)tour.walls.visible=phase.mode==='exterior';
  if(tour.ground)tour.ground.visible=phase.floor===1;
  if(tour.decks){
   tour.decks.visible=phase.floor>1;
   for(const slab of tour.decks.children){
    const slabFloor=Number(slab.name.match(/^floor_(\d+)_slab$/)?.[1]??99);
    slab.visible=slabFloor<=phase.floor;
   }
  }
  if(tour.furnishings){
   tour.furnishings.visible=phase.floor>1;
   for(const detail of tour.furnishings.children){
    const detailFloor=Number(detail.name.match(/^floor_(\d+)_details$/)?.[1]??-1);
    detail.visible=detailFloor===phase.floor;
    if(detail.name==='upper_floor_loot')for(const chest of detail.children){
     const chestFloor=Number(chest.name.match(/^loot_floor_(\d+)$/)?.[1]??-1);
     chest.visible=chestFloor===phase.floor;
    }
    if(detail.name==='upper_floor_loot')detail.visible=phase.floor>1;
   }
  }
  if(phase.mode==='exterior'){
   tour.cameraGoal.copy(tour.exteriorCamera);
   tour.focusGoal.copy(tour.exteriorFocus);
  }else{
   const pose=buildingPreviewCamera(tour.structure,phase.floor);
   tour.focusGoal.set(pose.target.x,pose.target.y,pose.target.z);
   // The ground-floor inspection link starts closer to the great hall so the
   // giant circular pillars and adjacent chamber doors are legible on phones.
   const zoom=tour.fixedFloor===1&&tour.structure.id==='castle_001'?0.53:1;
   tour.cameraGoal.set(pose.target.x+pose.offset.x*zoom,pose.target.y+pose.offset.y*zoom,pose.target.z+pose.offset.z*zoom);
  }
  const rooms=catalogPreview.userData.upperFloorRooms?.find(item=>item.floor===phase.floor)?.rooms??[];
  const chamber=phase.floor===3&&tour.structure.id==='castle_001'?'（王の謁見の間・全'+rooms.length+'室）':
   rooms.length?'（'+rooms.length+'室）':'';
  $('status').textContent=tour.baseStatus+' / '+(phase.mode==='exterior'?'外観':phase.floor+'階内部'+chamber)+(tour.fixedFloor?'を固定表示中':'を自動表示中');
 }
 // Ease into each floor; a sudden camera teleport makes the stair geometry
 // hard to follow, especially on a narrow Android screen.
 camera.position.lerp(tour.cameraGoal,.075);
 orbit.target.lerp(tour.focusGoal,.075);
}
function isCatalogItem(){return Boolean(OBJECT_CATALOG[$('object').value])}
function isDestructibleBridge(id){return id==='timber_bridge_001'||id==='stone_bridge_001'}
function makeBridgeFlames(){
 const flameMat=new THREE.MeshBasicMaterial({color:0xff8526,transparent:true,opacity:.82,depthWrite:false});
 for(let i=0;i<28;i++){
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.12+(i%4)*.045,.5+(i%5)*.13,5),flameMat.clone());
  flame.position.set(((i*7)%15-7)*2.2,.4,((i*3)%5-2)*.24);
  flame.userData.phase=i*.79;catalogPreview.add(flame);bridgeFlames.push(flame);
 }
}
function showCatalogSelection(){
 const selected=$('object').value,definition=OBJECT_CATALOG[selected];
 const catalogItem=Boolean(definition),bridge=isDestructibleBridge(selected);
 const state=bridge?$('effect').value:'normal',broken=state==='break';
 buildingTour=null;
 if(catalogPreview){scene.remove(catalogPreview);catalogPreview.traverse(o=>{if(o.geometry&&!o.userData.sharedGeometry)o.geometry.dispose();if(o.material&&o.material.userData?.effectMaterial)o.material.dispose()});catalogPreview=null}
 bridgePieces=[];bridgeFlames=[];bridgeEffect=state;bridgeEffectStarted=performance.now();
 tree.visible=!catalogItem;floor.visible=!catalogItem;$('season').disabled=catalogItem;$('effect').disabled=catalogItem&&!bridge;
 for(const opt of $('effect').options)opt.disabled=bridge&&(opt.value==='freeze'||(opt.value==='burn'&&selected==='stone_bridge_001'));
 if(catalogItem){
  const id=bridge&&broken?selected.replace('_001','_broken_001'):selected;
  try{catalogPreview=createCatalogObject(id);scene.add(catalogPreview)}catch(err){$('status').textContent='生成エラー: '+err.message;console.error(err);return}
  if(bridge&&(state==='break'||(state==='burn'&&selected==='timber_bridge_001'))){
   bridgePieces=catalogPreview.children.filter(o=>o.isMesh&&!o.geometry.type.includes('Cone')).map((o,i)=>({mesh:o,y:o.position.y,rotation:o.rotation.z,delay:.7+(i%17)*.11,speed:1+(i%5)*.22}));
   if(state==='burn')makeBridgeFlames();
  }
  const detail=definition.floors?'・'+definition.floors+'階接続':definition.lockLevel?'・入口専用 鍵Lv.'+definition.lockLevel:catalogPreview.userData.floorCount?'・'+catalogPreview.userData.floorCount+'階建て':'';
  const damage=bridge?'・'+({normal:'通常',break:'崩落',burn:'燃焼中'}[state]||'通常'):'';
  $('status').textContent=definition.name+'｜'+definition.widthCells+'×'+definition.depthCells+'マス'+detail+damage;
  // Every building and loose component must fit in view, including the 100×100 castle.
  const bounds=new THREE.Box3().setFromObject(catalogPreview);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const vfov=THREE.MathUtils.degToRad(camera.fov/2),hfov=Math.atan(Math.tan(vfov)*camera.aspect);
  const distance=Math.max(12,Math.max(size.y/(2*Math.tan(vfov)),Math.max(size.x,size.z)/(2*Math.tan(hfov)))*1.2);
  orbit.target.copy(center);
  camera.position.set(center.x+distance*.78,center.y+distance*.58,center.z+distance*.90);
  orbit.maxDistance=Math.max(180,distance*4);
  camera.far=Math.max(350,distance*8);
  scene.fog.near=Math.max(110,distance*1.1);scene.fog.far=Math.max(240,distance*4);
  camera.updateProjectionMatrix();
  const structure=catalogPreview.userData.structure;
  if(structure?.floors?.length>1){
   const requestedFloor=new URLSearchParams(location.search).get('floor');
   const fixedFloor=/^[1-9]\d*$/.test(requestedFloor??'')&&Number(requestedFloor)<=structure.floors.length?Number(requestedFloor):null;
   buildingTour={structure,fixedFloor,startedAt:performance.now(),holdUntil:0,displayedFloor:-1,
    roof:catalogPreview.getObjectByName('removable_roof')??catalogPreview.getObjectByName('stone_hut_roof'),
    walls:catalogPreview.getObjectByName('walls'),
    decks:catalogPreview.getObjectByName('interior_upper_floor_decks'),
    furnishings:catalogPreview.getObjectByName('interior_upper_floor_furnishings'),
    ground:catalogPreview.getObjectByName('interior_ground_floor_furnishings'),
    exteriorCamera:camera.position.clone(),exteriorFocus:orbit.target.clone(),
    cameraGoal:camera.position.clone(),focusGoal:orbit.target.clone(),baseStatus:$('status').textContent};
   const levels=structure.floors.map(f=>f.index+'階').join(' → ');
   $('stats').textContent=fixedFloor?fixedFloor+'階を固定表示 / ドラッグで見渡し・ピンチで拡大':
    '外観 → '+levels+'を約6秒ごとに自動表示 / ドラッグで一時停止';
  }else $('stats').textContent='回転：ドラッグ / 拡大：ピンチ';
 }else{orbit.target.set(0,5.2,0);camera.position.set(14,11,20);camera.far=350;camera.updateProjectionMatrix();orbit.maxDistance=180;scene.fog.near=110;scene.fog.far=240;$('status').textContent='樹木モデル';$('stats').textContent='回転：ドラッグ / 拡大：ピンチ'}
 orbit.update();
}
$('effect').onchange=()=>{if(isCatalogItem())showCatalogSelection();else setEffect($('effect').value)};
$('season').onchange=()=>{if(!isCatalogItem()){buildSeason($('season').value);setEffect($('effect').value)}};
$('object').onchange=()=>{
 if(isCatalogItem()){if(!isDestructibleBridge($('object').value)||$('effect').value==='freeze'||($('effect').value==='burn'&&$('object').value==='stone_bridge_001'))$('effect').value='normal';showCatalogSelection();return}
 showCatalogSelection();flowerTree=$('object').value==='flower_tree';buildSeason($('season').value);setEffect($('effect').value);
};
buildSeason('summer');
const query=new URLSearchParams(location.search),initialObject=query.get('object');
if(initialObject){const broken=initialObject.includes('_broken_'),base=initialObject.replace('_broken_','_');if([...$('object').options].some(o=>o.value===base)){$('object').value=base;if(broken)$('effect').value='break';$('object').dispatchEvent(new Event('change'))}}
function updateBridgeEffect(){
 if(!catalogPreview||(bridgeEffect!=='burn'&&bridgeEffect!=='break'))return;
 const t=(performance.now()-bridgeEffectStarted)/1000;
 for(const f of bridgeFlames){const k=t*6+f.userData.phase;f.scale.y=.7+.5*Math.abs(Math.sin(k));f.position.y=.38+.14*Math.sin(k*1.7);f.material.opacity=Math.max(0,Math.min(.9,4.8-t)*.22)}
 for(const p of bridgePieces){const dt=Math.max(0,t-(bridgeEffect==='break'? .12+(p.delay-.7)*.35:p.delay));if(dt>0){p.mesh.position.y=p.y-Math.min(4,dt*dt*1.8*p.speed);p.mesh.rotation.z=p.rotation+Math.min(1.4,dt*dt*.42)*(p.speed%2?1:-1)}}
 if(t>4.3){bridgeEffect='burned';bridgeFlames.forEach(f=>f.visible=false);$('status').textContent='橋｜崩落完了（通行不可）'}
}
$('export').onclick=()=>{$('status').textContent='GLBを生成中…';new GLTFExporter().parse(catalogPreview||tree,data=>{const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download=(catalogPreview?catalogPreview.userData.catalogId:flowerTree?'flower_tree_001':'tree_deciduous_001')+'_'+$('season').value+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);$('status').textContent='GLB保存完了'},e=>$('status').textContent='GLB出力失敗：'+e.message,{binary:true,onlyVisible:!buildingTour})};new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}).observe(view);function frame(){requestAnimationFrame(frame);const elapsed=(performance.now()-effectStart)/1000;if(effect==='break'){tree.rotation.z=-Math.min(1.48,elapsed*.78);tree.position.x=-1.3*Math.sin(tree.rotation.z);tree.position.y=1.3*(1-Math.cos(tree.rotation.z))}else if(effect==='burn'){for(const p of effectMeshes){p.position.y=p.userData.baseY+((elapsed*.8+p.userData.phase)%2);p.scale.setScalar(.7+.4*Math.sin(elapsed*5+p.userData.phase))}}updateBridgeEffect();updateBuildingTour();orbit.update();renderer.render(scene,camera)}frame();
