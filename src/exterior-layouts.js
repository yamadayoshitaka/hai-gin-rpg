/** Data-only exterior: building -> facade layout -> typed objects. */
export function exteriorLayout(building){
 const {grid,kind}=building;
 const [,,w,d,h]=grid;
 const castle=kind==='manor',temple=kind==='church',shop=['weapons','armor','items','merchant','artisan'].includes(kind);
 const stone=castle||temple;
 const roofRise=Math.max(1.5,w*(building.exterior?.roofRiseRatio??(castle?.43:temple?.35:shop?.28:.23)));
 const components=[
  {id:'foundation',type:'box',size:[w+.5,.4,d+.5],position:[0,.2,0],material:'foundation'},
  {id:'body',type:'box',size:[w,h,d],position:[0,h/2,0],material:stone?'stone':'plaster'},
  {id:'front-door',type:'door',size:[1.75,2.5,.32],position:[0,1.3,d/2+.23],material:'door',roles:['openable'],interactionKey:'enter'},
  {id:'roof-left',type:'roof-slope',side:-1,roofRise,material:castle?'royal-roof':temple?'temple-roof':'roof'},
  {id:'roof-right',type:'roof-slope',side:1,roofRise,material:castle?'royal-roof':temple?'temple-roof':'roof'}
 ];
 for(const level of [0,1])for(const side of [-1,1]){
  components.push({id:'window-'+level+'-'+side,type:'window',position:[side*w*.28,2+level*Math.min(2,h*.34),d/2+.23],size:[1.13,1.45,.12],material:'window'});
 }
 if(shop)components.push({id:'shop-sign',type:'sign',position:[w*.29,3.2,d/2+.48],size:[2.2,.65,.22],material:'sign'});
 if(castle){
  for(const side of [-1,1])components.push({id:'tower-'+side,type:'tower',position:[side*(w/2-1),0,-d*.28],size:[2.6,h+3,2.6],material:'stone'});
  components.push({id:'royal-banner',type:'banner',position:[0,4.1,d/2+.45],size:[1.5,2,.1],material:'banner'});
 }
 if(temple)components.push({id:'spire',type:'spire',position:[0,h+roofRise,0],size:[1.2,2.6,1.2],material:'gold'});
 return {id:building.id,kind,grid:[...grid],size:[w,d,h],roofRise,objects:components};
}
