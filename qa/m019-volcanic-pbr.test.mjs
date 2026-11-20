import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {m019VolcanicSurface} from '../src/m019-volcanic-surface.js';

for(const detail of ['low','high']){
 test('m019 '+detail+' has real basalt/lava texture on body, all four limbs and paws',()=>{
  const maps=m019VolcanicSurface(detail);
  assert.equal(m019VolcanicSurface(detail),maps,
    'textures must be generated once and shared, not per monster or limb');
  const size=detail==='low'?96:192;
  assert.equal(maps.resolution,size);
  for(const name of ['albedo','normal','roughness','emissive']){
   const tex=maps[name];
   assert.equal(tex.isDataTexture,true,name+' must be actual uploaded image data');
   assert.equal(tex.image.width,size);
   assert.equal(tex.image.height,size);
   assert.equal(tex.image.data.length,size*size*4);
  }
  const col=maps.albedo.image.data,hot=maps.emissive.image.data;
  let dark=0,light=0,heated=0,unheated=0;
  for(let i=0;i<hot.length;i+=4){
   if(col[i]<135)dark++;
   if(col[i]>175)light++;
   if(hot[i]>70)heated++;
   if(hot[i]===0)unheated++;
  }
  assert(dark>size*size*.015&&light>size*size*.08,
    'basalt must have visible variation, not uniform painted colour');
  assert(heated>size*size*.002&&heated<size*size*.25,
    'molten cracks must be sparse and truly emissive');
  assert(unheated>size*size*.65,
    'most of the rock must remain dark unlit basalt');
  const model=createMonsterModel(MONSTER_BY_ID.m019,{detail});
  try{
   const meshes=[];
   model.traverse(o=>{if(o.isMesh)meshes.push(o)});
   const body=meshes.find(m=>m.name==='species-shoulder-rib-pelvis-m019');
   assert(body?.isMesh);
   const inspect=[body];
   for(const id of ['frontL','frontR','rearL','rearR']){
    for(const suffix of ['m019-mobile-upper-','m019-mobile-shin-',
      'm019-metatarsal-']){
      const obj=meshes.find(m=>m.name===suffix+id);
      assert(obj?.isMesh,suffix+id+' missing model');
      inspect.push(obj);
    }
   }
   for(const mesh of inspect){
    const m=mesh.material,uv=mesh.geometry.getAttribute('uv');
    assert(uv?.count>10,mesh.name+' needs UVs for actual texture sampling');
    assert.equal(m.userData.m019VolcanicPBR,true,mesh.name);
    assert.equal(m.userData.m019DryObsidian,true);
    assert.equal(m.userData.m019LavaHeatOnlyInFissures,true);
    assert.equal(m.userData.m019TextureResolution,size);
    assert.equal(m.userData.photoSurface,
      'tiled-volcanic-rock-albedo-normal-emissive');
    assert.equal(m.map,maps.albedo,'whole creature shares the same rock texture');
    assert.equal(m.normalMap,maps.normal);
    assert.equal(m.roughnessMap,maps.roughness);
    assert.equal(m.emissiveMap,maps.emissive);
    assert(m.emissiveIntensity>.25&&m.emissiveIntensity<.6);
    assert(m.roughness>.9&&m.metalness<.05);
    assert(m.transparent===false&&m.depthWrite===true);
   }
   assert(!meshes.some(m=>m.name.startsWith('m019-seamless-skin-')),
    'must not resurrect the CPU-overlaid arm tube');
  }finally{
   disposeMonsterSculpture(model);
  }
 });
}
