/** Stable 3D-to-2D anchor for squad circles; do not displace labels to avoid overlaps. */
export const SQUAD_CIRCLE_DIAMETER_PX=70;
export function projectSquadCircleAnchor(ndc,canvas,{
 viewportWidth,topBoundary=0,bottomBoundary=Infinity,diameter=SQUAD_CIRCLE_DIAMETER_PX
}={}){
 if(!ndc||!canvas||![ndc.x,ndc.y,ndc.z].every(Number.isFinite)||
    ndc.z < -1||ndc.z > 1)return null;
 const left=Number(canvas.left)||0,top=Number(canvas.top)||0;
 const width=Number(canvas.width)||0,height=Number(canvas.height)||0;
 if(width<=0||height<=0)return null;
 const half=diameter/2,x=left+(ndc.x+1)*width/2,y=top+(1-ndc.y)*height/2;
 const maxX=Math.min(Number.isFinite(viewportWidth)?viewportWidth:left+width,left+width);
 const minY=Math.max(top,topBoundary),maxY=Math.min(top+height,bottomBoundary);
 if(x-half<Math.max(0,left)||x+half>maxX||y-half<minY||y+half>maxY)return null;
 return {x:Math.round(x),y:Math.round(y)};
}
