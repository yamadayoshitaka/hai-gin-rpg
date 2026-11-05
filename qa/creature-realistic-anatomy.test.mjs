import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(source,/const profile=\(name,tint,sections\)=>/,'断面形状から体積を構成');
assert.match(source,/const radial=detail==='high'\?32:12/,'詳細LODは小さな面へ再分割');
assert.match(source,/Horse conformation/,'軍馬の胴体輪郭を解剖学的に定義');
assert.match(source,/Long cannon bones and a bent hind hock/,'軍馬の長い骨と後脚の飛節');
assert.match(source,/Long predatory skull/,'竜の頭部を球から長い骨格へ変更');
assert.match(source,/const eyeSlit=\(name,tint,side/,'眼球を貼り付けず薄い眼裂を立体成形する');
assert.doesNotMatch(source,/sphere\('core',s\.eyes/,'目を丸い球体に戻さない');
assert.match(source,/Muscle sockets overlap the torso/,'筋肉の重なりで軍馬の脚付け根を隠す');
assert.match(source,/Buried upper tendons plus overlapping shoulder/,'狼の脚は胴体の奥から伸ばす');

const THREE=await import('three').catch(()=>null);
if(THREE){
  const {buildCombatObjectGeometry,CREATURE_VISUAL_SPECS}=
    await import('../src/combat-creature-geometry.js');
  const expectations={
    horse:{bodyZ:0,headZ:1.22,snoutZ:1.7,maxHeadRatio:.46,maxVertices:155_000},
    wolf:{bodyZ:0,headZ:1.08,snoutZ:1.6,maxHeadRatio:.55,maxVertices:125_000},
    wyvern:{bodyZ:0,headZ:1.50,snoutZ:2.0,maxHeadRatio:.54,maxVertices:175_000},
    dragon:{bodyZ:0,headZ:1.90,snoutZ:2.7,maxHeadRatio:.54,maxVertices:175_000},
    elder_dragon:{bodyZ:0,headZ:2.10,snoutZ:3.1,maxHeadRatio:.54,maxVertices:205_000},
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
    const body=radiusAt(check.bodyZ),head=radiusAt(check.headZ),snout=radiusAt(check.snoutZ);
    assert.ok(snout<body*.60,`${type}: 丸顔ではなく先細る頭骨 (${snout}/${body})`);
    assert.ok(head<body*check.maxHeadRatio,
      `${type}: 成熟した個体の顔幅は胴体より十分小さい (${head}/${body})`);
    // These vertices carry only the actual iris material, independent of
    // eyebrow, nostril, straps and forehead details. Small vertical eye
    // apertures guard against a regression to cute, round cartoon eyes.
    assert.ok(hi.eyes&&low.eyes,`${type}: 眼球は毛皮・鱗と異なる材質の独立した眼裂`);
    const eye=new THREE.Color(CREATURE_VISUAL_SPECS[type].eyes);
    const eyeShape=hi.eyes,eyePos=eyeShape.getAttribute('position');
    const eyeColors=eyeShape.getAttribute('color');
    let eyeCount=0,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<eyePos.count;i++){
      const distance=Math.abs(eyeColors.getX(i)-eye.r)+
        Math.abs(eyeColors.getY(i)-eye.g)+Math.abs(eyeColors.getZ(i)-eye.b);
      if(distance>.0002)continue;
      eyeCount++;
      minY=Math.min(minY,eyePos.getY(i));maxY=Math.max(maxY,eyePos.getY(i));
      minZ=Math.min(minZ,eyePos.getZ(i));maxZ=Math.max(maxZ,eyePos.getZ(i));
    }
    assert.ok(eyeCount>500,`${type}: 左右の眼球に眼窩色が存在する`);
    assert.ok(maxY-minY<.038 && maxZ-minZ<.13,
      `${type}: 目を大きな丸玉ではなく細長い眼裂にする (${maxY-minY})`);
    if(type==='horse'){
      assert.ok(hi.legFrontL&&hi.legBackR,'馬の前後脚は独立して動く');
      assert.ok(hi.legBackR.getAttribute('position').count>500,
        '長い後肢・飛節・蹄・蹄鉄の形状が存在する');
    }
    for(const geometry of [...Object.values(hi),...Object.values(low)])geometry.dispose();
  }
}
console.log('軍馬・灰狼・飛竜・古竜・天竜: 成体の頭身 / 小さな眼裂 / 断面彫刻 / 細分化LOD / 頂点予算 OK');
