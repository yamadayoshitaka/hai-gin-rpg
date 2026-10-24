import {WALL_UNIT_KEYS,originalWallModule} from './wall-module-library.js';
/** Compile plan segments to unscaled wall instances. The narrow endpoint seam (<.025m)
 * is intentionally open rather than stretching a mesh or blocking a doorway. */
export function compileWallModules(segments,{areaId='area',wallHeight=5.85}={}){
 const instances=[];
 for(const segment of segments){
  const [ax,az]=segment.from,[bx,bz]=segment.to;
  const length=Math.hypot(bx-ax,bz-az);
  if(!Number.isFinite(length)||length<.05)throw Error('Invalid wall segment '+segment.id);
  if(Math.abs(ax-bx)>.00001&&Math.abs(az-bz)>.00001)throw Error('Only cardinal plan segments supported: '+segment.id);
  const moduleHeight=segment.height??wallHeight;
  const openings=[...(segment.openings??[])].map(g=>({start:length/2+g.offset-g.width/2,end:length/2+g.offset+g.width/2})).sort((a,b)=>a.start-b.start);
  const spans=[];let cursor=0;
  for(const gap of [...openings,{start:length,end:length}]){
   if(gap.start<cursor-.00001||gap.start<-.00001||gap.end>length+.00001)throw Error('Invalid wall opening: '+segment.id);
   if(gap.start>cursor)spans.push([cursor,gap.start]);
   cursor=gap.end;
  }
  const ux=(bx-ax)/length,uz=(bz-az)/length;
  for(let spanIndex=0;spanIndex<spans.length;spanIndex++){
   const [from,to]=spans[spanIndex];
   const count=Math.round((to-from)/.05);
   const occupied=count*.05;
   // Center the tiled row within its designated solid interval.
   let pos=from+((to-from)-occupied)/2;
   let remain=count;
   for(const moduleId of WALL_UNIT_KEYS){
    const part=originalWallModule(moduleId,moduleHeight),ticks=Math.round(part.length/.05);
    while(remain>=ticks){
     const center=pos+part.length/2;
     const x=ax+ux*center,z=az+uz*center;
     const horizontal=Math.abs(ux)>.5;
     instances.push({id:areaId+':'+segment.id+':'+spanIndex+':'+Math.round(pos*1000),
      areaId,segmentId:segment.id,moduleId:part.id,position:[x,0,z],
      rotationY:horizontal?0:Math.PI/2,size:[part.length,part.height,part.thickness],
      collision:{x,z,w:horizontal?part.length:part.thickness,d:horizontal?part.thickness:part.length}});
     pos+=part.length;remain-=ticks;
    }
   }
  }
 }
 return instances;
}
