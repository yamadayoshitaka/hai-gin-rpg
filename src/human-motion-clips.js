/** v86 authored animation-clip data. Normalized frame times, radians; no procedural marching oscillator.
 * Each channel contains [left,right] joint angles where applicable.
 * The clip evaluator is independent of rendering and accepts external clip replacements.
 */
const F=(t,hip,knee,ankle,shoulder,elbow,spine=0,bob=0)=>({t,hip,knee,ankle,shoulder,elbow,spine,bob});
const standing=[
 F(0,[.025,-.025],[.08,.13],[0,0],[.10,.02],[.18,.23],0,0),
 F(.32,[.018,-.04],[.085,.135],[0,0],[.075,.055],[.185,.235],.012,.005),
 F(.68,[-.018,-.01],[.075,.14],[0,0],[.06,.08],[.18,.24],-.012,.003),
 F(1,[.025,-.025],[.08,.13],[0,0],[.10,.02],[.18,.23],0,0)
];
const walk=[
 F(0,[.40,-.35],[.10,.40],[-.11,.11],[-.20,.25],[.22,.32],.035,.006),
 F(.13,[.19,-.28],[.17,.61],[-.20,-.02],[-.08,.20],[.23,.40],.045,.021),
 F(.25,[-.05,-.14],[.25,.46],[-.08,-.16],[.045,.105],[.24,.32],0,.032),
 F(.38,[-.25,.18],[.40,.18],[.10,-.20],[.20,-.10],[.32,.22],-.03,.017),
 F(.50,[-.35,.40],[.40,.10],[.11,-.11],[.25,-.20],[.32,.22],-.035,.006),
 F(.63,[-.28,.19],[.61,.17],[-.02,-.20],[.20,-.08],[.40,.23],-.045,.021),
 F(.75,[-.14,-.05],[.46,.25],[-.16,-.08],[.105,.045],[.32,.24],0,.032),
 F(.88,[.18,-.25],[.18,.40],[-.20,.10],[-.10,.20],[.22,.32],.03,.017),
 F(1,[.40,-.35],[.10,.40],[-.11,.11],[-.20,.25],[.22,.32],.035,.006)
];
const run=walk.map((f,i)=>({...f,hip:f.hip.map(v=>v*1.46),knee:f.knee.map(v=>v*1.5),shoulder:f.shoulder.map(v=>v*1.5),elbow:f.elbow.map(v=>v+.18),bob:f.bob*1.7,spine:f.spine*.7}));
const guard=[
 F(0,[.09,-.10],[.22,.24],[0,0],[-.82,-1.01],[-.60,-.68],.02,0),
 F(.5,[.10,-.10],[.26,.23],[0,0],[-.87,-1.04],[-.61,-.70],-.01,.009),
 F(1,[.09,-.10],[.22,.24],[0,0],[-.82,-1.01],[-.60,-.68],.02,0)
];
const hit=[
 F(0,[0,0],[.1,.1],[0,0],[0,0],[.18,.18],0,0),
 F(.22,[-.20,-.25],[.42,.45],[0,0],[.56,.60],[.37,.37],.14,.11),
 F(.50,[-.12,-.18],[.28,.29],[0,0],[.24,.27],[.29,.28],-.1,.05),
 F(1,[0,0],[.1,.1],[0,0],[.08,.08],[.18,.18],0,0)
];
const dead=[
 F(0,[0,0],[.1,.1],[0,0],[.12,.12],[.2,.2],0,0),
 F(.5,[-.36,-.4],[.82,.7],[0,0],[.65,.55],[.35,.35],.24,.08),
 F(1,[-.22,-.22],[1.1,.92],[0,0],[.9,.8],[.48,.45],0,0)
];
const attackShape={
 slash:[[-.25,-1.20],[-.12,-1.65],[.8,.45],[.12,-.35]],
 stab:[[-.45,-.75],[-.72,-1.20],[-.25,-1.85],[-.30,-.45]],
 bash:[[-1.0,-1.05],[-1.35,-1.4],[-.15,-.45],[-.75,-.70]],
 holy:[[-.75,-1.2],[-1.25,-1.55],[-.15,-.65],[-.8,-.8]],
 combo:[[-.85,-.25],[.85,-1.1],[-1.0,.6],[.08,-.2]],
 flurry:[[-.80,-.20],[.65,-.95],[-.8,.7],[.04,-.25]],
 smash:[[-1.0,-1.05],[-1.7,-1.65],[.3,.15],[-.25,-.55]],
 sweep:[[-.65,-1.1],[-1.2,-1.3],[.7,.48],[-.20,-.3]],
 shoot:[[-.93,-1.23],[-1.05,-1.45],[-1.03,-1.38],[-.88,-1.12]],
 cast:[[-.20,-.4],[-.9,-1.1],[-1.4,-1.45],[-.15,-.22]],
 bless:[[-.35,-.35],[-.8,-.9],[-1.25,-1.15],[-.3,-.3]],
 chord:[[-.30,-.6],[-.45,-.85],[-.36,-.9],[-.25,-.52]],
 draw:[[-.35,-.65],[-.5,-1.65],[.65,-.4],[-.15,-.22]],
 toss:[[-.15,-.55],[-.25,-1.35],[-.35,-1.75],[-.05,-.3]],
 throw:[[-.16,-.55],[-.55,-1.25],[-.22,-1.65],[-.08,-.35]]
};
function attackFrames(kind){
 const moves=attackShape[kind]||attackShape.slash;
 return [0,.19,.46,.78,1].map((t,i)=>{
  const shoulders=moves[Math.min(i,moves.length-1)];
  const impact=i===2||i===3;
  return F(t,impact?[-.21,.32]:[.13,-.10],impact?[.27,.38]:[.15,.17],[0,0],shoulders,impact?[-.75,-.82]:[-.29,-.35],impact?.18:-.12,impact?.035:0);
 });
}
export const HUMAN_CLIP_BOM=Object.freeze({idle:standing,walk,run,guard,hit,dead});
const period={idle:3.2,walk:.88,run:.63,attack:.9,guard:2,hit:.58,dead:1.15};
const loop=new Set(['idle','walk','run','guard']);
const lerp=(a,b,t)=>a+(b-a)*t;
function blendFrames(a,b,t){
 const pose={};
 for(const field of ['hip','knee','ankle','shoulder','elbow'])
  pose[field]=a[field].map((v,i)=>lerp(v,b[field][i],t));
 for(const field of ['spine','bob'])pose[field]=lerp(a[field],b[field],t);
 return pose;
}
export function sampleHumanClip(action,time,identity={}){
 const frames=action==='attack'?attackFrames(identity.attack):HUMAN_CLIP_BOM[action]||standing;
 const duration=period[action]??1;
 const normalized=loop.has(action)?((time*(identity.tempo??1)/duration)%1+1)%1:Math.min(1,Math.max(0,time/duration));
 for(let i=1;i<frames.length;i++)if(normalized<=frames[i].t){
  const left=frames[i-1],right=frames[i],t=(normalized-left.t)/(right.t-left.t);
  const v=blendFrames(left,right,t*t*(3-2*t));
  const tempo=action==='walk'||action==='run'?(identity.hipSwing??.38)/.38:1;
  return {hips:v.hip.map(x=>x*tempo),knees:v.knee,ankles:v.ankle,
   shoulders:v.shoulder.map(x=>x*(action==='walk'||action==='run'?(identity.shoulderSwing??.3)/.3:1)),
   elbows:v.elbow,wrists:action==='attack'?[(-.24*Math.sin(Math.min(1,normalized)*Math.PI)),(-.36*Math.sin(Math.min(1,normalized)*Math.PI))]:action==='guard'?[-.20,-.20]:[-.04,-.04],spineY:v.spine,spineZ:v.spine*.35,headX:0,bob:v.bob};
 }
 throw Error('Invalid animation clip '+action);
}
export function validateHumanClips(){
 for(const action of Object.keys(period)){
  const frames=action==='attack'?attackFrames('slash'):HUMAN_CLIP_BOM[action];
  if(!frames||frames[0].t!==0||frames.at(-1).t!==1)throw Error('Invalid clip duration '+action);
  for(const frame of frames)if(![frame.t,...frame.hip,...frame.knee,...frame.ankle,...frame.shoulder,...frame.elbow,frame.spine,frame.bob].every(Number.isFinite))throw Error('Invalid clip values '+action);
 }
 return true;
}
