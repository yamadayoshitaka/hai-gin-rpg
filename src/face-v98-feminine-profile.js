/**
 * v98: neutral young feminine midface/alar correction on the REAL source
 * head clone. Coordinates follow the donor's existing 3D triangles.
 *
 * No detached cheek/nose objects, no texture replacement, no source GLB edits.
 * The mouth aperture, orbital rims, ears, back of head and scalp are excluded.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=(a,b,x)=>{
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
};
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);

/**
 * A continuously feathered vector field in normalized original-head
 * coordinates; x is signed half-width, y is bottom-to-top, z back-to-front.
 * Displacements are fractions of the head's x/y/z dimensions.
 */
export function feminineMidfaceNoseDelta({
 xn=0,yn=0,zn=0,ageWrinkles=0
}={}){
 const age=clamp(ageWrinkles);
 const youth=1-smooth(.18,.67,age);
 if(youth<=0||zn<.49||yn<.455||yn>.712)
  return {dx:0,dy:0,dz:0,cheek:0,alar:0};
 const ax=Math.abs(xn),front=smooth(.51,.76,zn);
 // Restored malar fat pad: beneath the lower lid and beside the smile.
 // The upper and lower fields blend over the same native triangles, not
 // two disconnected circles or a sharply carved nasolabial crease.
 const cheekSafe=smooth(.265,.36,ax)*(1-smooth(.72,.835,ax));
 const upper=bell(ax,.48,.19)*bell(yn,.563,.083)*cheekSafe*front;
 const lower=bell(ax,.49,.21)*bell(yn,.484,.075)*cheekSafe*front;
 const cheek=clamp(.92*upper+.44*lower);
 // Narrow lateral nasal cartilage without pinching its central tip or
 // cutting nostril holes. The sidewall joins the native bridge smoothly.
 const alar=bell(ax,.179,.061)*bell(yn,.555,.039)*
  (1-smooth(.255,.30,ax))*front;
 const bridge=bell(ax,.145,.053)*bell(yn,.627,.066)*
  (1-smooth(.258,.30,ax))*front;
 const tip=bell(ax,.036,.079)*bell(yn,.571,.040)*front;
 const nostrilRim=bell(ax,.111,.048)*bell(yn,.535,.021)*front;
 // Width comes from true cheek vertices; z provides volume, not shadow.
 const dx=xn*(.010*upper+.006*lower-.071*alar-.017*bridge)*youth;
 // A slightly lower columella and alar underside hides the snub/pig nose
 // from the front while maintaining a continuous nose-to-philtrum slope.
 const dy=-(.0082*tip+.0035*nostrilRim)*youth;
 // Reduce bulbous tip projection after v95's profile cap and replenish
 // BOTH inner malar and outer mid-cheek rather than the jaw.
 const dz=(.079*upper+.037*lower-.022*tip-.009*alar+
  .0025*bridge)*youth;
 return {dx,dy,dz,cheek,alar};
}

function triangleNormal(array,a,b,c){
 const i=a*3,j=b*3,k=c*3;
 const ux=array[j]-array[i],uy=array[j+1]-array[i+1],uz=array[j+2]-array[i+2];
 const vx=array[k]-array[i],vy=array[k+1]-array[i+1],vz=array[k+2]-array[i+2];
 return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
}

/** Apply to the clone only. Reject triangle inversion and badly collapsed
 * faces by halving the proposed deformation rather than forcing a bad mesh.
 */
export function refineFeminineMidfaceNose(geometry,{
 gender='female',ageWrinkles=0
}={}){
 const fail=reason=>({applied:false,reason});
 if(gender!=='female')return fail('male-preserved');
 if(clamp(ageWrinkles)>=.67)return fail('mature-face-preserved');
 const p=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.();
 if(!p||!idx||p.count<80||idx.count<90)
  return fail('missing-indexed-owned-face');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 if(!box)return fail('missing-bounds');
 const width=box.max.x-box.min.x,height=box.max.y-box.min.y,
  depth=box.max.z-box.min.z;
 if(Math.min(width,height,depth)<1e-6)return fail('invalid-bounds');
 const centerX=(box.min.x+box.max.x)*.5;
 const src=p.array.slice(),proposal=new Float32Array(src.length);
 let affected=0,cheekVertices=0,alarVertices=0;
 for(let i=0;i<p.count;i++){
  const at=i*3,x=src[at],y=src[at+1],z=src[at+2];
  const f=feminineMidfaceNoseDelta({
   xn:(x-centerX)/(width*.5),yn:(y-box.min.y)/height,
   zn:(z-box.min.z)/depth,ageWrinkles
  });
  const dx=f.dx*width*.5,dy=f.dy*height,dz=f.dz*depth;
  proposal[at]=dx;proposal[at+1]=dy;proposal[at+2]=dz;
  if(Math.abs(dx)+Math.abs(dy)+Math.abs(dz)>1e-8)affected++;
  if(f.cheek>.06)cheekVertices++;
  if(f.alar>.06)alarVertices++;
 }
 if(affected<12)return fail('no-anatomical-surface-coverage');
 // A compact safety check over original indexed donor triangles. The
 // sculpt may not turn normals backwards or collapse a skin polygon.
 let output=null,blend=1;
 for(let attempt=0;attempt<7;attempt++,blend*=.5){
  const next=src.slice();
  for(let i=0;i<src.length;i++)next[i]+=proposal[i]*blend;
  let unsafe=false;
  for(let t=0;t<idx.count;t+=3){
   const a=idx.getX(t),b=idx.getX(t+1),c=idx.getX(t+2);
   if(a>=p.count||b>=p.count||c>=p.count){unsafe=true;break;}
   const ai=a*3,bi=b*3,ci=c*3;
   if(!proposal[ai]&&!proposal[ai+1]&&!proposal[ai+2]&&
      !proposal[bi]&&!proposal[bi+1]&&!proposal[bi+2]&&
      !proposal[ci]&&!proposal[ci+1]&&!proposal[ci+2])continue;
   const before=triangleNormal(src,a,b,c),after=triangleNormal(next,a,b,c);
   const oldArea=Math.hypot(...before),newArea=Math.hypot(...after);
   if(oldArea<1e-11)continue;
   const dot=before[0]*after[0]+before[1]*after[1]+before[2]*after[2];
   if(newArea<oldArea*.20||dot/(oldArea*newArea)<.30){
    unsafe=true;break;
   }
  }
  if(!unsafe){output=next;break;}
 }
 if(!output)return fail('unsafe-face-triangle-deformation');
 for(let i=0;i<p.count;i++)p.setXYZ(i,
  output[i*3],output[i*3+1],output[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals?.();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere?.();
 const result={applied:true,verticesAffected:affected,
  cheekVertices,alarVertices,blend,sourceDonorPreserved:true,
  indexedTrianglesPreserved:true,expressionNeutralBasis:true};
 geometry.userData=geometry.userData||{};
 geometry.userData.v98FeminineMidfaceNose=result;
 return result;
}
