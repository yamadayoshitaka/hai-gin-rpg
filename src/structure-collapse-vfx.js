/** Shared, instanced fire/smoke and falling masonry for real battlefield buildings. */
export function structureEffectLayout(definition,cellSize=1){
  const {minX,maxX,minZ,maxZ}=definition.bounds;
  const width=Math.max(1,maxX-minX),depth=Math.max(1,maxZ-minZ);
  const isBridge=definition.type==='bridge';
  const kind=definition.source?.data?.kind??(isBridge?definition.source?.type+'_bridge':'hut');
  const floors=definition.source?.structure?.floors?.length??1;
  const height=isBridge?1.3:Math.min(22,Math.max(2.5,floors*3.1+(kind==='castle'?2:0)));
  return {width,depth,height,kind,isBridge,
    fireCount:Math.min(26,Math.max(9,Math.round(Math.sqrt(width*depth)*.85))),
    shardCount:Math.min(48,Math.max(16,Math.round(Math.sqrt(width*depth)*1.3))),
    centerX:((minX+maxX)/2-6)*cellSize,centerZ:((minZ+maxZ)/2-6)*cellSize};
}

export class StructureCollapseVfx {
  constructor(THREE,scene,{cellSize=1,terrainHeight=()=>0}={}){
    this.THREE=THREE;this.scene=scene;this.cellSize=cellSize;
    this.terrainHeight=terrainHeight;this.active=new Map();
    this.fireGeometry=new THREE.ConeGeometry(.20,.9,5);
    this.smokeGeometry=new THREE.IcosahedronGeometry(.32,0);
    this.shardGeometry=new THREE.BoxGeometry(1,1,1);
    this.fireMaterial=new THREE.MeshBasicMaterial({color:0xff6725,transparent:true,opacity:.88,
      depthWrite:false,blending:THREE.AdditiveBlending});
    this.smokeMaterial=new THREE.MeshBasicMaterial({color:0x383b40,transparent:true,opacity:.36,
      depthWrite:false});
    this.shardMaterials={wood:new THREE.MeshStandardMaterial({color:0x77503a,roughness:1}),
      stone:new THREE.MeshStandardMaterial({color:0x8c8780,roughness:1})};
    this.dummy=new THREE.Object3D();
  }
  ignite(definition,now,{burnUntil=now+24}={}){
    const old=this.active.get(definition.id);
    if(old){old.burnUntil=Math.max(old.burnUntil,burnUntil);return old;}
    const layout=structureEffectLayout(definition,this.cellSize);
    const fires=new this.THREE.InstancedMesh(this.fireGeometry,this.fireMaterial,layout.fireCount);
    const smokes=new this.THREE.InstancedMesh(this.smokeGeometry,this.smokeMaterial,layout.fireCount);
    fires.name='StructureBurningFlames';smokes.name='StructureBurningSmoke';
    fires.frustumCulled=false;smokes.frustumCulled=false;
    fires.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);
    smokes.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);
    this.scene.add(fires,smokes);
    const effect={definition,layout,fires,smokes,ignitedAt:now,
      burnUntil,collapsedAt:null,shards:null,onSettled:null};
    this.active.set(definition.id,effect);
    this.paint(effect,now);return effect;
  }
  extinguish(id,now){const e=this.active.get(id);if(e)e.burnUntil=Math.min(e.burnUntil,now);}
  collapse(definition,now,onSettled){
    const effect=this.ignite(definition,now,{burnUntil:now+3});
    if(effect.collapsedAt!=null)return;
    effect.collapsedAt=now;effect.burnUntil=Math.min(effect.burnUntil,now+3);
    effect.onSettled=onSettled;
    const wood=effect.layout.kind==='house'||effect.layout.kind==='hut'||
      effect.layout.kind==='timber_bridge'||effect.layout.kind==='inn';
    const shards=new this.THREE.InstancedMesh(this.shardGeometry,
      wood?this.shardMaterials.wood:this.shardMaterials.stone,effect.layout.shardCount);
    shards.name='StructureFallingRoofAndWalls';shards.castShadow=true;shards.receiveShadow=true;
    shards.frustumCulled=false;shards.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);
    this.scene.add(shards);effect.shards=shards;
    this.paint(effect,now);
  }
  paint(effect,now){
    const {layout,definition,fires,smokes,shards}=effect;
    const base=definition.source?.model?.position.y??this.terrainHeight(layout.centerX,layout.centerZ);
    const {minX,minZ}=definition.bounds;
    const d=this.dummy;
    const falling=effect.collapsedAt==null?0:Math.min(1,Math.max(0,(now-effect.collapsedAt)/2.25));
    const flameAlive=now<effect.burnUntil||effect.collapsedAt!=null&&now-effect.collapsedAt<3;
    fires.visible=smokes.visible=flameAlive;
    if(flameAlive){
      for(let i=0;i<layout.fireCount;i++){
        const fx=(i*.6180339887)%1,fz=(i*.41421356237)%1;
        const x=(minX+layout.width*fx-6)*this.cellSize;
        const z=(minZ+layout.depth*fz-6)*this.cellSize;
        const wave=Math.sin(now*8+i*2.3),rise=(i%4)/4;
        const y=base+layout.height*(.18+rise*.68)*(1-falling*.78);
        const spread=effect.collapsedAt==null?
          Math.min(1,Math.max(0,(now-effect.ignitedAt)*.16-(i/layout.fireCount)*.8+.25)):1;
        d.position.set(x,y+.37+wave*.12,z);
        d.rotation.set(0,i*.7,0);d.scale.set((1+rise)*spread,(.8+.45*(1+wave))*spread,(1+rise)*spread);
        d.updateMatrix();fires.setMatrixAt(i,d.matrix);
        d.position.y=y+.8+((now*.35+i*.19)%1)*1.15;
        d.rotation.y=i*.35+now*.14;
        d.scale.set((1.1+rise)*spread,(1.3+((now*.35+i*.19)%1))*spread,(1.1+rise)*spread);
        d.updateMatrix();smokes.setMatrixAt(i,d.matrix);
      }
      fires.instanceMatrix.needsUpdate=true;smokes.instanceMatrix.needsUpdate=true;
    }
    if(shards){
      const s=this.cellSize;
      for(let i=0;i<layout.shardCount;i++){
        const ring=i%4,fx=(i*.754877666)%1,fz=(i*.56984029)%1;
        const x=(minX+layout.width*(ring===0?0:ring===1?1:fx)-6)*s;
        const z=(minZ+layout.depth*(ring===2?0:ring===3?1:fz)-6)*s;
        const ground=this.terrainHeight(x,z);
        const initialY=base+layout.height*(.25+(i%5)*.17);
        d.position.set(x+(fx-.5)*falling*1.8,Math.max(ground+.13,initialY-
          (initialY-ground-.13)*falling*falling),z+(fz-.5)*falling*1.8);
        d.rotation.set(falling*(i%2?1:-1)*1.5,fz*2,falling*(i%3?1:-1)*1.3);
        d.scale.set((.6+(i%3)*.38)*s,(.42+(i%4)*.18)*s,(.6+(i%5)*.27)*s);
        d.updateMatrix();shards.setMatrixAt(i,d.matrix);
      }
      shards.instanceMatrix.needsUpdate=true;
    }
  }
  update(now,cameraPosition=null){
    for(const [id,effect] of this.active){
      const {layout}=effect;
      const far=cameraPosition&&Math.hypot(cameraPosition.x-layout.centerX,
        cameraPosition.z-layout.centerZ)>210+Math.max(layout.width,layout.depth)*this.cellSize;
      if(far){effect.fires.visible=effect.smokes.visible=false;
        if(effect.shards)effect.shards.visible=false;}
      else {if(effect.shards)effect.shards.visible=true;this.paint(effect,now);}
      if(effect.shards&&now-effect.collapsedAt>=2.25){
        this.scene.remove(effect.shards);effect.shards=null;
        effect.onSettled?.();effect.onSettled=null;
      }
      if(now>=effect.burnUntil&&(effect.collapsedAt==null||now-effect.collapsedAt>=3)){
        this.scene.remove(effect.fires,effect.smokes);this.active.delete(id);
      }
    }
  }
}
