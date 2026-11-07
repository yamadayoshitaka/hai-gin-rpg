// Low-cost, deterministic battlefield reports. All statements are derived from
// current simulation units; no guessed threats and no CPU-heavy per-frame AI.
export function createBattleStrategistAdvisor({nameSquad=id=>'第'+(Number(id)+1)+'隊'}={}){
 const previousCommanders=new Map(),lastNotice=new Map(),previousRisk=new Map();
 let lastOverview=-Infinity;
 const cooldown=(key,now,seconds)=>{
  if(now-(lastNotice.get(key)??-Infinity)<seconds)return false;
  lastNotice.set(key,now);return true;
 };
 function inspect(units,time=0){
  if(!Array.isArray(units)||!Number.isFinite(time))return [];
  const groups=new Map(),enemies=[];
  let allyAlive=0,enemyAlive=0,allyTotal=0,enemyTotal=0;
  for(const unit of units){
   const alive=unit.alive!==false&&unit.hp>0;
   if(unit.team===1){enemyTotal++;if(alive){enemyAlive++;enemies.push(unit);}continue;}
   if(unit.team!==0)continue;
   allyTotal++;if(alive)allyAlive++;
   const id=String(unit.squadId??0);
   let squad=groups.get(id);
   if(!squad){
    squad={id,count:0,alive:0,health:0,maxHealth:0,x:0,z:0,strategist:null};
    groups.set(id,squad);
   }
   squad.count++;
   if(unit.isStrategist)squad.strategist=unit;
   if(!alive)continue;
   squad.alive++;squad.health+=Math.max(0,unit.hp||0);
   squad.maxHealth+=Math.max(1,unit.maxHp||1);
   squad.x+=Number(unit.x??unit.cell?.x??0);
   squad.z+=Number(unit.z??unit.cell?.z??0);
  }
  const events=[];
  for(const squad of groups.values()){
   const id=squad.id,leader=squad.strategist;
   // The lost leader cannot narrate their own death. A surviving messenger
   // takes over and names the actual unit instead.
   if(leader){
    const alive=leader.alive!==false&&leader.hp>0;
    const prev=previousCommanders.get(id);
    if(prev===true&&!alive)events.push({key:'leader:'+id,kind:'critical',speaker:'伝令',
      squadId:id,priority:100,unitId:leader.id,
      text:nameSquad(id)+'の軍師が戦闘不能！ この隊は新たな命令を受けられません！'});
    previousCommanders.set(id,alive);
   }
   if(!squad.alive)continue;
   const rate=squad.alive/Math.max(1,squad.count);
   const hp=squad.health/Math.max(1,squad.maxHealth);
   const risk=rate<=.25||hp<=.2?2:rate<=.55||hp<=.45?1:0;
   const prevRisk=previousRisk.get(id)??0;
   previousRisk.set(id,risk);
   if(risk===2&&(prevRisk<2||cooldown('critical:'+id,time,26))){
    events.push({key:'critical:'+id,kind:'critical',speaker:'軍師',squadId:id,priority:80,
      text:nameSquad(id)+'が壊滅寸前です！ 残存'+squad.alive+'/'+squad.count+'名。援軍か撤退を進言します！'});
   }else if(risk===1&&(prevRisk<1||cooldown('warning:'+id,time,36))){
    events.push({key:'warning:'+id,kind:'warning',speaker:'軍師',squadId:id,priority:55,
      text:nameSquad(id)+'が劣勢です。残存'+squad.alive+'/'+squad.count+'名、平均HP '+Math.round(hp*100)+'％。'});
   }else if(risk===0&&prevRisk>0&&cooldown('recovered:'+id,time,22)){
    events.push({key:'recovered:'+id,kind:'success',speaker:'伝令',squadId:id,priority:40,
      text:nameSquad(id)+'の態勢が持ち直しました。'});
   }
   if(rate>=.5&&squad.alive>0){
    const cx=squad.x/squad.alive,cz=squad.z/squad.alive;
    let nearest=Infinity;
    for(const enemy of enemies){
      const dx=(enemy.x??enemy.cell?.x??0)-cx,dz=(enemy.z??enemy.cell?.z??0)-cz;
      const d=dx*dx+dz*dz;if(d<nearest)nearest=d;
    }
    if(nearest<=36&&cooldown('close:'+id,time,38)){
      events.push({key:'close:'+id,kind:'info',speaker:'斥候',squadId:id,priority:30,
        text:nameSquad(id)+'の近くに敵影！ 距離約'+Math.max(1,Math.round(Math.sqrt(nearest)))+'マスです。'});
    }
   }
  }
  // Return a periodic global report even if nothing extraordinary happens.
  if(time-lastOverview>=24||lastOverview===-Infinity){
   lastOverview=time;
   if(!events.length)events.push({key:'overview',kind:'info',speaker:'軍師',priority:15,
     text:'戦況報告。味方'+allyAlive+'/'+allyTotal+'名、敵'+enemyAlive+'/'+enemyTotal+
       '名が健在。全部隊の動向を監視しています。'});
  }
  // A dead strategist always precedes generic threat chatter. Display at
  // most three messages per 1.5s sample and leave the rest to the next sample.
  return events.sort((a,b)=>b.priority-a.priority).slice(0,3);
 }
 return {inspect};
}
