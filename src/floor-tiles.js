/** Original-size tiled floors: one shared geometry/material per theme, instanced. */
export const FLOOR_TILE_CATALOG=Object.freeze({
 stone:{size:1,color:0x98918a,joint:0x575b5d},
 wood:{size:1,color:0x856649,joint:0x4b382b},
 royal:{size:1,color:0xb4a99b,joint:0x60534a}
});
export function floorTileLayout(width,depth,theme='wood'){
 const rule=FLOOR_TILE_CATALOG[theme];if(!rule)throw Error('Unknown floor finish '+theme);
 const nx=Math.floor(width/rule.size),nz=Math.floor(depth/rule.size);
 return {theme,tileSize:rule.size,columns:nx,rows:nz,count:nx*nz,
  offsetX:-(nx-1)*rule.size/2,offsetZ:-(nz-1)*rule.size/2};
}
/** Pure BOM placement data for floor units, including stairwell openings. */
export function floorTilePlacements(width,depth,theme='wood',options={}){
 const layout=floorTileLayout(width,depth,theme);
 const holes=options.holes??[],placements=[];
 for(let z=0;z<layout.rows;z++)for(let x=0;x<layout.columns;x++){
  const xx=layout.offsetX+x*layout.tileSize,zz=layout.offsetZ+z*layout.tileSize;
  if(holes.some(h=>Math.abs(xx-h.x)<h.width/2+.42&&Math.abs(zz-h.z)<h.depth/2+.42))continue;
  placements.push({id:'floor:'+x+':'+z,partId:'floor-tile',position:[xx,-.06,zz],size:[layout.tileSize,.12,layout.tileSize]});
 }
 return placements;
}
export function renderFloorTiles(THREE,parent,width,depth,theme='wood',options={}){
 const layout=floorTileLayout(width,depth,theme),rule=FLOOR_TILE_CATALOG[theme];
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d');const c='#'+rule.color.toString(16).padStart(6,'0');
 ctx.fillStyle='#'+rule.joint.toString(16).padStart(6,'0');ctx.fillRect(0,0,128,128);
 ctx.fillStyle=c;ctx.fillRect(3,3,122,122);
 for(let i=0;i<200;i++){const x=(i*71+13)%120+4,z=(i*37+7)%120+4;ctx.fillStyle=i%3?'#ffffff0c':'#0000000c';ctx.fillRect(x,z,2,2);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.9,metalness:.02});
 const holes=options.holes??[],positions=floorTilePlacements(width,depth,theme,options);
 const geo=new THREE.BoxGeometry(1,.12,1),mesh=new THREE.InstancedMesh(geo,mat,positions.length);
 const matrix=new THREE.Matrix4();
 positions.forEach((item,index)=>{
  matrix.makeTranslation(...item.position);
  mesh.setMatrixAt(index,matrix);
 });
 mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;parent.add(mesh);
 mesh.userData.floorFinish=theme;mesh.userData.tileCount=positions.length;
 mesh.userData.floorOpenings=holes.map(h=>({...h}));
 return mesh;
}
