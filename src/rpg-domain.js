// RPG domain model. No THREE dependency: core rules can be unit tested in Node.
export class GameState {
 constructor(){this.scene='town';this.roomId=null;this.mode='explore';this.time=0;}
 enter(roomId){if(!Number.isInteger(roomId)||roomId<0)throw Error('Invalid room');this.roomId=roomId;this.scene='interior';}
 leave(){this.roomId=null;this.scene='town';}
 setMode(mode){if(!['explore','dialog','combat','menu'].includes(mode))throw Error('Invalid mode');this.mode=mode;}
 advance(dt){this.time+=Math.max(0,dt);}
}
export class Character {
 constructor({id,model=null,speed=1.4}={}){this.id=id;this.model=model;this.speed=speed;this.moving=false;this.facing=0;this.health=100;}
 setMoving(value){this.moving=Boolean(value);return this;}
 setFacing(yaw){if(Number.isFinite(yaw))this.facing=yaw;}
 update(dt){this.elapsed=(this.elapsed||0)+Math.max(0,dt);}
}
export class PlayerCharacter extends Character {constructor(options={}){super(options);this.job='swordsman';this.level=1;this.exp=0;this.inventory=[];}}
export class NPCCharacter extends Character {constructor(options={}){super(options);this.role=options.role||'civilian';this.home=options.home||null;this.hostile=false;}}
export class Door {
 constructor({id,open=false,threshold=3.4}={}){this.id=id;this.open=open;this.threshold=threshold;}
 toggle(){this.open=!this.open;return this.open;}
 isNear(distance){return Number.isFinite(distance)&&distance<=this.threshold;}
}
export class Staircase {
 constructor({steps=11,run=5.6,rise=2.3}={}){this.steps=steps;this.run=run;this.rise=rise;}
 get stepRise(){return this.rise/this.steps;}
 get stepDepth(){return this.run/this.steps;}
 heightAt(progress){return this.rise*Math.min(1,Math.max(0,progress));}
}
export class Room {
 constructor({id,kind='home',width=0,depth=0}={}){this.id=id;this.kind=kind;this.width=width;this.depth=depth;this.floor=1;this.doors=[];this.residents=[];this.staircase=new Staircase();}
 setFloor(level){if(level!==1&&level!==2)throw Error('Unsupported floor');this.floor=level;}
 addResident(npc){this.residents.push(npc);return npc;}
}
export class Building {
 constructor({id,kind='home'}={}){this.id=id;this.kind=kind;this.rooms=[];}
 addRoom(room){this.rooms.push(room);return room;}
 getRoom(id){return this.rooms.find(r=>r.id===id)||null;}
}
export class CameraController {
 constructor(){this.yaw=0;this.pitch=0;this.occluded=new Map();this.fadeHoldMs=420;}
 orbit(dx,dy,sensitivity=.004){this.yaw-=dx*sensitivity;this.pitch=Math.max(-.1,Math.min(.65,this.pitch+dy*sensitivity));}
 markOccluded(key,time){this.occluded.set(key,time);}
 shouldRestore(key,time){return time-(this.occluded.get(key)||0)>this.fadeHoldMs;}
}
export class CombatSystem {
 constructor(){this.active=false;this.target=null;}
 engage(target){this.target=target;this.active=true;}
 disengage(){this.target=null;this.active=false;}
 get isActive(){return this.active&&!!this.target&&this.target.health>0;}
}
export class GameWorld {
 constructor(){this.state=new GameState();this.buildings=new Map();this.actors=new Map();this.camera=new CameraController();this.combat=new CombatSystem();}
 addBuilding(building){this.buildings.set(building.id,building);return building;}
 addActor(actor){this.actors.set(actor.id,actor);return actor;}
 getBuilding(id){return this.buildings.get(id)||null;}
 enterBuilding(id){if(!this.buildings.has(id))throw Error('Unknown building '+id);this.state.enter(id);}
 exitBuilding(){this.state.leave();}
 update(dt){this.state.advance(dt);for(const actor of this.actors.values())actor.update(dt);}
}
