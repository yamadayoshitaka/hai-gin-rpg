import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildCombatObjectGeometry,CREATURE_VISUAL_SPECS}
 from '../src/combat-creature-geometry.js';

const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(source,/A SINGLE organic loft carries the neck directly into the cranial bowl/);
assert.match(source,/Articulated mandible has a broad ramus/);
assert.match(source,/Mucosa and tongue are tucked INSIDE the closing jaw/);
assert.match(source,/Masseter wraps the cranial-to-mandible hinge/);
assert.match(source,/Scapula and muscle tubes overlap/);
assert.match(source,/Organic curved thigh\/shin profiles/);
const specification=CREATURE_VISUAL_SPECS.dragon_lord;
const expectedRgb=new THREE.Color(specification.skin);

function matchingVertices(mesh,tint,zTarget,limit=.045){
 const p=mesh.getAttribute('position'),colors=mesh.getAttribute('color');
 const points=[];
 for(let i=0;i<p.count;i++){
   const d=Math.abs(colors.getX(i)-tint.r)+Math.abs(colors.getY(i)-tint.g)
    +Math.abs(colors.getZ(i)-tint.b);
   if(d<.0003&&Math.abs(p.getZ(i)-zTarget)<=limit&&
      p.getY(i)>3.20&&p.getY(i)<4.08)points.push({
       x:p.getX(i),y:p.getY(i),z:p.getZ(i)
      });
 }
 return points;
}

const geometryByLod={};
for(const detail of ['high','low']){
 const geometry=buildCombatObjectGeometry('dragon_lord',{detail});
 geometryByLod[detail]=geometry;
 for(const part of ['core','jaw','eyes','armL','armR','legBackL',
   'legBackR','wingL','wingR','tail']){
   assert.ok(geometry[part],`Missing independent ${part} in ${detail}`);
   const p=geometry[part].getAttribute('position');
   assert.ok(p?.array.every(Number.isFinite),`NaN ${detail} ${part}`);
   assert.equal(geometry[part].getAttribute('normal')?.count,p.count,
     `Normals missing ${detail} ${part}`);
 }
 for(const z of [1.10,1.34,1.55,1.70]){
   const upper=matchingVertices(geometry.core,expectedRgb,z,detail==='low'?.09:.055);
   const lower=matchingVertices(geometry.jaw,expectedRgb,z,detail==='low'?.10:.06);
   assert.ok(upper.length>=4&&lower.length>=4,
      `Missing anatomical upper/lower jaw section ${detail} z=${z} ${upper.length}/${lower.length}`);
   const floor=Math.min(...upper.map(v=>v.y));
   const roof=Math.max(...lower.map(v=>v.y));
   assert.ok(roof>=floor-.025,
      `Visible floating dragon jaw in idle ${detail} z=${z}: gap ${(floor-roof).toFixed(4)}`);
 }
 // A compact adult cranium and nose: before this patch the skull was a
 // long narrow rod extending to z=2.03 with a detached tooth tray.
 const p=geometry.core.getAttribute('position'),col=geometry.core.getAttribute('color');
 let tip=-Infinity,midWidth=0;
 for(let i=0;i<p.count;i++){
   const d=Math.abs(col.getX(i)-expectedRgb.r)+Math.abs(col.getY(i)-expectedRgb.g)+
    Math.abs(col.getZ(i)-expectedRgb.b);
   if(d>.0003||p.getY(i)<3.25)continue;
   tip=Math.max(tip,p.getZ(i));
   if(Math.abs(p.getZ(i)-1.10)<.065)midWidth=Math.max(midWidth,Math.abs(p.getX(i)));
 }
 assert.ok(tip>=1.77&&tip<=1.96,
   `Dragon snout still stretched: ${detail} z=${tip.toFixed(3)}`);
 assert.ok(midWidth>.40,
   `Dragon skull still too narrow ${detail}: ${midWidth.toFixed(3)}`);
 const eye=geometry.eyes,pos=eye.getAttribute('position'),
   pigment=eye.getAttribute('color'),iris=new THREE.Color(specification.eyes);
 let irisVisible=0,eyeWide=0;
 for(let i=0;i<pos.count;i++){
   const d=Math.abs(pigment.getX(i)-iris.r)+Math.abs(pigment.getY(i)-iris.g)+
    Math.abs(pigment.getZ(i)-iris.b);
   if(d>.0003)continue;
   if(Math.abs(pos.getX(i))>.44&&Math.abs(pos.getZ(i)-1.16)<.10){
     irisVisible++;
     eyeWide=Math.max(eyeWide,Math.abs(pos.getX(i)));
   }
 }
 assert.ok(irisVisible>40&&eyeWide>.45,
   `Dragon iris buried in skull: ${detail} visible=${irisVisible}`);
}
const count=pieces=>Object.values(pieces).reduce((acc,g)=>acc+g.getAttribute('position').count,0);
assert.ok(count(geometryByLod.high)<225000,
  'Redesigned jaw, head and limbs must stay in the original mobile GPU budget: '+count(geometryByLod.high));
assert.ok(count(geometryByLod.high)>count(geometryByLod.low)*3,
 'High/low dragon lord LOD differentiation regressed');
for(const [detail,geos] of Object.entries(geometryByLod)){
 const jaw=geos.jaw.getAttribute('position'),c=geos.jaw.getAttribute('color');
 let front=null;
 for(let i=0;i<jaw.count;i++){
   const d=Math.abs(c.getX(i)-expectedRgb.r)+Math.abs(c.getY(i)-expectedRgb.g)+
    Math.abs(c.getZ(i)-expectedRgb.b);
   if(d>.0003||jaw.getZ(i)<1.68||jaw.getZ(i)>1.79)continue;
   if(!front||jaw.getY(i)>front.y)front={y:jaw.getY(i),z:jaw.getZ(i)};
 }
 assert.ok(front,'The opening jaw lost its anterior edge '+detail);
 // Same hinge as in the renderer; positive pitch must open downward, while
 // rest pose (zero rotation) cannot leave its whole lower jaw detached.
 const hingeY=3.72-.26,hingeZ=.92-.10,pitch=.52;
 const yOpen=hingeY+(front.y-hingeY)*Math.cos(pitch)-
   (front.z-hingeZ)*Math.sin(pitch);
 assert.ok(yOpen<front.y-.32,
  `Jaw does not open as a separate hinged organ ${detail}`);
 for(const geo of Object.values(geos))geo.dispose();
}
console.log('Dragon Lord fused neck/skull and seated hinged jaw regression: PASS');
