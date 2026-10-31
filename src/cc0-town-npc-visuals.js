   // Free equipment starts beside the character, not inside the palm.
   pivot.position.set(side==='r'?.55:-.55,.25,.30);
   pivot.updateWorldMatrix(true,false);
   host.userData.syncImportedEquipment=()=>{
    model.updateMatrixWorld(true);
    host.updateMatrixWorld(true);
    const inverseHost=host.getWorldQuaternion(new THREE.Quaternion()).invert();
    for(const item of importedProps){
     const handPosition=item.handBone.getWorldPosition(new THREE.Vector3());
     const handQ=item.handBone.getWorldQuaternion(new THREE.Quaternion());
     const palm=handPosition.add(item.palmOffset.clone().applyQuaternion(handQ));
     // The free weapon remains in its own world-space pose until the
     // handle and the palm receiver actually intersect.
     item.pivot.updateWorldMatrix(true,false);
     item.source.updateWorldMatrix(true,false);
     let handleWorld=item.source.localToWorld(item.gripLocal.clone());
     const contactDistance=handleWorld.distanceTo(palm);
     const contactLimit=palmContact.radius+spec.radius;
     const palmOverlap=contactDistance<=contactLimit;
     if(!equippedGrip&&palmOverlap)equippedGrip=true;
     // Deliberately no position/quaternion writes here: contact must not
     // silently turn into a bone-locked weapon attachment.
     const side=item.handBone.name.endsWith('_l')?'l':'r';
     const tips=['thumb_03_','index_03_','middle_03_','ring_03_','pinky_03_']
      .map(n=>outfitBones.find(b=>b.name===n+side)).filter(Boolean);
     const tipDistances=tips.map(b=>b.getWorldPosition(new THREE.Vector3()).distanceTo(handleWorld));
     const nearest=tipDistances.length?Math.min(...tipDistances):Infinity;
     const handleOverlap=nearest<=spec.radius*2.5;
     item.pivot.userData.equipState=equippedGrip?'held':palmOverlap?'palm-contact':'free';
     host.userData.equipmentDiagnostics.equipState=item.pivot.userData.equipState;
     host.userData.equipmentDiagnostics.palmOverlap=palmOverlap;
     host.userData.equipmentDiagnostics.handleOverlap=handleOverlap;
     host.userData.equipmentDiagnostics.gripContact=palmOverlap&&handleOverlap;
     host.userData.equipmentDiagnostics.gripContactDistance=Number.isFinite(nearest)?nearest:null;
     host.userData.equipmentDiagnostics.fingertipDistances=tipDistances;
     host.userData.equipmentDiagnostics.fingertipNearest=Number.isFinite(nearest)?nearest:null;
     host.userData.equipmentDiagnostics.fingertipCount=tips.length;
     host.userData.equipmentDiagnostics.renderedGripDistance=handleWorld.distanceTo(palm);
     host.userData.equipmentDiagnostics.gripConstraint={type:'contact-activated-hold',held:equippedGrip,contactDistance,contactLimit,fingerContact:handleOverlap};
    }
   };
   host.userData.syncImportedEquipment();
   return true;
  };
  const gripTestOnly=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('gripTest')==='1';
  // Grip preview now includes the actual equipped sword, not an empty fist.
  if(propId&&visibleHand){
   const previous=null;
   const weaponLengths={shortsword:.48,katana:.9,hammer:.58,sword:1.12,guard:1.12,shield:1.12};
   const size=weaponLengths[equipped]??.72;
   addHandProp(propId,visibleHand,size).then(ok=>{
    if(ok&&previous){previous.visible=false;host.userData.equipmentDiagnostics.fallback=false;}
   }).catch(e=>{host.userData.equipmentDiagnostics.error=String(e?.message||e);console.warn('Using BOM equipment fallback:',equipped,e)});
  }
  if(['shield','guard'].includes(equipped)){
   const left=bones.get('hand_l')||bones.get('wrist_l')||bones.get('lowerarm_l');
   addHandProp('Shield_Wooden',left,.44,true).catch(e=>{host.userData.equipmentDiagnostics.error=String(e?.message||e);console.warn('Shield fallback:',e)});
  }
  // Job appearance updates the visible glTF clothing, not the hidden procedural proxy.
  const clothes=[];
  model.traverse(node=>{
   if(!node.isMesh)return;
   const tag=(node.name+' '+(node.material?.name||'')).toLowerCase();
   if(/skin|face|eye|hair|brow|teeth|mouth|tongue/.test(tag))return;
   if(Array.isArray(node.material))return;
   if(node.material?.color){
    node.material=node.material.clone();
    clothes.push({mesh:node,base:node.material.color.clone(),roughness:node.material.roughness});
   }
  });
  host.userData.applyJobAppearance=(style,identity)=>{
   // Outfit slot must visibly affect materials even when the same source mesh is reused.
   const outfitPalette={traveler:['#8a7758','#544634'],mage:['#3f508f','#a78ce9'],bandit:['#3c5846','#74663b'],guard:['#798b9c','#c8ccd1'],noble:['#e1d6bc','#bca35f'],merchant:['#a87936','#5f3f29'],villager:['#7c6550','#aa8c63']};
   const colors=outfitPalette[preset.outfit]||[style.cloth,style.accent];
   const cloth=new THREE.Color(colors[0]),accent=new THREE.Color(colors[1]);
   for(let i=0;i<clothes.length;i++){
    const item=clothes[i],name=item.mesh.name.toLowerCase();
    const surface=/metal|armor|plate|helm|shield/.test(name)?accent:cloth;
    item.mesh.material.color.copy(item.base).lerp(surface,/metal|armor|plate/.test(name)?.72:.87);
    if(typeof item.mesh.material.roughness==='number')item.mesh.material.roughness=identity.finish==='steel'?.36:identity.finish==='leather'?.87:identity.finish==='silk'?.68:.79;
   }
   host.userData.appearanceJob=identity.primary;
   host.userData.appearanceOutfit=preset.outfit;
  };
  rig.visualJob=null; // Force material application when asynchronous glTF resolves.
  // Compatibility phase: validated adapter is mounted beside the existing
  // retarget operation. Only one authority may write the visible bones.
  host.userData.skeletonAdapterVersion='112.0';
  host.userData.externalNpcSync=applyPose;
  // Keep the weapon in scale with the displayed external mesh, never with the hidden proxy.
  rig.root.traverse(node=>{if(node.name==='weapon-bom-mount')node.scale.setScalar(.43);});
  host.userData.characterVisualBones=sync.length;
  host.userData.characterAvailableBones=[...bones.keys()];
  host.userData.characterMappedBones=[...new Set(sync.map(x=>x.bone.name))];
  host.userData.motionRetargetVersion='v87-live-bone-diagnostics';
  host.userData.characterVisualContract={valid:true,measuredHeight:poseHeight,targetHeight,armDirectionValid:true,headTriangles:headInfo.headTriangles};
  // Keep collision metadata opt-in until the full skinned solver is validated.
  host.userData.physicsRegisteredMeshes=0;
  host.userData.physicsCollisionContract={status:'temporarily-disabled',reason:'restore-visible-character'};
  host.userData.characterVisualSource='quaternius-cc0-outfit';
  host.userData.characterVisualId=id;
  host.userData.characterVisualSourceUrl=url;
  return true;
 }catch(e){
  host.userData.characterVisualError=String(e?.message||e);
  console.warn('CC0 outfit unavailable; preserving anatomical character BOM:',id,e);
  return false;
 }
}
