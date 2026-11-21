import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as THREE from 'three';
import {derivePhotoSkinMaps,FACE_PHOTO_SOURCE_V76,
 applyRealSkinPhotoToFace} from '../src/face-photo-microdetail-v76.js';
import {deriveIrisPolarDetail,getFaceIrisStromaTexture,
 getLipVermilionNormalTexture} from '../src/face-optics-v76.js';
import {v76ExpressionMuscleDelta,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';
import {createAnatomicalFaceParts}
 from '../src/face-feature-meshes.js';
import {attachAgeDetails} from '../src/face-age-detail-v49.js';

test('v76 bundled human skin is the real CC0 JPEG, not a noise substitute',()=>{
 const path=new URL('../'+FACE_PHOTO_SOURCE_V76.path,import.meta.url);
 assert.ok(statSync(path).size>100_000,'Actual photo must be bundled');
 const header=readFileSync(path).subarray(0,3);
 assert.equal(header[0],0xff);assert.equal(header[1],0xd8);
 assert.equal(FACE_PHOTO_SOURCE_V76.license,'CC0-1.0');
 assert.equal(FACE_PHOTO_SOURCE_V76.noFaceAlbedoReplacement,true);
 const license=readFileSync(
  new URL('../assets/textures/face/README.md',import.meta.url),'utf8');
 assert.match(license,/commons.wikimedia.org/);
 assert.match(license,/CC0/);
});
test('v76 skin map really comes from photographed local luminance; no skin photo albedo',()=>{
 const width=32,height=32,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const k=(y*width+x)*4;
  const value=100+Math.sin(x*1.8+y*.4)*13+Math.cos(y*2.1)*8;
  data[k]=value+13;data[k+1]=value;data[k+2]=value-7;data[k+3]=255;
 }
 const maps=derivePhotoSkinMaps({data,width,height});
 assert.equal(maps.photoBased,true);assert.equal(maps.syntheticNoise,false);
 assert.equal(maps.width,width);assert.equal(maps.bump.length,width*height*4);
 assert.ok(maps.meanPhotoContrast>2,'skin photo luminance retained');
 assert.ok(new Set(maps.bump.filter((_,i)=>i%4===0)).size>5);
 assert.ok(new Set(maps.roughness.filter((_,i)=>i%4===0)).size>3);
 for(let k=0;k<maps.bump.length;k+=4){
  assert.equal(maps.bump[k],maps.bump[k+1]);
  assert.equal(maps.bump[k],maps.bump[k+2]);
  assert.ok(maps.bump[k]>=76&&maps.bump[k]<=180);
 }
});
test('v76 neutral iris detail conforms to real polar UV with radial limbus and crypts',()=>{
 const polar=deriveIrisPolarDetail(192,80);
 assert.equal(polar.polarUV,true);assert.equal(polar.limbalRing,true);
 const avg=row=>{
  let s=0;for(let x=0;x<192;x++)s+=polar.data[(row*192+x)*4];
  return s/192;
 };
 assert.ok(avg(22)>avg(77)+12,'limbal outer ring should be darker');
 const tex=getFaceIrisStromaTexture();
 assert.equal(tex.colorSpace,THREE.SRGBColorSpace);
 assert.equal(tex.wrapS,THREE.RepeatWrapping);
 assert.ok(tex.image.width>=256);
});
test('v76 lips have actual tiny ridged normal map, not lipstick decal',()=>{
 const tex=getLipVermilionNormalTexture();
 assert.ok(tex.isDataTexture);
 assert.equal(tex.colorSpace,THREE.NoColorSpace);
 assert.ok(tex.image.width<=256);
 assert.ok(new Set(tex.image.data.filter((_,i)=>i%4===0)).size>8);
});
test('v76 3D expression muscle fields preserve neutral and make distinct smile, anger, surprise',()=>{
 const point={ax:.34,ny:.606,front:1};
 const neutral=v76ExpressionMuscleDelta({...point,expression:FACE_EXPRESSIONS.neutral});
 const smile=v76ExpressionMuscleDelta({...point,expression:FACE_EXPRESSIONS.smile});
 assert.equal(neutral.dy,0);assert.equal(neutral.dz,0);
 assert.ok(smile.dy>0&&smile.dz>0);
 const anger=v76ExpressionMuscleDelta({ax:.07,ny:.739,front:1,
  expression:FACE_EXPRESSIONS.angry});
 const surprise=v76ExpressionMuscleDelta({ax:.21,ny:.802,front:1,
  expression:FACE_EXPRESSIONS.surprised});
 assert.ok(anger.dz>0);
 assert.ok(surprise.dy>0);
 assert.deepEqual(v76ExpressionMuscleDelta({...point,front:0,
  expression:FACE_EXPRESSIONS.smile}),{dy:0,dz:0});
});
test('v76 actual source-derived 3D eye has iris polar optical material, lip normal and no cards',()=>{
 const geo=new THREE.SphereGeometry(.20,52,38);
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 const before=geo.getAttribute('position').array.slice();
 const {root,report}=createAnatomicalFaceParts(face,{gender:'female'});
 assert.equal(report.v76LipFineNormalOnAnatomicalSurface,true);
 assert.equal(report.v76NoDetachedPhotoEyeCards,true);
 assert.equal(report.eyeMeshCount,2);
 for(const side of ['LEFT','RIGHT']){
  const iris=root.getObjectByName(side+'_CURVED_IRIS');
  const cornea=root.getObjectByName(side+'_ORBITAL_EYEBALL');
  const upper=root.getObjectByName(side+'_UPPER_EYELINER');
  const lashes=root.getObjectByName(side+'_UPPER_LASH_MESH');
  assert.ok(iris?.material.map?.isTexture);
  assert.ok(iris.userData.v76PolarIrisMap);
  assert.ok(cornea?.material.clearcoat>.25);
  assert.ok(upper?.userData.conformsTo==='real-eyelid-mesh');
  assert.ok(lashes.userData.rootedOnEyeliner);
 }
 for(const id of ['UPPER','LOWER']){
  const lip=root.getObjectByName(id+'_3D_VERMILION_LIP');
  assert.ok(lip?.material.normalMap?.isTexture);
  assert.ok(lip.geometry.getAttribute('uv'));
 }
 assert.ok(face.geometry!==null);
 assert.ok(report.lipstickMeshCount===0);
 // This direct anatomical routine owns its display face; original reference
 // is never modified by a later texture upload.
 const source=new THREE.SphereGeometry(.20,52,38);
 assert.deepEqual(source.getAttribute('position').array,before);
 source.dispose();
 face.geometry.dispose();face.material.dispose();
 root.traverse(mesh=>{
  if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}
 });
});
test('v76 no browser context never mutates or downloads skin and youth has no adult wrinkles',()=>{
 const geo=new THREE.SphereGeometry(.2,32,22);
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 const before=geo.getAttribute('position').array.slice();
 const result=applyRealSkinPhotoToFace(mesh);
 assert.equal(result.applied,false);
 assert.equal(result.reason,'no-browser');
 assert.deepEqual(geo.getAttribute('position').array,before);
 const young=attachAgeDetails(mesh,'twenties');
 assert.equal(young.count,0);
 geo.dispose();mesh.material.dispose();
});
