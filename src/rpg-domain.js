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
export class PlayerCharacter extends Character {constructor(options={}){super(options);this.job='swordsman';this.level=1;this.exp=0;this.inventory=new Inventory();this.equipment=new Equipment();this.gold=300;this.mp=100;this.maxMp=100;this.maxHealth=100;}}
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
 constructor(){this.state=new GameState();this.buildings=new Map();this.actors=new Map();this.camera=new CameraController();this.combat=new CombatSystem();this.jobs=new JobSystem();this.quests=new QuestSystem();this.alignment=new AlignmentSystem();this.dialogue=new DialogueSystem();this.time=new DayNightCycle();this.interactions=new InteractionSystem();this.collision=new CollisionSystem();this.experience=new ExperienceSystem();}
 addBuilding(building){this.buildings.set(building.id,building);return building;}
 addActor(actor){this.actors.set(actor.id,actor);return actor;}
 getBuilding(id){return this.buildings.get(id)||null;}
 enterBuilding(id){if(!this.buildings.has(id))throw Error('Unknown building '+id);this.state.enter(id);}
 exitBuilding(){this.state.leave();}
 update(dt){this.state.advance(dt);this.time.update(dt);for(const actor of this.actors.values())actor.update(dt);}
}

// --- RPG systems: pure data and rules, independent from Three.js ---
export class Inventory {
 constructor(){this.items=new Map();}
 add(id,amount=1){if(!id||!Number.isInteger(amount)||amount<=0)throw Error('Invalid item');this.items.set(id,(this.items.get(id)||0)+amount);return this.count(id);}
 count(id){return this.items.get(id)||0;}
 consume(id,amount=1){if(!Number.isInteger(amount)||amount<=0||this.count(id)<amount)return false;const next=this.count(id)-amount;if(next)this.items.set(id,next);else this.items.delete(id);return true;}
 list(){return [...this.items].map(([id,count])=>({id,count}));}
}
export class Equipment {
 constructor(){this.weapon=null;this.armor=null;this.accessories=[];}
 equip(slot,id){if(!['weapon','armor'].includes(slot))throw Error('Invalid equipment slot');this[slot]=id;}
}
export class Skill {
 constructor({id,name,job='all',level=1,cost=0,type='physical',power=0}={}){Object.assign(this,{id,name,job,level,cost,type,power});}
 usable(actor){return actor.level>=this.level&&(actor.mp||0)>=this.cost;}
}
export class Job {
 constructor({id,name,skills=[]}={}){this.id=id;this.name=name||id;this.skills=skills.map(x=>x instanceof Skill?x:new Skill(x));}
 unlocked(level){return this.skills.filter(s=>level>=s.level);}
}
export class JobSystem {
 constructor(){this.jobs=new Map();}
 register(job){this.jobs.set(job.id,job);return job;}
 skills(jobId,level){return this.jobs.get(jobId)?.unlocked(level)||[];}
}
export class ExperienceSystem {
 constructor({base=50,growth=1.35}={}){this.base=base;this.growth=growth;}
 required(level){return Math.ceil(this.base*Math.pow(level,this.growth));}
 grant(actor,amount){actor.exp=(actor.exp||0)+Math.max(0,amount);let gained=0;while(actor.exp>=this.required(actor.level)){actor.exp-=this.required(actor.level);actor.level++;gained++;}return gained;}
}
export class AlignmentSystem {
 constructor(){this.value=0;this.civilianKills=0;}
 apply(action){const values={help:4,save:8,steal:-3,attackCivilian:-8,killCivilian:-25};this.value=Math.max(-100,Math.min(100,this.value+(values[action]||0)));if(action==='killCivilian')this.civilianKills++;return this.path;}
 get path(){return this.value<=-30?'shadow':this.value>=30?'light':'neutral';}
 get ending(){return this.path==='shadow'?'joinDarkLord':'defeatDarkLord';}
}
export class Quest {
 constructor({id,title,objectives=[]}={}){this.id=id;this.title=title;this.objectives=objectives;this.progress=new Set();this.completed=false;}
 fulfill(objective){if(this.objectives.includes(objective))this.progress.add(objective);this.completed=this.objectives.every(x=>this.progress.has(x));return this.completed;}
}
export class QuestSystem {
 constructor(){this.quests=new Map();}
 add(quest){this.quests.set(quest.id,quest);return quest;}
 active(){return [...this.quests.values()].filter(q=>!q.completed);}
}
export class Shop {
 constructor({kind='items',stock=[]}={}){this.kind=kind;this.stock=new Map(stock.map(i=>[i.id,i]));}
 buy(actor,id,quantity=1){const item=this.stock.get(id);if(!item||quantity<1||!Number.isInteger(quantity))return false;const total=item.price*quantity;if(actor.gold<total)return false;actor.gold-=total;actor.inventory.add(id,quantity);return true;}
}
export class Inn {
 constructor(price=15){this.price=price;}
 rest(actor){if(actor.gold<this.price)return false;actor.gold-=this.price;actor.health=actor.maxHealth||100;actor.mp=actor.maxMp||100;return true;}
}
export class DialogueSystem {
 constructor(){this.history=new Map();}
 record(actorId,message){if(!this.history.has(actorId))this.history.set(actorId,[]);const h=this.history.get(actorId);h.push(message);if(h.length>40)h.shift();}
 messages(actorId){return [...(this.history.get(actorId)||[])];}
}
export class DayNightCycle {
 constructor({minutesPerDay=12,startingHour=5}={}){this.minutesPerDay=minutesPerDay;this.hour=startingHour;}
 update(deltaSeconds){this.hour=(this.hour+deltaSeconds*24/(this.minutesPerDay*60))%24;}
 get phase(){return this.hour<5?'night':this.hour<7?'dawn':this.hour<17?'day':this.hour<19?'dusk':'night';}
}
export class InteractionSystem {
 constructor(){this.handlers=new Map();}
 register(kind,handler){this.handlers.set(kind,handler);}
 interact(kind,context){return this.handlers.get(kind)?.(context)??false;}
}
export class CollisionSystem {
 constructor(){this.blockers=[];}
 add(rect){this.blockers.push(rect);}
 clear(){this.blockers.length=0;}
 free(x,z,r=.5){return !this.blockers.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
}
export class SaveSystem {
 static serialize(world){return JSON.stringify({state:{...world.state},actors:[...world.actors.values()].map(a=>({id:a.id,health:a.health,level:a.level,exp:a.exp})),alignment:world.alignment.value,quests:[...world.quests.quests.keys()]});}
}
export class AnimationController {
 constructor(actor){this.actor=actor;this.state='idle';this.elapsed=0;}
 setState(state){if(!['idle','walk','run','attack','hit','guard','dead'].includes(state))throw Error('Invalid animation');this.state=state;this.actor.setMoving(state==='walk'||state==='run');}
 update(dt){this.elapsed+=dt;}
}
export class AIController {
 constructor(actor){this.actor=actor;this.mode='wander';this.heading=0;}
 setMode(mode){this.mode=mode;}
 update(dt,environment){if(this.mode==='idle')this.actor.setMoving(false);else if(this.mode==='wander'&&environment?.canMove)this.actor.setMoving(true);}
}
export class SceneController {
 constructor(world){this.world=world;}
 enter(buildingId){this.world.enterBuilding(buildingId);}
 leave(){this.world.exitBuilding();}
}
export class RendererBridge {
 constructor({scene,player,rooms}={}){this.scene=scene;this.player=player;this.rooms=rooms;this.adapters=new Map();}
 register(id,adapter){this.adapters.set(id,adapter);}
 update(dt){for(const adapter of this.adapters.values())adapter.update?.(dt);}
}
