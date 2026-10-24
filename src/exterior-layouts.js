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
  // Castle silhouette: stone parapets, twin guard towers, front gate and royal facade.
  for(let side of [-1,1]){
   components.push({id:'gate-pillar-'+side,type:'box',size:[1.3,h*.86,1.4],position:[side*2.55,h*.43,d/2+.38],material:'stone'});
   for(let k=0;k<5;k++)components.push({id:'battlement-'+side+'-'+k,type:'box',size:[.8,.75,.9],position:[side*(2.4+k*1.35),h+.35,d/2-.1],material:'stone'});
  }
  components.push({id:'castle-arch',type:'box',size:[6.5,1.35,.8],position:[0,3.8,d/2+.3],material:'stone'});
  components.push({id:'gate-metal',type:'box',size:[2.4,.16,.34],position:[0,2.4,d/2+.45],material:'gold'});
  components.push({id:'royal-window',type:'window',size:[2.7,2.35,.2],position:[0,h*.77,d/2+.34],material:'window'});
  // Landmark-specific silhouette composed entirely from declarative pieces.
  components.push({id:'castle-gateway',type:'gate-arch',position:[0,0,d/2+.8],size:[8.8,8.3,2.1],material:'stone'});
  components.push({id:'castle-inner-gate',type:'gate',position:[0,0,d/2+2],size:[4.8,5.7,.42],material:'door'});
  for(const side of [-1,1]){
   components.push({id:'castle-front-tower-'+side,type:'tower',position:[side*(w*.40),0,d*.48],size:[5.1,h+8,5.1],material:'stone'});
   components.push({id:'castle-tower-banner-'+side,type:'banner',position:[side*(w*.40),h+4,d*.48+2.7],size:[1.25,3.2,.14],material:'banner'});
   components.push({id:'castle-tower-spire-'+side,type:'spire',position:[side*(w*.40),h+11,d*.48],size:[3.25,6,3.25],material:'royal-roof'});
  }
  components.push({id:'castle-keep',type:'tower',position:[0,0,-d*.31],size:[w*.43,h+10,d*.30],material:'stone'});
  components.push({id:'castle-keep-spire',type:'spire',position:[0,h+14,-d*.31],size:[5.8,8,5.8],material:'royal-roof'});
  components.push({id:'royal-banner',type:'banner',position:[0,4.1,d/2+.45],size:[1.5,2,.1],material:'banner'});
 }
 if(temple)components.push({id:'spire',type:'spire',position:[0,h+roofRise,0],size:[1.2,2.6,1.2],material:'gold'});
 return {id:building.id,kind,grid:[...grid],size:[w,d,h],roofRise,objects:components};
}
