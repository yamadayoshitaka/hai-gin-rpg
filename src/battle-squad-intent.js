/**
 * Compact, authoritative order and objective copy for every formation.
 * Pure data formatting: never compute per-unit combat state while drawing
 * 1000v1000 tactical labels.
 */
export function formatSquadIntent({
 team=0,mode='balanced',strategy=null,mission='',destination=null,targetName='',healingFrom='',
 commanderOrder='',commanderUnavailable=false,defeated=false
}={}){
 if(defeated)return {order:'号令：戦闘不能',purpose:'目的：生存兵なし'};
 if(team!==0)return {order:'号令：自動戦闘',purpose:'目的：味方軍の迎撃・攻撃'};
 const orders={
  balanced:'均衡（自動）',auto:'自動行動',clear:'自動行動',
  charge:'進撃',defend:'防御',hold:'待機',retreat:'後退',
  move:'移動',mission:'任務遂行',heal:'回復支援',support:'支援'
 };
 const goals={
  balanced:'敵の動向に応じて自動交戦',auto:'敵の動向に応じて自動交戦',
  clear:'敵の動向に応じて自動交戦',
  charge:'敵の前線へ突撃',defend:'陣形維持・HP回復・物理/魔法耐性強化',
  hold:'現在位置を守る',retreat:'味方側の安全域へ撤退',
  move:'指定地点へ進軍',mission:'指示された目標を遂行',support:'味方部隊を援護',
  heal:'負傷した味方へ広域回復魔法'
 };
 let order=orders[mode]||orders.balanced;
 let purpose=goals[mode]||goals.balanced;
 if(mode==='move'&&destination&&Number.isFinite(destination.x)&&Number.isFinite(destination.z))
  purpose='座標('+Math.round(destination.x)+','+Math.round(destination.z)+')へ進軍';
 if(mode==='mission'&&mission)purpose=mission+(destination&&Number.isFinite(destination.x)&&Number.isFinite(destination.z)
  ?' ('+Math.round(destination.x)+','+Math.round(destination.z)+')':'');
 if(mode==='heal'&&targetName)purpose=targetName+'を広域治癒';
 if(healingFrom){order=order+'＋回復要請';purpose=healingFrom+'が救護中 / '+purpose;}
 if(commanderOrder)purpose+=' / 軍師号令：'+commanderOrder;
 if(commanderUnavailable)order+='（軍師不在・追加命令不可）';
 const labels={eliminate:'全滅',environment_prepare:'環境整備',
  environment_destroy:'環境破壊',recovery:'回復'};
 return {order:'号令：'+order,purpose:(strategy&&labels[strategy]?'作戦：'+labels[strategy]+'｜':'')+'目的：'+purpose};
}
