/**
 * Ground contact with the EXACT piecewise-planar triangles used by
 * EditorHeightmapTerrain in tactics-wireframe.html.
 *
 * The terrain is authored from smoothHeight at each (cell +/- .5) vertex,
 * then rendered as triangles (0,1,2) and (0,2,3), not a bicubic surface.
 * Sampling smoothHeight at a soldier's centre instead can place the
 * foot inside the visible polygon on steep river banks.
 *
 * Coordinates here are logical grid coordinates, not world metres.
 * No heap allocation or scene raycast is needed per soldier/frame.
 */
export function triangleTerrainHeight(gx,gz,sampleVertexHeight){
  if(!Number.isFinite(gx)||!Number.isFinite(gz)||
     typeof sampleVertexHeight!=='function')
    throw Error('Invalid triangle terrain contact input');
  // Each rendered cell is centred on an integer logical grid coordinate.
  const cx=Math.floor(gx+.5),cz=Math.floor(gz+.5);
  const u=Math.min(1,Math.max(0,gx-cx+.5));
  const v=Math.min(1,Math.max(0,gz-cz+.5));
  const h00=sampleVertexHeight(cx-.5,cz-.5);
  const h11=sampleVertexHeight(cx+.5,cz+.5);
  if(u<=v){
    const h01=sampleVertexHeight(cx-.5,cz+.5);
    return h00*(1-v)+h01*(v-u)+h11*u;
  }
  const h10=sampleVertexHeight(cx+.5,cz-.5);
  return h00*(1-u)+h11*v+h10*(u-v);
}

/**
 * Shared 50/1000 walkable surface selector. Only an ACTUAL intact bridge
 * footprint or built stair tile wins over the ground triangle. Do not use
 * bridge deck height for nearby river-bank tiles or the water underneath it.
 */
export function battleWalkSurfaceY(gx,gz,bridgeHeights,stairCells,sampleVertexHeight){
  const key=Math.round(gx)+','+Math.round(gz);
  const bridge=bridgeHeights?.get(key);
  if(bridge!=null)return bridge;
  const stair=stairCells?.get(key)?.height;
  return stair??triangleTerrainHeight(gx,gz,sampleVertexHeight);
}

/**
 * A ground-level actor has one authoritative floor surface. Mounts add
 * the saddle height, not an extra second ground interpolation. Upper floors
 * are resolved by authored building routes and must not be clamped here.
 */
export function anchoredStandingY(surfaceY,seatY=0,footClearance=.018){
  if(!Number.isFinite(surfaceY)||!Number.isFinite(seatY))
    throw Error('Invalid contact height');
  return surfaceY+seatY+(seatY?0:footClearance);
}
