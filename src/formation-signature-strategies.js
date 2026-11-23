/**
 * Inn formation signature doctrines. The exact same two waypoints and final
 * orders drive the animated inn demonstration and the live battle runner.
 * Distances are relative to the team's center: [forward, left/right].
 * One signature belongs to one formation; it never changes the roster.
 */
const strategy=(name,summary,steps,first,second,final)=>{
 const check=phase=>phase.length===3&&phase.every(v=>v.length===2&&v.every(Number.isFinite));
 if(!check(first)||!check(second)||final.length!==3)throw Error('Invalid signature strategy '+name);
 return Object.freeze({name,summary,steps:Object.freeze(steps),
  phases:Object.freeze([first,second].map(phase=>Object.freeze(phase.map(p=>Object.freeze([...p]))))),
  final:Object.freeze([...final])});
};
export const FORMATION_SIGNATURE_STRATEGIES=Object.freeze({
 attack:strategy('先鋒強襲','前衛が間合いを詰め、後列が射線を確保して一斉に追撃する。',
  ['前衛が先行','後列が攻撃距離へ','一斉攻撃'],[[6,-4],[3,1],[4,6]],[[14,-3],[10,0],[11,5]],['charge','charge','charge']),
 balanced:strategy('三層連動','前衛が前進、中央が援護し、後衛は距離を保って追従する。',
  ['三層で前進','中央が援護','前衛攻撃・後衛維持'],[[5,-5],[3,0],[2,6]],[[12,-5],[9,0],[6,6]],['charge','defend','defend']),
 support:strategy('護衛救護','盾役が守護線を作り、僧侶・召喚士が後ろから救護する。',
  ['護衛が展開','支援職が安全圏へ','守備しながら回復'],[[1,0],[4,-6],[4,6]],[[2,0],[7,-7],[7,7]],['defend','defend','defend']),
 wall:strategy('盾壁迎撃','盾役を横に並べ、敵の突進を止めて後衛を保護する。',
  ['前面に盾を展開','隙間を塞ぐ','前線を固守'],[[5,-8],[5,0],[5,8]],[[8,-8],[8,0],[8,8]],['defend','defend','defend']),
 spear:strategy('槍衾反撃','槍役の直線を揃え、敵の接近を迎え撃ってから反撃する。',
  ['槍役の間隔を揃える','横隊で迎撃','先鋒が反撃'],[[4,-7],[5,0],[4,7]],[[9,-6],[10,0],[9,6]],['defend','charge','defend']),
 arrow:strategy('弓月射界','射撃兵を両翼に広げ、互いの射線を塞がず敵を集中攻撃する。',
  ['遠距離部隊が開く','弧を描いて展開','両翼射撃'],[[3,-10],[5,0],[3,10]],[[10,-13],[8,0],[10,13]],['defend','charge','defend']),
 highground:strategy('高所射撃展開','盾役が入口を守り、射撃2隊が通行可能な階段を登って窓・屋根の射線を取る。高所が無ければ地上で攻撃する。',
  ['盾役が接近を阻止','射撃隊が階段に接近','高所から集中射撃'],[[2,-2],[3,-6],[3,6]],[[5,-2],[7,-6],[7,6]],['defend','charge','charge']),
 wedge:strategy('楔尖突破','先鋒を鋭く前に出し、後続が左右から追って中央を突破する。',
  ['先頭が突出','後衛が楔形へ','中央突破'],[[9,0],[3,-6],[3,6]],[[16,0],[11,-6],[11,6]],['charge','charge','charge']),
 pincer:strategy('双翼包囲','左右の遊撃部隊が大きく回り込み、中央部隊が敵を引きつける。',
  ['左右に分散','敵の側面へ回り込む','左右から挟撃'],[[4,-12],[4,0],[4,12]],[[15,-12],[9,0],[15,12]],['charge','defend','charge']),
 circle:strategy('円環守護','周囲に輪を作り、中央の回復・遠距離担当を守り抜く。',
  ['守備の輪を広げる','中心の支援を守る','全周警戒'],[[1,-8],[0,0],[1,8]],[[5,-9],[2,0],[5,9]],['defend','defend','defend']),
 ambush:strategy('影潜り奇襲','遊撃部隊が左右に潜み、相手の後方・側面に飛び込む。',
  ['左右へ隠密移動','側面へ回り込む','一斉奇襲'],[[3,-12],[2,0],[3,12]],[[15,-13],[9,0],[15,13]],['charge','charge','charge']),
 cross:strategy('十字相互援護','中央を守りながら攻撃役が十字方向へ広がり、死角を補う。',
  ['中心から展開','左右前方を援護','交差射線で迎撃'],[[4,-7],[2,0],[4,7]],[[11,-9],[7,0],[11,9]],['charge','defend','charge']),
 fortress:strategy('鉄壁反攻','多重防壁の後ろに支援隊を置き、敵の攻撃後に前列が反撃する。',
  ['盾列を二重にする','支援隊を後方へ','耐えて反撃'],[[3,-6],[3,0],[0,6]],[[7,-6],[6,0],[2,6]],['defend','defend','defend']),
 dragon:strategy('龍牙連撃','先鋒が中央を砕き、両翼が敵の退路を遮断する。',
  ['中央で圧力をかける','両翼が急加速','連続突撃'],[[8,0],[5,-9],[5,9]],[[16,0],[15,-10],[15,10]],['charge','charge','charge']),
 constellation:strategy('星鐘連環','前衛・僧侶・遠距離の隊が連動し、包囲と救護を交互に行う。',
  ['三隊で同期','外翼攻撃・中央救護','包囲攻防を継続'],[[6,-8],[3,0],[6,8]],[[14,-9],[7,0],[14,9]],['charge','defend','charge'])
});
export const signatureStrategyFor=id=>FORMATION_SIGNATURE_STRATEGIES[String(id||'')]||null;

/** Target-relative offsets shared with the animated illustration.
 * A physical division keeps its assigned job/formation cell.
 */
export function formationSignatureWaypoints(formation,center,enemy,roleIndex){
 const rule=signatureStrategyFor(formation);
 if(!rule||!Number.isFinite(center?.x)||!Number.isFinite(center?.z))return [];
 const dx=Number(enemy?.x)-center.x,dz=Number(enemy?.z)-center.z;
 const magnitude=Number.isFinite(dx)&&Number.isFinite(dz)?Math.hypot(dx,dz):0;
 const ux=magnitude>.001?dx/magnitude:1,uz=magnitude>.001?dz/magnitude:0;
 const forwardLimit=magnitude>4?Math.max(3,Math.min(16,magnitude-3)):8;
 const forwardFactor=forwardLimit/16;
 const index=Math.max(0,Math.min(2,Number(roleIndex)||0));
 return rule.phases.map(phase=>{
  const [forward,side]=phase[index];
  return {x:Math.round(center.x+ux*forward*forwardFactor-uz*side),
   z:Math.round(center.z+uz*forward*forwardFactor+ux*side)};
 });
}
/** One 320×138 looping schematic, not an unrelated illustration.
 * Uses the same phase arrays that the battle controller uses.
 */
export function renderFormationSignaturePreview(formation,{labels=['前衛','中衛','後衛'],activeSlots=[0,1,2]}={}){
 const rule=signatureStrategyFor(formation);if(!rule)return '';
 const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
 const frame=(v,index)=>[38+v[0]*8.2,69+v[1]*3.6+(index===1?0:0)];
 const start=[[0,-7],[0,0],[0,7]];
 const paths=rule.phases;
 // Restrict the illustrated allies to actually assigned slots. An empty third
 // roster slot must never be animated as a phantom third job.
 const occupied=[...new Set((Array.isArray(activeSlots)?activeSlots:[0,1,2])
  .map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<3))].sort((a,b)=>a-b);
 const squads=occupied.map(i=>{
  const origin=start[i];
  const points=[origin,paths[0][i],paths[1][i]].map(v=>frame(v,i));
  const values=points.map(p=>p.join(' ')).join(';')+';'+points[2].join(' ')+';'+points[0].join(' ');
  const strokes=['#65d6ff','#8df1bd','#ffe29b'];
  return '<g class="signatureTroop" aria-label="'+esc(labels[i]||('第'+(i+1)+'分隊'))+'">'+
   '<circle r="10" fill="'+strokes[i]+'" stroke="#091f32" stroke-width="2"/>'+
   '<text y="3.4" text-anchor="middle" font-size="8" font-weight="bold" fill="#092235">'+(i+1)+'</text>'+
   '<animateTransform attributeName="transform" type="translate" dur="7.5s" repeatCount="indefinite" calcMode="linear"'+
   ' values="'+values+'" keyTimes="0;0.28;0.57;0.82;1"/>'+
   '</g>';
 }).join('');
 const trace=occupied.map(i=>{const p=frame(paths[1][i],i);return '<path d="M'+(38)+' '+(69+start[i][1]*3.6)+' L'+p[0]+' '+p[1]+'" fill="none" stroke="#b2dcea" stroke-width="1.4" stroke-dasharray="4 5" opacity=".6"/>'}).join('');
 return '<div class="signaturePreview" role="img" aria-label="'+esc(rule.name+'：'+rule.steps.join('、'))+'">'+
  '<svg viewBox="0 0 320 138" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+
  '<rect width="320" height="138" rx="10" fill="#102c39"/>'+
  '<rect x="12" y="11" width="190" height="115" rx="8" fill="#14556c" opacity=".20"/>'+
  '<rect x="215" y="11" width="92" height="115" rx="8" fill="#7f2b3a" opacity=".20"/>'+
  '<path d="M210 12 V125" stroke="#f3dbab" stroke-dasharray="4 5" opacity=".55"/>'+
  '<text x="15" y="17" fill="#a7eafd" font-size="9">味方 '+occupied.length+'ジョブ</text>'+
  '<text x="226" y="17" fill="#ffd0d0" font-size="9">敵陣</text>'+
  trace+
  '<g fill="#ee6773" stroke="#ffc4ce" stroke-width="1.3"><circle cx="267" cy="40" r="10"/><circle cx="278" cy="69" r="10"/><circle cx="267" cy="98" r="10"/></g>'+
  squads+'</svg>'+
  '<div class="signaturePhaseCaptions" aria-label="動作の3段階（ジョブ数とは別）"><span>① '+esc(rule.steps[0])+'</span><span>② '+esc(rule.steps[1])+'</span><span>③ '+esc(rule.steps[2])+'</span></div></div>';
}
