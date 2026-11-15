/**
 * Species-specific 3D reconstruction recipes.
 *
 * The adopted grey-fang wolf defines the workflow (source GLB -> species
 * identity -> action coverage), NOT a universal animal body. Wings, six/eight
 * legs, serpent trunks and tentacles must keep their own topology.
 * m005 and m006 remain protected: no replacement of their prior assets.
 */
import {MONSTER_CATALOG} from './monster-catalog.js';
import {HUMAN_MONSTER_IDS} from './monster-character-cosplay-manifest.js';

const profiles=Object.freeze({
 m001:['canine','grey-wolf-king','r-wolf'],
 m002:['canine','flame-ruff-and-charred-coat','r-wolf'],
 m003:['canine','white-fenrir-ice-ruff','r-wolf'],
 m004:['canine','lightning-stripes-and-pricked-ears','r-wolf'],
 m005:['canine','ancient-moss-wolf',null],
 m006:['feline','black-panther',null],
 m007:['feline','sabertooth-fangs','r-tiger'],
 m008:['feline','lion-mane-and-royal-brow',null],
 m009:['feline','sand-leopard','r-jaguar'],
 m010:['feline','violet-thunder-tiger','r-tiger'],
 m011:['avian','layered-eagle-feathers','r-eagle'],
 m012:['winged-quadruped','eagle-beak-lion-body-wings',null],
 m013:['avian','phoenix-fire-flight-feathers',null],
 m014:['avian','owl-facial-disc-and-silent-wings',null],
 m016:['reptile','swamp-lizard-crocodilian-scales','r-crocodile'],
 m017:['reptile','basilisk-stone-eyes-and-plates',null],
 m018:['multiheaded-reptile','hydra-independent-necks',null],
 m019:['reptile','salamander-hot-skin',null],
 m020:['serpent','leviathan-long-body-and-fins',null],
 m021:['insect','beetle-hard-carapace-six-legs',null],
 m022:['insect','red-horned-beetle-six-legs',null],
 m023:['mantis','mantis-raptorial-arms-six-legs',null],
 m024:['insect','scarab-poison-shell-six-legs',null],
 m025:['insect','golden-holy-beetle-six-legs',null],
 m026:['arachnid','cave-spider-eight-legs',null],
 m027:['arachnid','purple-tarantula-eight-legs',null],
 m028:['arachnid','ice-spider-eight-legs',null],
 m029:['arachnid','fire-spider-eight-legs',null],
 m030:['arachnid','queen-spider-eight-legs',null],
 m046:['amorphous','translucent-tide-slime','q024'],
 m047:['cephalopod','octopus-eight-arms-suckers',null],
 m048:['serpent','sea-serpent-fins-and-long-body',null],
 m049:['cephalopod','kraken-tentacles-and-suckers',null],
 m050:['aquatic','coral-sea-beast-and-fins',null],
});
export const PROTECTED_NONHUMAN_IDS=Object.freeze(['m005','m006']);
const excluded=new Set(HUMAN_MONSTER_IDS);
export const CREATURE_SPECIES_BLUEPRINTS=Object.freeze(Object.fromEntries(
 MONSTER_CATALOG.filter(m=>!excluded.has(m.id)).map(m=>{
  const record=profiles[m.id];
  if(!record)throw Error('Missing original nonhuman blueprint '+m.id);
  const [anatomy,feature,defaultMesh]=record;
  const protectedAsset=PROTECTED_NONHUMAN_IDS.includes(m.id);
  const profile=Object.freeze({
   id:m.id,name:m.name,anatomy,feature,element:m.element,
   palette:m.colors,skill:m.skill,
   source:defaultMesh||'procedural',
   protectedAsset,
   // This is an implementation recipe, not a visual quality approval.
   visualQA:'pending',
   actionSlots:Object.freeze(['idle','walk','run','attack','special',
    'roar','guard','dodge','hit','leap','defeat']),
  });
  return [m.id,profile];
 })));
export const NONHUMAN_REBUILD_IDS=Object.freeze(
 Object.keys(CREATURE_SPECIES_BLUEPRINTS).filter(
  id=>!CREATURE_SPECIES_BLUEPRINTS[id].protectedAsset));
export function creatureSpeciesBlueprint(id){
 const key=String(id||'').replace(/^summon_/,'');
 return CREATURE_SPECIES_BLUEPRINTS[key]||
  (id==='wolf'?CREATURE_SPECIES_BLUEPRINTS.m001:null);
}
export function defaultCreatureSource(id){
 const profile=creatureSpeciesBlueprint(id);
 if(!profile||profile.protectedAsset)return null;
 return profile.source==='procedural'?null:profile.source;
}
