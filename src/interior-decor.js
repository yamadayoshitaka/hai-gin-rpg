/** Declarative furnishing rule: carpets are part of a room's derived object data, not a renderer special case. */
export const DEFAULT_CARPET_RULES=Object.freeze({
 table_low:{size:[6.0,4.9],pattern:'woven'},desk:{size:[5.0,3.6],pattern:'woven'},
 bed_single_A:{size:[5.0,4.0],pattern:'bedside'},throne:{size:[7.8,5.6],pattern:'royal'},
 chair_A_wood:{size:[2.6,2.4],pattern:'woven'},counter:{size:[7.2,3.5],pattern:'runner'},
 pew:{size:[5.8,3.1],pattern:'runner'},piano:{size:[5.7,3.5],pattern:'woven'}
});
const THEME_COLORS=Object.freeze({
 'royal-castle':0x873b51,'hero-family':0x856247,'citizen-house':0x786a58,
 'old-citizen':0x786b57,'forge-shop':0x5d6480,'equipment-shop':0x666e83,
 'supplies-shop':0x6f845f,'luida-style-tavern':0x83524a,
 'royal-library':0x536f78,'blacksmith':0x7c604d,default:0x80634e
});
export function deriveCarpetObjects(layout,{theme='default',stair=null}={}){
 const source=layout?.objects??[], carpets=[];
 const existing=source.filter(o=>o.model==='carpet');
 const occupied=(x,z,w,d)=>existing.some(o=>Math.abs(o.position[0]-x)<w*.5+3.5&&Math.abs(o.position[2]-z)<d*.5+6.5);
 for(const object of source){
  const rule=DEFAULT_CARPET_RULES[object.model];
  if(!rule||object.carpet===false||object.type==='actor')continue;
  const [x,,z]=object.position??[];
  if(!Number.isFinite(x)||!Number.isFinite(z))continue;
  const [w,d]=rule.size;
  // A rug never blocks or hides the central stairs/door approach.
  if(stair&&Math.abs(x-stair.x)<w/2+stair.width/2+1&&Math.abs(z-stair.z)<d/2+stair.run/2+1)continue;
  if(occupied(x,z,w,d))continue;
  carpets.push({id:object.id+':carpet',type:'decoration',model:'carpet',
   position:[x,0,z],size:[w,d],pattern:rule.pattern,color:THEME_COLORS[theme]??THEME_COLORS.default,
   collision:false,generatedFromId:object.id,roles:[]});
 }
 return carpets;
}
export function decorateInteriorLayouts(layouts,options={}){
 return (layouts??[]).map(layout=>({
  ...layout,objects:[...(layout.objects??[]),...deriveCarpetObjects(layout,options)]
 }));
}
