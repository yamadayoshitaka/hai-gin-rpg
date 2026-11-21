/**
 * Identify imported facial-hair mesh names/materials without hiding the
 * eyebrows, eyelashes, scalp, hair fringe or the entire skinned head.
 * The previous regex had an escaped "\\s" inside a character class and
 * inspected only node.name: GLB mesh names often have generic Mesh_00 IDs.
 */
export const SERAPH_NO_BEARD_REVISION='seraph-material-and-node-facial-hair-filter-v2-20261121';
const FACIAL_HAIR=/(?:^|[\s_-])(?:beard|moustache|mustache|goatee|stubble|facial[\s_-]?hair|whisker|sideburns)(?=$|[\s_-])/i;
const EXCLUDE=/(?:^|[\s_-])(?:eyebrow|brow|eyelash|lash|forelock|bangs|scalp|crown|fringe)(?:$|[\s_-])/i;
export function isFacialHairSourceMesh(node){
 if(!node||!node.isMesh)return false;
 const names=[
  node.name||'',
  ...((Array.isArray(node.material)?node.material:[node.material])
   .filter(Boolean).map(m=>m.name||''))
 ];
 return names.some(name=>FACIAL_HAIR.test(name)&&!EXCLUDE.test(name));
}
