/**
 * Pure hit-point severity palette shared by the browser overlay and Node QA.
 * Damage colour reflects HP lost, never the allegiance of the target.
 * A fatal blow is a distinct highlight regardless of the damage amount.
 */
export function damageNumberStyle(damage,remainingHp=null){
 const amount=Math.max(0,Math.round(Number(damage)||0));
 if(remainingHp===0)return {tier:'fatal',color:'#fa83f5',size:19};
 if(amount>=100)return {tier:'devastating',color:'#ff5268',size:19};
 if(amount>=60)return {tier:'heavy',color:'#ff9346',size:18};
 if(amount>=25)return {tier:'medium',color:'#ffe16d',size:17};
 return {tier:'light',color:'#f5f8ff',size:16};
}
