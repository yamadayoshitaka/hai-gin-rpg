import {PlayerCharacter,NPCCharacter,Building,Room,Door,Staircase,AnimationController,AIController} from './rpg-domain.js';
// Strangler adapter: keeps the old Three.js runtime operational while moving state ownership to classes.
export class LegacyRpgAdapter {
 constructor(world){this.world=world;this.characterControllers=new Map();this.buildingsIndexed=false;}
 linkPlayer(mesh){const player=this.world.actors.get('player');player.model=mesh;this.characterControllers.set('player',new AnimationController(player));return player;}
 indexBuildings(rooms){
  for(let i=0;i<rooms.length;i++){
   const old=rooms[i];if(!old)continue;
   let building=this.world.getBuilding(i);
   if(!building){building=new Building({id:i,kind:old.kind});this.world.addBuilding(building);}
   if(!building.getRoom(i))building.addRoom(new Room({id:i,kind:old.kind,width:old.w,depth:old.d}));
  }
  this.buildingsIndexed=true;
 }
 linkNPC(id,mesh,role='civilian'){
  const key='npc:'+id;let actor=this.world.actors.get(key);
  if(!actor){actor=new NPCCharacter({id:key,model:mesh,role});this.world.addActor(actor);this.characterControllers.set(key,new AIController(actor));}
  actor.model=mesh;return actor;
 }
 syncPlayer({moving,heading,level,exp,gold,job,hp,mp,alignment}={}){
  const actor=this.world.actors.get('player');if(!actor)return;
  actor.setMoving(!!moving);actor.setFacing(heading);
  if(Number.isFinite(level))actor.level=level;
  if(Number.isFinite(exp))actor.exp=exp;
  if(Number.isFinite(gold))actor.gold=gold;
  if(typeof job==='string')actor.job=job;
  if(Number.isFinite(hp))actor.health=hp;
  if(Number.isFinite(mp))actor.mp=mp;
  if(Number.isFinite(alignment))this.world.alignment.value=alignment;
 }
 syncRoom(roomId,floor){
  if(roomId==null||roomId<0){if(this.world.state.scene!=='town')this.world.exitBuilding();return;}
  const building=this.world.getBuilding(roomId);
  if(!building)return;
  if(this.world.state.roomId!==roomId)this.world.enterBuilding(roomId);
  const room=building.getRoom(roomId);if(room&&(floor===1||floor===2))room.setFloor(floor);
 }
 update(dt){this.world.update(dt);}
 get diagnostics(){return {rooms:this.world.buildings.size,actors:this.world.actors.size,scene:this.world.state.scene,activeRoom:this.world.state.roomId,playerMoving:this.world.actors.get('player')?.moving};}
}
