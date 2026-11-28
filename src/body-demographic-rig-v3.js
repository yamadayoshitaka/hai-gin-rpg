import * as T from 'three';
export const FACE_CUT=-.062;
const gauss=(x,c,w)=>Math.exp(-Math.pow((x-c)/w,2));
const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
export function donorPath(sex,age){const band=age==='under10'?'child':['sixties','seventies','eightyPlus'].includes(age)?'senior':'adult';return './assets/character-review/'+(sex==='female'&&band==='adult'?'HM08_adult_female_R36_review.glb':'HM08_'+sex+'-'+band+'_R41.glb')}
export function canonicalBone(n){// GLTFLoader strips reserved periods from node names; accept raw and sanitized variants.
const side=/L$/.test(n)?'l':/R$/.test(n)?'r':'';const b=n.replace(/[._]?[LR]$/,'');const m={upperarm01:'upperarm',lowerarm01:'lowerarm',wrist:'hand',upperleg01:'thigh',lowerleg01:'calf',foot:'foot','toe1-1':'ball','toe1-2':'ball_leaf',clavicle:'clavicle'};if(side&&m[b])return m[b]+'_'+side;const f=b.match(/^finger([1-5])-([1-3])$/);if(side&&f)return ['','thumb','index','middle','ring','pinky'][Number(f[1])]+'_0'+f[2]+'_'+side;return {spine04:'spine_01',spine02:'spine_02',spine01:'spine_03',neck01:'neck_01',head:'Head'}[n]||n}
export function openHandoff(){return new Promise((ok,no)=>{const r=indexedDB.open('hai-gin-body-handoff',1);r.onupgradeneeded=()=>r.result.createObjectStore('current');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
export async function writeHandoff(rec){const db=await openHandoff();try{await new Promise((ok,no)=>{const t=db.transaction('current','readwrite');t.objectStore('current').put(rec,'face');t.oncomplete=ok;t.onabort=t.onerror=()=>no(t.error)})}finally{db.close()}}
export async function readHandoff(){const db=await openHandoff();try{return await new Promise((ok,no)=>{const t=db.transaction('current','readonly'),r=t.objectStore('current').get('face');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}finally{db.close()}}
export function crossSection(g,y){const p=g.attributes.position,idx=g.index;if(!idx)throw Error('断面測定にはindexed meshが必要');const box=new T.Box3();let n=0;for(let i=0;i<idx.count;i+=3){for(let e=0;e<3;e++){const a=idx.getX(i+e),b=idx.getX(i+(e+1)%3),ay=p.getY(a),by=p.getY(b);if((ay<y)===(by<y)||Math.abs(ay-by)<1e-9)continue;const t=(y-ay)/(by-ay);box.expandByPoint(new T.Vector3(T.MathUtils.lerp(p.getX(a),p.getX(b),t),y,T.MathUtils.lerp(p.getZ(a),p.getZ(b),t)));n++}}if(n<6||box.isEmpty())throw Error('首断面の測定に失敗');return {center:box.getCenter(new T.Vector3()),size:box.getSize(new T.Vector3()),n}}
export function cropBody(g,cut){const p=g.attributes.position,idx=g.index;if(!idx)throw Error('人体index不足');const data={},attrs=Object.entries(g.attributes);for(const [name,a] of attrs)data[name]=Array.from(a.array);const out=[],edge=new Map();
function intersect(a,b){const key=Math.min(a,b)+':'+Math.max(a,b);if(edge.has(key))return edge.get(key);const t=(cut-p.getY(a))/(p.getY(b)-p.getY(a)),id=data.position.length/3;let joints=[],weights=[];if(g.attributes.skinIndex){const si=g.attributes.skinIndex,sw=g.attributes.skinWeight,m=new Map();for(let j=0;j<4;j++){for(const [k,w] of [[a,1-t],[b,t]]){const bone=si.array[k*4+j];m.set(bone,(m.get(bone)||0)+sw.array[k*4+j]*w)}}const best=[...m].sort((x,y)=>y[1]-x[1]).slice(0,4);const sum=best.reduce((s,x)=>s+x[1],0)||1;for(let j=0;j<4;j++){joints.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum)}}
for(const [name,at] of attrs){if(name==='skinIndex'){data[name].push(...joints);continue}if(name==='skinWeight'){data[name].push(...weights);continue}for(let k=0;k<at.itemSize;k++)data[name].push(T.MathUtils.lerp(at.array[a*at.itemSize+k],at.array[b*at.itemSize+k],t))}edge.set(key,id);return id}
for(let i=0;i<idx.count;i+=3){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)],poly=[];for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],inside=p.getY(a)<=cut,next=p.getY(b)<=cut;if(inside)poly.push(a);if(inside!==next)poly.push(intersect(a,b))}for(let k=1;k+1<poly.length;k++)out.push(poly[0],poly[k],poly[k+1])}
const result=new T.BufferGeometry();for(const [name,a] of attrs)result.setAttribute(name,new T.BufferAttribute(new a.array.constructor(data[name]),a.itemSize,a.normalized));result.setIndex(out);result.computeBoundingBox();result.computeBoundingSphere();return result}
export function deformBody(source,height,age,build,skinTone){const g=source.clone(),p=g.attributes.position;const color=new Float32Array(p.count*3);const cloth=new T.Color(0x405568),skin=skinTone||new T.Color(0xc9a08a);const fullness={ultraThin:-.15,thin:-.08,normal:0,fat:.28}[build]||0;const sag=age.sag||0;
for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=y/height;const torso=gauss(n,.59,.18)*(1-smooth(.16,.31,Math.abs(x))),head=smooth(.84,.90,n),cheek=gauss(n,.91,.035);const leg=(1-smooth(.43,.51,n))*smooth(.045,.12,n),sign=Math.sign(x),legCenter=sign*height*.067;const arm=smooth(height*.15,height*.24,Math.abs(x))*gauss(n,.65,.16)*(1-smooth(height*.27,height*.33,Math.abs(x)));x*=1+fullness*(torso+head*.48*cheek);x+=(x-legCenter)*fullness*.38*leg;z+=(z-height*.045)*fullness*(leg*.32+arm*.24);z+=fullness*height*.13*gauss(n,.59,.105)*(1-smooth(.16,.28,Math.abs(x)))*smooth(-.02,.15,z);y-=sag*height*.006*cheek*smooth(.025,.065,Math.abs(x));p.setXYZ(i,x,y,z);
const visibleSkin=n>.82||Math.abs(x)>height*.25;const c=visibleSkin?skin:cloth;color.set([c.r,c.g,c.b],i*3)}
g.setAttribute('color',new T.BufferAttribute(color,3));p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g}
const orig=new WeakMap(),pigment=new WeakMap();
const oldLine=(y,c,w=.0026)=>gauss(y,c,w);
function deformPoint(x,y,z,age,build,sex,out){const full={ultraThin:-.11,thin:-.055,normal:0,fat:.23}[build]||0,sag=age.sag||0,young=age.id==='under10'?.9:age.id==='teens'?.35:0;
const cheek=gauss(y,.024,.055)*smooth(.023,.058,Math.abs(x)),jaw=gauss(y,-.019,.035)*smooth(.025,.06,Math.abs(x)),front=smooth(.015,.085,z),neck=gauss(y,FACE_CUT,.045),male=sex==='male'?1:0;
out[0]=x*(1+full*(.75*cheek+.85*jaw+.35*neck)+male*.09*jaw+young*.035*cheek);
const hollow=gauss(y,.044,.027)*gauss(Math.abs(x),.056,.022)*front,jowl=gauss(y,.005,.024)*gauss(Math.abs(x),.043,.018)*front,underEye=gauss(y,.059,.010)*gauss(Math.abs(x),.036,.022)*front,temple=gauss(y,.094,.035)*gauss(Math.abs(x),.066,.015)*front;
const brow=gauss(Math.abs(x),.036,.045)*front,forehead=(oldLine(y,.117+.003*Math.cos(x*65))+oldLine(y,.132+.003*Math.cos(x*60))+oldLine(y,.146+.002*Math.cos(x*55)))*brow;
const fold=gauss(Math.abs(x),.023+(.043-y)*.48,.0042)*gauss(y,.018,.028)*front;
const crow=gauss(Math.abs(x),.059,.017)*front*(oldLine(y,.073+(Math.abs(x)-.047)*.36)+oldLine(y,.066-(Math.abs(x)-.047)*.38));
out[0]+=sag*(Math.sign(x)*(.006*jowl-.004*temple-.004*hollow));
out[1]=y-.018*sag*cheek*front-.010*sag*jaw*front-.007*sag*jowl+.006*young*jaw;
out[2]=z+(.008*full*cheek+.007*male*jaw-.007*sag*cheek)*front+sag*(-.007*hollow+.006*jowl+.0038*underEye-.004*temple-.0022*fold-.0014*forehead-.0011*crow);
return out}
export function deformFace(root,age,build,sex){const a=[0,0,0],b=[0,0,0],eps=.00005;const neutral=age.id==='twenties'&&build==='normal'&&sex==='female';root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,n=g.attributes.normal;if(!p)return;let r=orig.get(g);if(!r){r={p:Float32Array.from(p.array),m:(g.morphAttributes.position||[]).map(x=>Float32Array.from(x.array)),n:n?Float32Array.from(n.array):null,mn:(g.morphAttributes.normal||[]).map(x=>Float32Array.from(x.array))};orig.set(g,r)}
const mm=g.morphAttributes.position||[],nn=g.morphAttributes.normal||[];
if(neutral){p.array.set(r.p);if(n&&r.n)n.array.set(r.n);mm.forEach((x,i)=>x.array.set(r.m[i]));nn.forEach((x,i)=>x.array.set(r.mn[i]))}
else for(let i=0;i<p.count;i++){const k=i*3,x=r.p[k],y=r.p[k+1],z=r.p[k+2];deformPoint(x,y,z,age,build,sex,a);p.setXYZ(i,...a);
deformPoint(x+eps,y,z,age,build,sex,b);const j00=(b[0]-a[0])/eps,j10=(b[1]-a[1])/eps,j20=(b[2]-a[2])/eps;
deformPoint(x,y+eps,z,age,build,sex,b);const j01=(b[0]-a[0])/eps,j11=(b[1]-a[1])/eps,j21=(b[2]-a[2])/eps;
deformPoint(x,y,z+eps,age,build,sex,b);const j02=(b[0]-a[0])/eps,j12=(b[1]-a[1])/eps,j22=(b[2]-a[2])/eps;
const c00=j11*j22-j12*j21,c01=j12*j20-j10*j22,c02=j10*j21-j11*j20,c10=j02*j21-j01*j22,c11=j00*j22-j02*j20,c12=j01*j20-j00*j21,c20=j01*j12-j02*j11,c21=j02*j10-j00*j12,c22=j00*j11-j01*j10;
function normal(x,y,z){const u=c00*x+c01*y+c02*z,v=c10*x+c11*y+c12*z,w=c20*x+c21*y+c22*z,L=Math.hypot(u,v,w)||1;return [u/L,v/L,w/L]}
const base=n&&r.n?normal(r.n[k],r.n[k+1],r.n[k+2]):null;if(base)n.setXYZ(i,...base);
for(let j=0;j<mm.length;j++){const src=r.m[j],dx=src[k],dy=src[k+1],dz=src[k+2];if(g.morphTargetsRelative)mm[j].setXYZ(i,j00*dx+j01*dy+j02*dz,j10*dx+j11*dy+j12*dz,j20*dx+j21*dy+j22*dz);else mm[j].setXYZ(i,...deformPoint(dx,dy,dz,age,build,sex,b))}
if(base)for(let j=0;j<nn.length;j++){const src=r.mn[j];const q=g.morphTargetsRelative?normal(r.n[k]+src[k],r.n[k+1]+src[k+1],r.n[k+2]+src[k+2]):normal(src[k],src[k+1],src[k+2]);nn[j].setXYZ(i,...(g.morphTargetsRelative?q.map((x,l)=>x-base[l]):q))}
}
p.needsUpdate=true;if(n)n.needsUpdate=true;for(const a of [...mm,...nn])a.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();agePigment(o,g,r.p,age)})}
function agePigment(o,g,base,age){const name=o.name+' '+o.parent?.name+' '+o.geometry.name+' '+[].concat(o.material||[]).map(m=>m.name).join(' '),hair=/HAIR|sublocks/i.test(name),skin=/R8_SKIN|R20 neutral skin|R14 measured face detail|ear_/i.test(name)&&!/lash|eyelid lining/i.test(name);if(!hair&&!skin)return;const c=g.attributes.color;if(!c||c.itemSize<3)return;let r=pigment.get(g);if(!r){r=c.array.slice();pigment.set(g,r)}c.array.set(r);const strength=age.wrinkles||0;if(!strength){c.needsUpdate=true;return}
for(let i=0;i<c.count;i++){const x=base[i*3],y=base[i*3+1],z=base[i*3+2],X=Math.abs(x);if(hair){const f=strength*.78;c.setXYZ(i,c.getX(i)*(1-f)+.52*f,c.getY(i)*(1-f)+.50*f,c.getZ(i)*(1-f)+.46*f);continue}
const front=smooth(.055,.10,z),forehead=(oldLine(y,.117+.003*Math.cos(x*65))+oldLine(y,.132+.003*Math.cos(x*60))+oldLine(y,.146+.002*Math.cos(x*55)))*gauss(X,.035,.045)*front;
const fold=gauss(X,.023+(.043-y)*.48,.0042)*gauss(y,.018,.028)*front,crow=gauss(X,.059,.017)*front*(oldLine(y,.073+(X-.047)*.36)+oldLine(y,.066-(X-.047)*.38)),bag=gauss(y,.053,.006)*gauss(X,.036,.020)*front;
const freckle=Math.pow(Math.max(0,Math.sin(x*1190+y*650)*Math.sin(y*1000-x*480)),12)*gauss(y,.085,.07)*front;
const shade=1-strength*Math.min(.35,.18*forehead+.21*fold+.21*crow+.17*bag+.16*freckle);const red=c.getX(i),green=c.getY(i),blue=c.getZ(i);c.setXYZ(i,red*shade*(1-.045*strength),green*shade*(1-.015*strength),blue*shade*(1-.025*strength))}
c.needsUpdate=true}
export function neckTone(skin){const p=skin.geometry.attributes.position,c=skin.geometry.attributes.color;let n=0,r=0,g=0,b=0;if(c)for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-FACE_CUT)<.007){r+=c.getX(i);g+=c.getY(i);b+=c.getZ(i);n++}return n?new T.Color(r/n,g/n,b/n):new T.Color(0xc9a08a)}
