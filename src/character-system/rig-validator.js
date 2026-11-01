// Pure data validation: no Three.js dependency, no model mutation.
export function validateRigAudit(audit, profile) {
  const issues=[];const summaries={};
  for(const [modelName,model] of Object.entries(audit.models||{})){
    const joints=model.joints||[];const names=new Set(joints.map(j=>j.name));
    const byName=new Map(joints.map(j=>[j.name,j]));
    const errors=[];
    if(names.size!==joints.length)errors.push('duplicate joint names');
    const check=(name)=>{
      if(!name)return;
      if(Array.isArray(name)){name.forEach(check);return}
      if(typeof name==='object'){Object.values(name).forEach(check);return}
      if(!names.has(name))errors.push('missing mapped joint: '+name);
    };
    check(profile.boneNames);
    for(const joint of joints){
      if(joint.parent&&!names.has(joint.parent)&&joint.parent!=='Armature')errors.push('unknown parent: '+joint.name+' -> '+joint.parent);
      for(const [key,length] of [['translation',3],['rotation',4]]){
        const a=joint[key];if(!Array.isArray(a)||a.length!==length||!a.every(Number.isFinite))errors.push('invalid '+key+': '+joint.name)
      }
      const q=joint.rotation;if(q?.length===4){const norm=Math.hypot(...q);if(Math.abs(norm-1)>.005)errors.push('non-unit quaternion: '+joint.name)}
      const visited=new Set();let node=joint;
      while(node&&byName.has(node.parent)){
        if(visited.has(node.name)){errors.push('parent cycle: '+joint.name);break}
        visited.add(node.name);node=byName.get(node.parent)
      }
    }
    summaries[modelName]={joints:joints.length,mappedNamesChecked:true,errors};
    issues.push(...errors.map(x=>modelName+': '+x));
  }
  const models=Object.values(audit.models||{});
  if(models.length>=2){
    const shape=m=>new Map(m.joints.map(j=>[j.name,j.parent]));
    const a=shape(models[0]),b=shape(models[1]);
    for(const [name,parent] of a){if(!b.has(name)||b.get(name)!==parent)issues.push('male/female hierarchy differs: '+name)}
  }
  return {passed:issues.length===0,issues,summaries};
}

// Rotation relative to the source bind pose. A bone adapter must also reconcile
// local coordinate bases and parent chains before applying this to another rig.
export function relativeRotation(current,rest){
  const [x,y,z,w]=current,[rx,ry,rz,rw]=rest;
  const inv=[-rx,-ry,-rz,rw];
  return [w*inv[0]+x*inv[3]+y*inv[2]-z*inv[1],w*inv[1]-x*inv[2]+y*inv[3]+z*inv[0],w*inv[2]+x*inv[1]-y*inv[0]+z*inv[3],w*inv[3]-x*inv[0]-y*inv[1]-z*inv[2]];
}
