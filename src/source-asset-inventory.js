/** Source-asset inventory. Catalog entries are discovered sources, not proof of runtime compatibility.
 * Register import results here after conversion, rig validation and attribution checks.
 */
export const RPG_ASSET_INVENTORY=Object.freeze({
  characterModels:[
    'assets/characters/Barbarian.glb','assets/characters/Knight.glb',
    'assets/characters/Mage.glb','assets/characters/Rogue.glb',
    'assets/characters/Rogue_Hooded.glb',
    ...['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger']
      .map(id=>'assets/characters/quaternius-outfits/'+id+'.gltf')
  ],
  equipment:[
    'assets/props/fantasy-megakit/Axe_Bronze.gltf',
    'assets/props/fantasy-megakit/Shield_Wooden.gltf',
    'assets/props/fantasy-megakit/Sword_Bronze.gltf'
  ],
  animationLibrary:'assets/animations/UAL1_Standard.glb',
  pendingLibraries:[
    {name:'Modular Character Outfits - Fantasy',format:'gltf',parts:24,requirement:'convert or import per-part meshes and bind to matching skeleton'},
    {name:'Fantasy Props MegaKit',format:'gltf',parts:94,requirement:'import with texture dependencies and collision/scale metadata'},
    {name:'Universal Animation Library',format:'glb',requirement:'retarget animation bones to selected character rig'}
  ]
});
export const RPG_ASSET_LOADING_POLICY=Object.freeze({
  eager:'only current actor base model and necessary idle animation',
  lazy:'job cosmetics, active equipment, active skill animations, nearby area props',
  validation:'model geometry, texture paths, rig hierarchy, skin weights and animation mapping'
});
