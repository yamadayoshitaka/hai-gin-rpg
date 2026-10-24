/** Deterministic seamless masonry/timber textures, created once per theme.
 * Uses repeat on individual original-size wall modules, never stretches geometry.
 */
export function createWallFinishLibrary(THREE){
 const cache=new Map();
 function texture(theme){
  if(cache.has(theme))return cache.get(theme);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');
  let seed=theme==='castle'?1777:theme==='church'?3231:7021;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const castle=theme==='castle',church=theme==='church';
  const base=castle?[151,145,133]:church?[202,195,179]:[191,159,124];
  ctx.fillStyle='rgb('+base.join(',')+')';ctx.fillRect(0,0,512,512);
  const rowH=castle?64:church?80:96,brickW=castle?128:church?160:256;
  for(let row=0;row<512/rowH;row++){
   const offset=(row%2)*brickW/2;
   for(let x=-brickW;x<512+brickW;x+=brickW){
    const variance=Math.floor(rnd()*29)-14;
    const shade=base.map(c=>Math.max(30,Math.min(240,c+variance)));
    ctx.fillStyle='rgb('+shade.join(',')+')';
    ctx.fillRect(x+offset+3,row*rowH+3,brickW-6,rowH-6);
    ctx.fillStyle='rgba(255,255,255,.12)';
    ctx.fillRect(x+offset+5,row*rowH+5,brickW-10,3);
    ctx.fillStyle='rgba(26,23,22,.23)';
    ctx.fillRect(x+offset+4,(row+1)*rowH-9,brickW-8,5);
    for(let k=0;k<120;k++){
     const px=x+offset+5+rnd()*(brickW-10),py=row*rowH+5+rnd()*(rowH-10);
     ctx.fillStyle=rnd()>.52?'rgba(25,25,25,.09)':'rgba(255,255,255,.09)';
     ctx.fillRect(px,py,1+rnd()*3,1+rnd()*3);
    }
   }
  }
  const map=new THREE.CanvasTexture(canvas);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  const bump=map.clone();bump.needsUpdate=true;
  const finish={map,bump,theme};cache.set(theme,finish);return finish;
 }
 return {
  material(theme){
   const base=texture(theme);
   return new THREE.MeshStandardMaterial({map:base.map,bumpMap:base.bump,bumpScale:.055,roughness:.94,metalness:0});
  }
 };
}
