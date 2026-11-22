import * as THREE from 'three';

/**
 * Reference-grade skin shading for the actual editable donor head.
 *
 * The same indexed head carries its blush and lipstick vertex pigment.
 * v90LipWetness is a ONE-component attribute on the very same triangles,
 * so the lower-roughness vermilion region follows 3D facial deformations
 * instead of being a detached clearcoat/texture plane.
 *
 * This uses no remote textures and never modifies the source GLB.
 */
export function createReferenceFaceSkinMaterial(gender='female'){
 const material=new THREE.MeshPhysicalMaterial({
  color:gender==='male'?0xbfc3cb:0xebc5b7,roughness:.79,metalness:0,
  clearcoat:.045,clearcoatRoughness:.48,
  sheen:.085,sheenColor:new THREE.Color(0xf0bcae),
  sheenRoughness:.80,
  ior:1.42,specularIntensity:.51,
  side:THREE.FrontSide,flatShading:false
 });
 material.onBeforeCompile=shader=>{
  const begin='#include <common>',position='#include <begin_vertex>';
  const roughness='#include <roughnessmap_fragment>';
  shader.vertexShader=shader.vertexShader
   .replace(begin,begin+'\nattribute float v90LipWetness;\nvarying float vReferenceLipWetness;')
   .replace(position,position+'\nvReferenceLipWetness = v90LipWetness;');
  shader.fragmentShader=shader.fragmentShader
   .replace(begin,begin+'\nvarying float vReferenceLipWetness;')
   .replace(roughness,roughness+
    '\nroughnessFactor *= mix(1.0, 0.54, clamp(vReferenceLipWetness, 0.0, 1.0));');
 };
 material.customProgramCacheKey=()=> 'reference-skin-pbr-v90-native-lip-roughness';
 material.userData.v90LipGlossFollowsHeadVertices=true;
 material.userData.v90SkinAndVermilionRoughnessSeparated=true;
 return material;
}
