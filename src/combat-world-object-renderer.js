/**
 * Battlefield creatures and mounts are a separate world-object layer.
 * Each type is one merged, GPU-instanced module; no human skeleton or outfit
 * mesh is used. When licensed creature GLBs are supplied, replace recipes,
 * not object IDs, ownership or the combat-action contract.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COMBAT_OBJECT_SPECS } from './combat-action-spec.js';

function objectGeometry(type) {
  const pieces = [];
  const part = (shape, color, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) => {
    const geo = shape.toNonIndexed();
    geo.scale(sx, sy, sz); geo.rotateZ(rz); geo.translate(x, y, z);
    const rgb = new THREE.Color(color), colors = new Float32Array(geo.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = rgb.r; colors[i+1] = rgb.g; colors[i+2] = rgb.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(geo);
  };
  const ellipsoid = (col,x,y,z,sx,sy,sz) => part(new THREE.SphereGeometry(1,10,8),col,x,y,z,sx,sy,sz);
  const cone = (col,x,y,z,sx,sy,sz,rz=0) => part(new THREE.ConeGeometry(1,1,7),col,x,y,z,sx,sy,sz,rz);
  const box = (col,x,y,z,sx,sy,sz) => part(new THREE.BoxGeometry(1,1,1),col,x,y,z,sx,sy,sz);
  if (type === 'trap' || type === 'dynamite') {
    const c = type === 'trap' ? 0x64483b : 0xa33b24;
    part(new THREE.CylinderGeometry(.26,.29,.65,9),c,0,.36,0,1,1,1);
    box(0x36353b,0,.67,0,.7,.08,.6);
    cone(0xf0a343,0,.86,0,.07,.27,.07);
  } else {
    const horse = type === 'horse';
    const wolf = type === 'wolf';
    const elder = type === 'elder_dragon';
    const dragon = type === 'dragon' || elder;
    const winged = dragon || type === 'wyvern';
    const base = horse ? 0x754b32 : wolf ? 0x737b83 : elder ? 0xa8893d : dragon ? 0x47785a : 0x6d6a9c;
    const dark = horse ? 0x32251e : wolf ? 0x3c454d : elder ? 0x654423 : dragon ? 0x274f44 : 0x34385d;
    const pale = horse ? 0xb58b61 : wolf ? 0xb0b9c1 : elder ? 0xd1b16e : dragon ? 0x83a88b : 0xa7a4c7;
    const bodyY = horse ? 1.07 : wolf ? .65 : dragon ? 1.7 : 1.1;
    ellipsoid(base,0,bodyY,0,horse?.43:wolf?.32:dragon?.77:.48,horse?.45:wolf?.28:dragon?.64:.42,horse?.95:wolf?.7:dragon?1.4:.95);
    ellipsoid(pale,0,bodyY+.08,.36,horse?.35:wolf?.22:dragon?.6:.33,.24,.32);
    const neck = horse ? {z:.66,y:1.47} : wolf ? {z:.6,y:.81} : {z:.8,y:bodyY+.37};
    ellipsoid(base,0,neck.y,neck.z,horse?.24:.24,horse?.55:.35,.3);
    ellipsoid(base,0,neck.y+(horse?.37:.2),neck.z+.25,horse?.25:wolf?.23:dragon?.43:.34,horse?.23:wolf?.18:.31,.32);
    ellipsoid(pale,0,neck.y+(horse?.3:.11),neck.z+.5,.18,.14,.26);
    for (const side of [-1,1]) {
      const legX = side * (horse?.30:wolf?.24:dragon?.54:.34);
      for (const legZ of [-.56,.55]) {
        const upper = horse ? .60 : wolf ? .35 : dragon ? 1.02 : .65;
        ellipsoid(base,legX,upper,legZ,.14,upper*.66,.17);
        ellipsoid(dark,legX,.12,legZ+.05,.17,.13,.22);
      }
      cone(dark,side*(horse?.17:.23),neck.y+(horse?.62:.42),neck.z+.16,.12,.38,.12,side*.18);
      if (winged) {
        // Broad folded membranes and bone spurs, kept inside this single mesh.
        box(dark,side*(dragon?1.15:.87),bodyY+.33,-.14,dragon?1.65:1.2,.09,dragon?1.15:.9);
        cone(pale,side*(dragon?1.93:1.55),bodyY+.48,-.35,.22,dragon?.72:.45,.15,side*.45);
      }
    }
    cone(dark,0,bodyY+.2,-(horse?1.18:wolf?.96:dragon?1.78:1.18),.18,horse?.86:wolf?.6:dragon?1.25:.85,.2,Math.PI*.8);
    if (horse) {
      box(0x312925,0,1.52,-.2,.64,.18,.58);
      box(0x9f804b,0,1.61,-.2,.45,.07,.56);
      for (let i = 0; i < 5; i++) cone(dark,0,1.85-i*.16,.46+i*.07,.12,.23,.16,.6);
    }
    if (dragon) {
      for (let i = 0; i < 6; i++) cone(pale,0,bodyY+.55-i*.025,-.82+i*.35,.18,.42,.2);
      ellipsoid(0xf19b45,0,neck.y+.25,neck.z+.56,.10,.09,.07);
    }
  }
  const merged = mergeGeometries(pieces, false);
  for (const g of pieces) g.dispose();
  if (!merged) throw Error('戦場オブジェクトのジオメトリ統合に失敗: ' + type);
  merged.computeVertexNormals(); return merged;
}

export function createCombatWorldObjectRenderer(scene, { cellSize = 1.12, offset = 6, terrainY = () => 0 } = {}) {
  const types = Object.keys(COMBAT_OBJECT_SPECS);
  const meshes = new Map(), temp = new THREE.Object3D(), maxPerType = 72;
  for (const type of types) {
    const mesh = new THREE.InstancedMesh(objectGeometry(type), new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.05,side:THREE.DoubleSide}), maxPerType);
    mesh.count = 0;mesh.frustumCulled = false;mesh.castShadow = true;mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = 'CombatWorldObject_' + type;scene.add(mesh);meshes.set(type,mesh);
  }
  function sync(objects, time = 0, units = null) {
    const counts = Object.fromEntries(types.map(type => [type,0]));
    for (const o of objects) {
      if (!o.alive || !meshes.has(o.type) || counts[o.type] >= maxPerType) continue;
      const rider = o.mountedBy != null && units ?
        (units[o.mountedBy]?.id === o.mountedBy ? units[o.mountedBy] : units.find(u => u.id === o.mountedBy)) : null;
      const x = rider?.x ?? o.x, z = rider?.z ?? o.z;
      const px = (x-offset)*cellSize, pz=(z-offset)*cellSize;
      temp.position.set(px,terrainY(px,pz)+(o.flying?2.6+.18*Math.sin(time*3+Number(o.id.split('-').pop())):0),pz);
      const scale = o.type==='elder_dragon'?1.55:o.type==='dragon'?1.35:o.type==='wyvern'?1.05:1;
      temp.scale.setScalar(scale);temp.rotation.set(0,(o.team===0?Math.PI/2:-Math.PI/2)+Math.sin(time*.6)*.08,0);temp.updateMatrix();
      meshes.get(o.type).setMatrixAt(counts[o.type]++,temp.matrix);
    }
    for (const type of types) { const mesh=meshes.get(type);mesh.count=counts[type];if(mesh.count)mesh.instanceMatrix.needsUpdate=true; }
  }
  function dispose() { for (const mesh of meshes.values()) {scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();} }
  return {sync,dispose,stats:()=>Object.fromEntries(types.map(type=>[type,meshes.get(type).count]))};
}
