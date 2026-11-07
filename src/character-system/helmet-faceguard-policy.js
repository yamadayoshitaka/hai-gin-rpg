// The imported plate_head GLB contains duplicate brow/nose fittings and
// full-height cheek guards. Once enlarged to a real seven-head scalp, these
// pieces cross the eyes or hang to the jaw. The surviving source metal parts
// provide the rim; added bands are unsafe without a true forehead attachment.
export function helmetFaceguardPolicy(meshName=''){
  const name=String(meshName).toLowerCase();
  // A central brow-mounted nasal guard is the black strip across the face
  // in the front preview. It cannot be repositioned safely with the helmet
  // shell: remove this independent decorative mesh, preserving both side rims.
  if(/fitted brow binding|nasal fastening|brow-mounted nasal guard/.test(name))
    return {keep:false,verticalScale:0};
  if(/bound face opening/.test(name))
    return {keep:true,verticalScale:.60};
  return {keep:true,verticalScale:1};
}

// Source head geometry is Z-up, *before* its GLB node transform converts it
// into the upright body frame. Anchor the shortened guard at its original
// brow end so it remains aligned when the entire helmet is fitted to the head.
export function shortenedGuardZ(z,top,verticalScale){
  return top-(top-z)*verticalScale;
}
