/**
 * Map-selectable territory tint for paused central battle orders.
 * Generated once per selection transaction at native radar-grid resolution,
 * with no WebGL meshes, shader recompilation or active-frame redraw.
 */
export function makeSelectableMapOverlay(size,canSelect){
 const n=Math.max(1,Math.floor(size)),pixels=new Uint8ClampedArray(n*n*4);
 let selectable=0;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const valid=Boolean(canSelect(x,z)),i=(z*n+x)*4;
  if(valid){
   pixels[i]=24;pixels[i+1]=240;pixels[i+2]=139;pixels[i+3]=68;selectable++;
  }else{
   pixels[i]=108;pixels[i+1]=17;pixels[i+2]=26;pixels[i+3]=98;
  }
 }
 return {size:n,pixels,selectable,total:n*n};
}
export function isSelectableMapPoint(point,size,canSelect){
 return Boolean(point&&Number.isInteger(point.x)&&Number.isInteger(point.z)&&
  point.x>=0&&point.z>=0&&point.x<size&&point.z<size&&canSelect(point.x,point.z));
}
