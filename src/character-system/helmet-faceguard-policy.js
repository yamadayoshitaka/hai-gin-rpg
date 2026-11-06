// The imported plate_head GLB contains duplicate brow/nose fittings and
// full-height cheek guards. Once enlarged to a real seven-head scalp, these
// pieces cross the eyes or hang to the jaw. The surviving source metal parts
// provide the rim; added bands are unsafe without a true forehead attachment.
export function helmetFaceguardPolicy(meshName=''){
  const name=String(meshName).toLowerCase();
  if(/fitted brow binding|nasal fastening/.test(name))
    return {keep:false,verticalScale:0};
  if(/bound face opening/.test(name))
    return {keep:true,verticalScale:.60};
  if(/brow-mounted nasal guard/.test(name))
    return {keep:true,verticalScale:.58};
  return {keep:true,verticalScale:1};
}

// Source head geometry is Z-up, *before* its GLB node transform converts it
// into the upright body frame. Anchor the shortened guard at its original
// brow end so it remains aligned when the entire helmet is fitted to the head.
export function shortenedGuardZ(z,top,verticalScale){
  return top-(top-z)*verticalScale;
}
