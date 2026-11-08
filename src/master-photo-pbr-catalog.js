/**
 * Verified-in-repository image maps and external CC0 source *candidates*.
 *
 * IMPORTANT: "existing" does NOT imply that repository photos are CC0.
 * An external reference is not downloaded, applied or installed.
 * Facial skin is UV-specific: never tile a generic fabric/leather photo
 * over eyes/nose/mouth, and never overwrite a donor's original face atlas.
 */
const freeze=(v)=>Object.freeze(v);
const donor=(name,sex,albedo,normal,roughness)=>freeze({
 id:name,role:'skin',sex,sourceType:'bundled-donor',state:'existing-original',
 license:'source-model-license-review',origin:'Quaternius Superhero '+sex,
 atlasUV:true,isPhotoScanVerified:false,
 maps:freeze({albedo,normal,roughness}),
 note:'Original skin UV atlas preserved; a verified photorealistic donor/head scan is still needed.'
});
const t='assets/characters/quaternius-base/textures/';
const outf=(name,role)=>freeze({
 id:'outfit-'+name,role,sourceType:'bundled-photo',state:'existing-original',
 license:'origin-verification-required',origin:'Existing repository photograph',
 atlasUV:false,isPhotoScanVerified:false,
 maps:freeze({albedo:'assets/textures/outfits/'+name+'.jpg'}),
 note:'Existing local colour-only photograph; no authentic normal/roughness maps in this slot.'
});
const creature=(id,role,albedo,normal)=>freeze({
 id,role,sourceType:'bundled-texture',state:'existing-original',
 license:'origin-verification-required',origin:'Existing repository creature maps',
 atlasUV:false,isPhotoScanVerified:false,maps:freeze({albedo,normal}),
 note:'Preserve existing material; verify image provenance before commercial distribution.'
});
export const BUNDLED_PHOTO_MATERIALS=freeze([
 donor('skin-male','male',t+'df680cbc1967a61e85998bfafb8f7bc0a36dd604bb3266486c4b06b1a184bb45.png',
  t+'9b25cf9200216eb754b79cf4c63b5380c419780788322f3c57cdd2b3e02679a6.png',
  t+'c70dabf48574cda55644d556beae1ee7cf1bdcf68a50d259d20f2f2358f27991.png'),
 donor('skin-female','female',t+'d366843ee7d9e9f37ec87a0e1c98c7f2e45573c08eeb80a51a6d9344e68cf288.png',
  t+'cf922460b43ccd31e983e34db05514c9d451dd2f9cdd01a843978e797719f859.png',
  t+'d2beabf2bd0313e32c68dcdbb80dca371a6e994fabf96efa97128bf9f14fa57b.png'),
 outf('linen','cloth'),outf('velvet','cloth'),outf('damask','cloth'),
 outf('leather','leather'),outf('steel','metal'),outf('gold-brocade','trim'),
 creature('wolf-fur','fur','assets/creatures/wolf-fur-albedo-v1.webp','assets/creatures/wolf-fur-normal-v1.webp'),
 creature('dragon-scales','scales','assets/creatures/dragon-scales-albedo-v1.webp','assets/creatures/dragon-scales-normal-v1.webp')
]);
const candidate=(id,role,url,uses)=>freeze({
 id,role,sourceType:'official-external-cc0-reference',state:'candidate-not-installed',
 origin:'Poly Haven',url,license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',
 isPhotoScanVerified:false,
 maps:null,noRemoteRuntimeLoad:true,commercialUseAllowed:true,paidAccessRequired:false,
 useCases:freeze(uses),
 note:'Reference only. Download official original material maps with their measured scale and provenance; check asset is not a locked Vault item.'
});
export const FREE_PHOTO_PBR_REFERENCES=freeze([
 candidate('cotton-jersey','cloth','https://polyhaven.com/a/cotton_jersey',['robe','shirt','cloth']),
 candidate('fabric-leather-02','leather','https://polyhaven.com/a/fabric_leather_02',['strap','sheath','belt']),
 candidate('metal-plate-02','metal','https://polyhaven.com/a/metal_plate_02',['weathered-armor','weapon','helmet']),
 candidate('rusty-metal-sheet','metal','https://polyhaven.com/a/rusty_metal_sheet',['weathered-armor','shield']),
]);
export const PHOTO_PBR_CHANNEL_POLICY=freeze({
 baseColor:{colorSpace:'srgb',purpose:'actual diffuse colour with baked direct lighting removed'},
 normal:{colorSpace:'linear',purpose:'microgeometry in tangent space (OpenGL +Y for Three.js)'},
 roughness:{colorSpace:'linear',purpose:'surface reflection variation; NOT arbitrary alpha'},
 metalness:{colorSpace:'linear',purpose:'metals only; no metalness on skin/hair/fabric'},
 ao:{colorSpace:'linear',purpose:'occlusion separate from base colour'},
 displacement:{colorSpace:'linear',purpose:'SOURCE master optional, never simulate a scan by claiming it was measured'},
});
export const MASTER_PHOTO_TEXTURE_POLICY=freeze({
 sourceQuality:'high-resolution-unoptimized',maxSourceBytes:null,maxSourceTexturePixels:null,
 enablePaidAPIs:false,enableRemoteRuntimeFetch:false,
 requireCommercialLicenseEvidence:true,allowUnverifiedExistingPreview:true,
 forbidGenericSkinReplacement:true,requireRealModelCaptureForVisualQA:true
});
export const USER_CAPTURE_METHOD=freeze({
 sourceType:'user-owned-original-photo',license:'creator-owned-pending-verification',
 privacy:'local-preview-only',fileNeverUploaded:true,
 instructions:freeze([
  'Use your own original photographs, obtained with permission for identifiable people.',
  'Shoot diffuse and evenly lit surfaces at a perpendicular angle; use RAW if available.',
  'Place a neutral gray reference and a ruler in one calibration shot.',
  'Take an additional close-up for pores/weave/grain; avoid specular hotspots and hard shadows.',
  'Albedo alone is not a measured normal/roughness map; capture or author those separately.',
  'Record real-world width, source owner, use permission and a license/provenance note.',
  'Skin atlas requires anatomical UV alignment; face photos are not automatically safe for upload.'
 ])
});
export const allMasterPhotoSources=()=>[...BUNDLED_PHOTO_MATERIALS,...FREE_PHOTO_PBR_REFERENCES];
