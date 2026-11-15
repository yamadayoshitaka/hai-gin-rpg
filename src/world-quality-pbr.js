/** Reviewable, deterministic PBR adjustments. No topology/collision or material-map mutation.
 * Batch writes ONLY to its review branch; main changes require approved PR merge.
 * A perceptual proxy alone is not proof of photoreal visual quality.
 */
export const WORLD_QUALITY_MATERIAL_OVERRIDES=Object.freeze({
 // WORLD_QUALITY_AUTO_BEGIN
 // WORLD_QUALITY_AUTO_END
});
export function tuneWorldQualityMaterial(material,objectId){
 const spec=WORLD_QUALITY_MATERIAL_OVERRIDES[objectId];
 if(!spec||!material||!material.isMeshStandardMaterial||
    !Number.isFinite(material.roughness))return material;
 const scale=spec.roughnessScale;
 if(!Number.isFinite(scale)||scale<.75||scale>1.15)return material;
 const clone=material.clone();
 clone.roughness=Math.max(.06,Math.min(1,clone.roughness*scale));
 // Never turn ordinary stone, wood, grass or skin into metal.
 clone.needsUpdate=true;
 return clone;
}
