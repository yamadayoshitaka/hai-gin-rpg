import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(source,/const profile=\(name,tint,sections\)=>/,'断面形状から体積を構成');
assert.match(source,/const radial=detail==='high'\?32:12/,'詳細LODは小さな面へ再分割');
assert.match(source,/Horse conformation/,'軍馬の胴体輪郭を解剖学的に定義');
assert.match(source,/Long cannon bones and a bent hind hock/,'軍馬の長い骨と後脚の飛節');
assert.match(source,/Long predatory skull/,'竜の頭部を球から長い骨格へ変更');

const THREE=await import('three').catch(()=>null);
if(THREE){
  const {buildCombatObjectGeometry,CREATURE_VISUAL_SPECS}=
    await import('../src/combat-creature-geometry.js');
  const expectations={
    horse:{bodyZ:0,snoutZ:1.7,maxVertices:155_000},
    wolf:{bodyZ:0,snoutZ:1.6,maxVertices:125_000},
    dragon:{bodyZ:0,snoutZ:2.7,maxVertices:175_000},
  };
  for(const [type,check] of Object.entries(expectations)){
    const hi=buildCombatObjectGeometry(type,{detail:'high'});
    const low=buildCombatObjectGeometry(type,{detail:'low'});
    const vertices=Object.values(hi).reduce((n,g)=>n+g.getAttribute('position').count,0);
    const lowVertices=Object.values(low).reduce((n,g)=>n+g.getAttribute('position').count,0);
    assert.ok(vertices<check.maxVertices,`${type} の有機体を作り直して頂点負荷を抑制`);
    assert.ok(vertices>lowVertices*4,`${type} の精細/遠景LODを維持`);
    const shape=hi.core,pos=shape.getAttribute('position'),colors=shape.getAttribute('color');
    const skin=new THREE.Color(CREATURE_VISUAL_SPECS[type].skin);
    const radiusAt=(z)=>{
      let widest=0,matched=0;
      for(let i=0;i<pos.count;i++){
        const distance=Math.abs(colors.getX(i)-skin.r)+
          Math.abs(colors.getY(i)-skin.g)+Math.abs(colors.getZ(i)-skin.b);
        if(distance>.0002||Math.abs(pos.getZ(i)-z)>.065)continue;
        const y=pos.getY(i);
        if(y<.5||y>4)continue;
        widest=Math.max(widest,Math.abs(pos.getX(i)));matched++;
      }
      assert.ok(matched>100,`${type}: 体表面の断面を頂点データから検査`);
      return widest;
    };
    const body=radiusAt(check.bodyZ),snout=radiusAt(check.snoutZ);
    assert.ok(snout<body*.60,`${type}: 丸顔ではなく先細る頭骨 (${snout}/${body})`);
    if(type==='horse'){
      assert.ok(hi.legFrontL&&hi.legBackR,'馬の前後脚は独立して動く');
      assert.ok(hi.legBackR.getAttribute('position').count>500,
        '長い後肢・飛節・蹄・蹄鉄の形状が存在する');
    }
    for(const geometry of [...Object.values(hi),...Object.values(low)])geometry.dispose();
  }
}
console.log('馬・灰狼・古竜: 断面彫刻 / 長い脚 / 先細る頭部 / 細分化LOD / 頂点予算 OK');
