/** Visible battle-order feedback; percentages reflect the actual simulation modifiers. */
export function describeSquadOrder(mode,{massBattle=false}={}){
 switch(mode){
  case 'charge':return {name:'突撃',effect:'移動速度 +'+(massBattle?30:25)+'%（前進時）'};
  case 'defend':return {name:'守備',effect:'物理被ダメージ -9〜24%／属性被ダメージ -12〜32%（6秒で最大）。HP自動回復は最大HPの80%まで。移動速度 -35%'};
  case 'hold':return {name:'待機',effect:'現在位置を維持。追加の数値バフなし'};
  case 'retreat':return {name:'退却',effect:'自陣へ後退。追加の数値バフなし'};
  case 'move':return {name:'行き先指定',effect:'指定地点への移動。追加の数値バフなし'};
  default:return {name:'号令更新',effect:'専用の数値バフなし'};
 }
}
export function describeCommanderBuff(order){
 if(!order)return '効果なし';
 const effects=[];
 const attack=Number(order.attack)||0,defense=Number(order.defense)||0;
 if(attack)effects.push('攻撃力 '+(attack>0?'+':'')+Math.round(attack*100)+'%');
 if(defense)effects.push('被ダメージ '+(defense>0?'-':'+')+Math.round(Math.abs(defense)*100)+'%');
 if(order.duration>0)effects.push('持続 '+Math.ceil(order.duration)+'秒');
 return effects.join('／')||'追加の数値バフなし';
}
