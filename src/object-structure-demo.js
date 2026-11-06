import {CombatActionRuntime} from './combat-action-runtime.js';
import {StructureCollapseVfx} from './structure-collapse-vfx.js';
import {describeCatalogPreviewStructure} from './structure-preview-state.js';

const VISUAL_CELL_SIZE=2.2;

/** The catalogue uses the very same structural HP, fire and collapse simulation as the battlefield. */
export class ObjectStructureDemo{
  constructor(THREE,scene,view,{onDamage=()=>{}}={}){
    this.THREE=THREE;this.scene=scene;this.onDamage=onDamage;
    this.vfx=new StructureCollapseVfx(THREE,scene,{cellSize:VISUAL_CELL_SIZE});
    this.panel=document.createElement('section');this.panel.id='structure-preview-controls';
    this.panel.style.cssText='position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:min(96%,560px);z-index:3;background:#142638ec;border:1px solid #6586a4;border-radius:12px;padding:10px;box-shadow:0 8px 30px #0009;color:#f7f5ec;font:13px system-ui;display:none;pointer-events:auto';
    this.panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px"><b id="structure-hp-label">耐久力</b><span id="structure-fire-label">通常</span></div><div style="height:10px;border-radius:9px;background:#283039;overflow:hidden;margin:7px 0 9px"><div id="structure-hp-fill" style="height:100%;width:100%;background:#6dcf8b;transition:width .15s"></div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center"><button type="button" data-action="ignite">🔥 点火</button><button type="button" data-action="blast">💥 C4（58）</button><button type="button" data-action="repair">↻ 修復</button><button type="button" data-action="speed">▶ 4倍速</button></div>';
    this.panel.querySelectorAll('button').forEach(button=>{button.style.cssText='flex:1 1 100px;min-height:38px;padding:8px 5px;font-size:13px';
      button.addEventListener('click',()=>this.act(button.dataset.action));});
    view.appendChild(this.panel);
    this.reset();
  }
  reset(){
    this.vfx.clear();
    if(this.debris){this.scene.remove(this.debris);this.debris.geometry.dispose();this.debris.material.dispose();this.debris=null;}
    if(this.model)this.model.visible=true;
    this.model=null;this.runtime=null;this.object=null;this.definition=null;
    this.collapsing=false;this.collapsed=false;this.speed=1;
    this.panel.style.display='none';
  }
  show(id,entry,model,state='normal'){
    this.reset();
    const def=describeCatalogPreviewStructure(id,entry,model);
    if(!def)return false;
    this.definition=def;this.model=model;
    this.runtime=new CombatActionRuntime();
    this.object=this.runtime.registerStructure(def);
    this.panel.style.display='block';
    if(state==='burn')this.ignite();
    if(state==='break')this.damage(this.object.maxHp,'blast');
    this.paintHud();return true;
  }
  ignite(){
    if(!this.object?.alive)return;
    this.runtime.igniteStructure(this.object.id,{initialDamage:18});
    this.vfx.ignite(this.definition,this.runtime.time,{burnUntil:this.object.burningUntil});
    this.onDamage('burn');this.checkCollapse();this.paintHud();
  }
  damage(amount,element){
    if(!this.object?.alive)return;
    this.runtime.hitStructure(this.object,amount,element);
    this.onDamage('break');this.checkCollapse();this.paintHud();
  }
  act(action){
    if(action==='repair'){
      const id=this.model?.userData?.catalogId;
      if(id)this.onDamage('repair');
      return;
    }
    if(action==='speed')this.speed=this.speed===1?4:1;
    if(action==='ignite')this.ignite();
    if(action==='blast')this.damage(58,'blast');
    this.paintHud();
  }
  checkCollapse(){
    if(!this.object||this.object.alive||this.collapsing)return;
    this.collapsing=true;
    this.model.visible=false;
    this.vfx.collapse(this.definition,this.runtime.time,()=>{
      if(!this.definition)return;
      this.makeDebris();this.collapsed=true;this.paintHud();
    });
  }
  makeDebris(){
    const {width,depth,kind}=this.vfx.active.get(this.definition.id)?.layout??{};
    const count=26,s=VISUAL_CELL_SIZE,bounds=this.definition.bounds;
    const stone=!['house','inn','hut','timber_bridge'].includes(kind);
    this.debris=new this.THREE.InstancedMesh(new this.THREE.BoxGeometry(1,1,1),
      new this.THREE.MeshStandardMaterial({color:stone?0x88847f:0x5e4639,roughness:1}),count);
    const dummy=new this.THREE.Object3D();
    for(let i=0;i<count;i++){
      const px=((i*.6180339887)%1),pz=((i*.754877666)%1);
      dummy.position.set((bounds.minX+(bounds.maxX-bounds.minX)*px-6)*s,.16+i%3*.05,
        (bounds.minZ+(bounds.maxZ-bounds.minZ)*pz-6)*s);
      dummy.rotation.set(.16*i,0,.09*i);
      const fragment=Math.min(2.4,Math.max(.5,Math.sqrt((width??2)*(depth??2))*.04));
      dummy.scale.set(fragment*(.8+i%3*.3),.22+i%4*.08,fragment*(.7+i%5*.18));
      dummy.updateMatrix();this.debris.setMatrixAt(i,dummy.matrix);
    }
    this.debris.castShadow=true;this.debris.receiveShadow=true;this.scene.add(this.debris);
  }
  update(dt,cameraPosition){
    if(!this.runtime)return;
    this.runtime.beginTick(Math.min(.1,Math.max(0,dt))*this.speed,[]);
    this.checkCollapse();
    this.vfx.update(this.runtime.time,cameraPosition);
    this.paintHud();
  }
  paintHud(){
    if(!this.object)return;
    const hp=Math.ceil(this.object.hp),max=this.object.maxHp,percent=Math.round(hp/max*100);
    this.panel.querySelector('#structure-hp-label').textContent=`耐久力 ${hp} / ${max} (${percent}%)`;
    const fire=this.object.alive&&this.object.burningUntil>this.runtime.time;
    this.panel.querySelector('#structure-fire-label').textContent=this.collapsed?'崩落完了':this.collapsing?'崩落中…':fire?'🔥 炎上中（毎秒 '+this.object.fireDamagePerSecond+'）':hp<max?'損傷':'通常';
    const fill=this.panel.querySelector('#structure-hp-fill');
    fill.style.width=percent+'%';fill.style.background=percent>60?'#64cb85':percent>30?'#dfaa53':'#d65447';
    this.panel.querySelector('[data-action="ignite"]').disabled=!this.object.alive;
    this.panel.querySelector('[data-action="blast"]').disabled=!this.object.alive;
    this.panel.querySelector('[data-action="speed"]').textContent=this.speed===1?'▶ 4倍速':'▶ 1倍速';
  }
}
