// A skinned eyebrow remains a separate object, but its bind-pose vertices
// should follow the real forehead profile rather than a floating flat plate.
// This is intentionally dependency-free so real GLTF buffers can be audited
// without opening a browser or taking hundreds of screenshots.
export function compactEyebrowBand(browPositions,{heightScale=.52}={}){
  if(browPositions.length%3)throw Error('XYZ triples expected');
  const result=new Float32Array(browPositions);
  let minY=Infinity,maxY=-Infinity;
  for(let i=1;i<result.length;i+=3){minY=Math.min(minY,result[i]);maxY=Math.max(maxY,result[i])}
  if(!Number.isFinite(minY))return result;
  // The imported 3 cm triangular wedges read like long white eyelashes when
  // enlarged on mobile. Keep their original outline along X, but tailor the
  // height into a fine, curved 15 mm eyebrow above each eye.
  const center=(minY+maxY)*.5;
  for(let i=1;i<result.length;i+=3)result[i]=center+(result[i]-center)*heightScale;
  return result;
}

export function conformEyebrowsToFace(browPositions,skinPositions,{clearance=.0028}={}){
  if(browPositions.length%3||skinPositions.length%3)throw Error('XYZ triples expected');
  if(!browPositions.length||!skinPositions.length)throw Error('Brow and face must contain vertices');
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity,zMax=-Infinity;
  for(let i=0;i<browPositions.length;i+=3){
    xMin=Math.min(xMin,browPositions[i]);xMax=Math.max(xMax,browPositions[i]);
    yMin=Math.min(yMin,browPositions[i+1]);yMax=Math.max(yMax,browPositions[i+1]);
    zMax=Math.max(zMax,browPositions[i+2]);
  }
  // Forehead only: reject back-of-head vertices and other parts of the body.
  const surface=[];
  for(let i=0;i<skinPositions.length;i+=3){
    const x=skinPositions[i],y=skinPositions[i+1],z=skinPositions[i+2];
    if(x>=xMin-.025&&x<=xMax+.025&&y>=yMin-.028&&y<=yMax+.028&&z>=zMax-.065)
      surface.push(x,y,z);
  }
  if(surface.length<15)return {positions:new Float32Array(browPositions),corrected:0,surfaceSamples:surface.length,maxBefore:0,maxAfter:0};
  const corrected=new Float32Array(browPositions);
  let changes=0,maxBefore=0,maxAfter=0;
  for(let i=0;i<corrected.length;i+=3){
    const x=corrected[i],y=corrected[i+1];
    let dist=Infinity,surfaceZ=corrected[i+2];
    for(let j=0;j<surface.length;j+=3){
      const dx=surface[j]-x,dy=surface[j+1]-y,d=dx*dx+dy*dy;
      if(d<dist){dist=d;surfaceZ=surface[j+2]}
    }
    // Do not snap to a distant cheek/temple sample on unusual model variants.
    if(dist>.028*.028)continue;
    const before=corrected[i+2]-surfaceZ;
    maxBefore=Math.max(maxBefore,before);
    // Retain about 3 mm for eyebrow fibers, eliminating the floating 1-2 cm
    // gap while keeping a visible textured brow above the actual skin.
    const target=surfaceZ+clearance;
    if(Math.abs(corrected[i+2]-target)>.0004){corrected[i+2]=target;changes++}
    maxAfter=Math.max(maxAfter,corrected[i+2]-surfaceZ);
  }
  return {positions:corrected,corrected:changes,surfaceSamples:surface.length,maxBefore,maxAfter};
}
