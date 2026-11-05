// A small, serializable formation plan shared by the main thread and Worker.
// The four squad types determine both jobs and marching depth, without
// changing individual soldiers into proxy meshes or adding per-soldier paths.
export const SQUAD_TYPES=Object.freeze(['attack','balanced','ranged','support']);
export const SQUAD_TYPE_NAMES=Object.freeze({
  attack:'攻撃',balanced:'バランス',ranged:'遠距離',support:'支援'
});

const JOB_POOLS=Object.freeze({
  attack:[0,1,2,3,4,9],
  balanced:[0,1,2,3,4,5,6,7,8,9],
  ranged:[5,6,8,7,5,9],
  support:[7,7,8,6,5,1]
});
const JOB_FRONT_RANK=Object.freeze({
  shield:0,sword:1,lancer:1,fighter:1,thief:2,ninja:2,
  archer:3,mage:3,summoner:3,priest:4
});
const TYPE_DEPTH=Object.freeze({attack:0,balanced:19,ranged:37,support:55});
const TYPE_SPEED=Object.freeze({attack:1.09,balanced:1,ranged:.91,support:.81});

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
    const bridgeIndex=squadId%bridgeCount;
    const start=squadId*squadSize,count=Math.min(squadSize,sideCount-start);
    const pool=JOB_POOLS[type];
    const members=Array.from({length:count},(_,localIndex)=>({
      localIndex,jobIndex:pool[(localIndex*7+team*3)%pool.length]
    }));
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
    const repeatPeriod=4*bridgeCount/gcd(4,bridgeCount);
    const repeat=Math.floor(squadId/repeatPeriod);
    plans.push({
      id:squadId,type,bridgeIndex,slots,count,columns,rows,
      advanceDepth:16+squadRearDistance(type),
      lateralShift:repeat===0?0:(repeat%2?1:-1)*Math.ceil(repeat/2)*27
    });
  }
  return plans;
}
