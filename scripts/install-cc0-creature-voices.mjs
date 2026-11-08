/**
 * Install known CC0 creature recordings for the eight summon species.
 * Source: rubberduck's "80 CC0 creature SFX" and "#2" on OpenGameArt.
 * GitHub mirror is only a file transport; keep the original attribution.
 * No paid subscription, runtime API or authentication needed.
 */
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEST=path.join(ROOT,'audio/creatures/cc0');
const SRC='https://raw.githubusercontent.com/Silentnoob21/cc0-public-domain-sounds/main/';
const collection={
 wolf:{
  spawn:['1/howl.ogg','1/barking_01.ogg'],
  attack:['1/barking_01.ogg','1/barking_02.ogg','1/grunt_01.ogg'],
  hit:['1/hurt_01.ogg','1/hurt_02.ogg']
 },
 wyvern:{
  spawn:['1/roar_01.ogg','2/roar_04.ogg'],
  attack:['1/scream_01.ogg','2/attack_02.ogg','2/roar_05.ogg'],
  hit:['1/hurt_03.ogg','2/die_01.ogg']
 },
 dragon:{
  spawn:['1/roar_02.ogg','1/roar_03.ogg'],
  attack:['1/monster_01.ogg','2/roar_06.ogg','1/roar_03.ogg'],
  hit:['1/hurt_04.ogg','2/die_02.ogg']
 },
 elder_dragon:{
  spawn:['2/roar_06.ogg','1/roar_02.ogg'],
  attack:['2/monster_18.ogg','2/roar_05.ogg','1/monster_06.ogg'],
  hit:['2/die_03.ogg','1/hurt_05.ogg']
 },
 dragon_lord:{
  spawn:['2/roar_06.ogg','2/monster_20.ogg'],
  attack:['2/monster_19.ogg','2/roar_04.ogg','2/roar_06.ogg'],
  hit:['2/die_04.ogg','2/monster_17.ogg']
 },
 forest_archer:{
  spawn:['1/cute_01.ogg','1/misc_01.ogg'],
  attack:['1/spit_01.ogg','1/cute_04.ogg','2/attack_01.ogg'],
  hit:['1/hurt_01.ogg','1/cute_06.ogg']
 },
 seraph_guardian:{
  spawn:['1/ooh.ogg','1/weird_01.ogg'],
  attack:['1/misc_04.ogg','1/weird_02.ogg','2/attack_04.ogg'],
  hit:['1/hurt_02.ogg','1/weird_03.ogg']
 }
 // Horse keeps its species-specific synthesized whinny; no mislabeled monster file.
};
const manifest={format:1,license:'CC0-1.0',source:'rubberduck / OpenGameArt.org',references:[
 'https://opengameart.org/content/80-cc0-creature-sfx',
 'https://opengameart.org/content/80-cc0-creture-sfx-2'
],species:{}};
const unique=new Set();
for(const [type,events] of Object.entries(collection)){
 manifest.species[type]={};
 for(const [event,sourceFiles] of Object.entries(events)){
  manifest.species[type][event]=sourceFiles.map(n=>'audio/creatures/cc0/'+n.replace('/','/') );
  for(const n of sourceFiles)unique.add(n);
 }
}
for(const name of unique){
 const [pack,file]=name.split('/');
 if(!/^[12]$/.test(pack)||!/^[a-z0-9_]+\.ogg$/.test(file))throw Error('Unsafe sound filename');
 const dir=path.join(DEST,pack);mkdirSync(dir,{recursive:true});
 const dest=path.join(dir,file);
 if(existsSync(dest))continue;
 const group=pack==='1'?'80-CC0-creature-SFX':'80-CC0-creature-sfx-2';
 const url=SRC+group+'/'+file;
 const response=await fetch(url,{headers:{'Accept':'application/octet-stream'}});
 if(!response.ok)throw Error('Unable to fetch CC0 creature sound: '+url+' '+response.status);
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length<200||bytes.length>400000||String.fromCharCode(...bytes.slice(0,4))!=='OggS')throw Error('Invalid Ogg: '+name);
 writeFileSync(dest,bytes);
}
writeFileSync(path.join(DEST,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('CC0 creature recordings installed',unique.size,'across',Object.keys(collection).length,'species');
