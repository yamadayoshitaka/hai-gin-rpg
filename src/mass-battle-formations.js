// A small, serializable formation plan shared by the main thread and Worker.
// Each squad holds one fixed profession; the three role types only determine
// marching depth and strategic posture, without proxy meshes or new paths.
export const SQUAD_TYPES=Object.freeze(['attack','balanced','support']);
export const SQUAD_TYPE_NAMES=Object.freeze({
  attack:'攻撃',balanced:'バランス',support:'支援'
});

// Index maps to the authentic JOBS registry: sword, shield, fighter,
// ninja, thief, archer, mage, priest, summoner, lancer.
// Ten squads cover all professions once; smaller battles use a prefix.
const JOB_BY_SQUAD=Object.freeze([0,1,7,2,5,6,3,4,8,9]);
const JOB_FRONT_RANK=Object.freeze({
  shield:0,sword:1,lancer:1,fighter:1,thief:2,ninja:2,
  archer:3,mage:3,summoner:3,priest:4
});
const TYPE_DEPTH=Object.freeze({attack:0,balanced:25,support:55});
const TYPE_SPEED=Object.freeze({attack:1.09,balanced:1,support:.81});

export const squadTypeOf=id=>SQUAD_TYPES[Math.abs(Number(id)||0)%SQUAD_TYPES.length];
export const squadSpeedFactor=type=>TYPE_SPEED[type]??1;
export const squadRearDistance=type=>TYPE_DEPTH[type]??0;

const gcd=(a,b)=>b?gcd(b,a%b):a;

export function createSquadFormationPlan(sideCount,bridgeCount,team=0){
  const squadSize=Math.max(10,Math.ceil(sideCount/10));
  const squadCount=Math.ceil(sideCount/squadSize);
  const plans=[];
  for(let squadId=0;squadId<squadCount;squadId++){
    const type=squadTypeOf(squadId);
    const bridgeIndex=(squadId+Math.floor(squadId/SQUAD_TYPES.length))%bridgeCount;
    const start=squadId*squadSize,count=Math.min(squadSize,sideCount-start);
    const jobIndex=JOB_BY_SQUAD[(squadId+team*3)%JOB_BY_SQUAD.length];
    const members=Array.from({length:count},(_,localIndex)=>({localIndex,jobIndex}));
    members.sort((a,b)=>{
      const aJob=['sword','shield','fighter','ninja','thief','archer','mage','priest','summoner','lancer'][a.jobIndex];
      const bJob=['sword','shield','fighter','ninja','thief','archer','mage','priest','summoner','lancer'][b.jobIndex];
      return JOB_FRONT_RANK[aJob]-JOB_FRONT_RANK[bJob]||a.localIndex-b.localIndex;
    });
    const columns=Math.max(2,Math.ceil(Math.sqrt(count)));
    const rows=Math.ceil(count/columns);
    const slots=new Array(count);
    for(let rank=0;rank<members.length;rank++){
      const {localIndex,jobIndex}=members[rank],row=Math.floor(rank/columns),col=rank%columns;
      slots[localIndex]={
        jobIndex,
        // Centre-relative offsets. Positive depth is toward the enemy.
        forward:(rows-1)/2-row,
        lateral:col-(columns-1)/2,
        row,col
      };
    }
    // Repeated type/bridge pairs get separate lanes, not overlapping spawns.
    const repeatPeriod=SQUAD_TYPES.length*bridgeCount;
    const repeat=Math.floor(squadId/repeatPeriod);
    plans.push({
      id:squadId,type,bridgeIndex,slots,count,columns,rows,
      advanceDepth:16+squadRearDistance(type),
      lateralShift:repeat===0?0:(repeat%2?1:-1)*Math.ceil(repeat/2)*27
    });
  }
  return plans;
}
