import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const $=id=>document.getElementById(id),manifest=await fetch('./manifest.json').then(r=>{if(!r.ok)throw Error('manifest');return r.json()});
const byId=new Map(manifest.models.map(m=>[m.id,m])),stage=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));stage.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x202938);
scene.add(new THREE.HemisphereLight(0xdcecff,0x54483b,2.1));
const light=new THREE.DirectionalLight(0xffffff,2.1);light.position.set(4,7,5);scene.add(light);
const camera=new THREE.PerspectiveCamera(40,1,.05,200);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;
const root=new THREE.Group();scene.add(root);const loader=new GLTFLoader();
let active=null,mixers=[],instances=[],selectedAction='',selectedExpression='',expressionStrength=1,loading=false;
let renderError=null,frames=0,dt=0,last=performance.now(),paused=false;
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderError='WebGL context lost';});
function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);resize();
function dispose(gltf){if(!gltf)return;const ge=new Set(),ma=new Set(),tx=new Set();gltf.scene.traverse(o=>{if(o.geometry)ge.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){ma.add(m);for(const v of Object.values(m))if(v?.isTexture)tx.add(v)}});ge.forEach(x=>x.dispose());ma.forEach(x=>x.dispose());tx.forEach(x=>x.dispose())}
function clearInstances(){for(const m of mixers){m.stopAllAction();m.uncacheRoot(m.getRoot())}for(const o of instances){root.remove(o);o.traverse(p=>{if(p.isSkinnedMesh)p.skeleton.dispose()})}instances=[];mixers=[];}
function frameCamera(n){const b=new THREE.Box3().setFromObject(root);const c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3());orbit.target.copy(c);const d=Math.max(s.x,s.y,s.z)*1.8;camera.position.copy(c).add(new THREE.Vector3(d*.55,d*.35,d));orbit.update();}
function selectOptions(el,values){el.replaceChildren(...values.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o}))}
selectOptions($('person'),manifest.models.map(m=>[m.id,m.id+' / '+m.label+' / '+m.age+' / '+m.build]));
function applyExpression(n,strength=1){selectedExpression=n;expressionStrength=strength;let hits=0;for(const o of instances)o.traverse(p=>{if(p.morphTargetInfluences){p.morphTargetInfluences.fill(0);if(n in (p.morphTargetDictionary||{})){p.morphTargetInfluences[p.morphTargetDictionary[n]]=strength;hits++}}});return hits}
function applyAction(n){selectedAction=n;const matches=active.animations.filter(a=>a.name.toLowerCase().includes(n.toLowerCase()));if(matches.length!==1)throw Error('ambiguous action '+n);for(const m of mixers){m.stopAllAction();m.clipAction(matches[0]).reset().play()}}
function setCount(n){if(!active)throw Error('not loaded');clearInstances();for(let i=0;i<n;i++){const o=clone(active.scene);const cols=Math.ceil(Math.sqrt(n));o.position.x=(i%cols-(cols-1)/2)*1.2;o.position.z=(Math.floor(i/cols)-(cols-1)/2)*1.2;root.add(o);instances.push(o);mixers.push(new THREE.AnimationMixer(o))}if(selectedAction)applyAction(selectedAction);applyExpression(selectedExpression,expressionStrength);frameCamera(n)}
async function load(id,level){if(loading)throw Error('load already running');loading=true;try{const model=byId.get(id),entry=model.levels[level];const next=await loader.loadAsync(entry.path);let skins=0,morphSet=new Set();next.scene.traverse(o=>{if(o.isSkinnedMesh)skins++;for(const n of Object.keys(o.morphTargetDictionary||{}))morphSet.add(n)});if(!skins||!model.morphs.every(n=>morphSet.has(n))||!model.clips.every(n=>next.animations.some(a=>a.name.toLowerCase().includes(n.toLowerCase()))))throw Error('GLB inventory mismatch '+id+' '+level);clearInstances();dispose(active);active=next;selectedAction=model.clips[0];selectedExpression='';selectOptions($('action'),model.clips.map(n=>[n,n]));selectOptions($('expr'),[['','なし'],...model.morphs.map(n=>[n,n])]);$('person').value=id;$('lod').value=level;$('count').value='1';setCount(1);$('status').textContent=id+' / '+level+' / '+entry.triangles.toLocaleString()+' triangles';return {id,level,skins,morphs:morphSet.size,clips:next.animations.length,triangles:entry.triangles}}finally{loading=false}}
function render(){requestAnimationFrame(render);const now=performance.now(),delta=Math.min((now-last)/1000,.1);last=now;if(paused)return;for(const m of mixers)m.update(delta);orbit.update();renderer.render(scene,camera);frames++;dt=delta;}requestAnimationFrame(render);
async function benchmark(n,samples=12){paused=true;try{setCount(n);const times=[];for(let i=0;i<samples+3;i++){const a=performance.now();for(const m of mixers)m.update(1/60);renderer.render(scene,camera);renderer.getContext().finish();const t=performance.now()-a;if(i>=3)times.push(t);await new Promise(r=>requestAnimationFrame(r))}times.sort((a,b)=>a-b);return {count:n,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.min(times.length-1,Math.ceil(times.length*.95)-1)],triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER),softwareOrCI:true}}finally{paused=false}}
function capture(){paused=true;try{renderer.render(scene,camera);renderer.getContext().finish();const url=renderer.domElement.toDataURL('image/png');if(!url.startsWith('data:image/png;base64,'))throw Error('invalid canvas capture');return url}finally{paused=false}}
function setView(mode){const b=new THREE.Box3().setFromObject(root),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3());const d=Math.max(s.x,s.y,s.z)*1.8;if(mode==='face'){c.y=b.max.y-s.y*.075;orbit.target.copy(c);camera.position.copy(c).add(new THREE.Vector3(0,0,s.y*.34));}else{orbit.target.copy(c);const dir=mode==='rear'?[0,0,-1]:mode==='side'?[1,0,0]:[0,0,1];camera.position.copy(c).add(new THREE.Vector3(...dir).multiplyScalar(d));}orbit.update()}
window.review={setView,load,setCount,applyAction,applyExpression,benchmark,capture,pause:()=>{paused=true},resume:()=>{paused=false},manifest,health:()=>({renderError,frames,dt,instances:instances.length})};
const safe=fn=>async()=>{try{await fn()}catch(e){$('status').textContent=String(e);console.error(e)}};
$('person').onchange=$('lod').onchange=safe(()=>load($('person').value,$('lod').value));$('action').onchange=safe(()=>applyAction($('action').value));$('expr').onchange=$('strength').oninput=safe(()=>applyExpression($('expr').value,Number($('strength').value)));$('count').onchange=safe(()=>setCount(Number($('count').value)));$('reset').onclick=()=>frameCamera(instances.length);
for(const n of ['face','front','side','rear'])$(n).onclick=()=>setView(n);
await load(manifest.models[0].id,'lod0');window.reviewReady=true;
