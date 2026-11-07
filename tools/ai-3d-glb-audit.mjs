/**
 * Portable GLB structural and preliminary quality check.
 * Passes never imply visually correct topology, a good fit, or commercial rights.
 */
import crypto from 'node:crypto';

const CATEGORIES=new Set(['human','monster','summon','animal','armor','weapon']);
const GEOMETRY_TARGETS={human:30000,monster:40000,summon:50000,animal:25000,armor:30000,weapon:12000};

export function auditGLB(bytes,{category='monster'}={}){
 if(!CATEGORIES.has(category))throw Error('Unknown category: '+category);
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
 if(bytes.length<28||bytes.toString('ascii',0,4)!=='glTF')throw Error('Not a binary glTF GLB');
 if(bytes.readUInt32LE(4)!==2)throw Error('GLB version is not 2');
 if(bytes.readUInt32LE(8)!==bytes.length)throw Error('GLB declared length mismatch');
 let offset=12,document=null,binChunks=0;
 while(offset+8<=bytes.length){
   const n=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
   if(n%4!==0||n<0||n>bytes.length-offset-8)throw Error('Invalid GLB chunk size');
   if(type===0x4e4f534a){
     if(document)throw Error('Multiple JSON chunks');
     if(offset!==12)throw Error('JSON chunk must be first');
     document=JSON.parse(bytes.toString('utf8',offset+8,offset+8+n).trim());
   }else if(type===0x004e4942)binChunks++;
   offset+=8+n;
 }
 if(offset!==bytes.length)throw Error('GLB has a partial trailing chunk');
 if(document?.asset?.version!=='2.0')throw Error('GLB asset version missing');
 if(!Array.isArray(document.meshes)||!document.meshes.length)throw Error('GLB contains no meshes');
 if(!Array.isArray(document.nodes)||!document.nodes.length)throw Error('GLB contains no scene nodes');
 if(binChunks<1)throw Error('GLB has no embedded BIN chunk');
 const accessors=document.accessors||[],buffers=document.buffers||[];
 if(!buffers.length)throw Error('GLB lacks buffers');
 let meshes=0,vertices=0,triangles=0,primitives=0,hasNormals=false,hasUV=false;
 const warnings=[];
 for(const mesh of document.meshes){
   meshes++;
   for(const p of mesh.primitives||[]){
     primitives++;
     const pos=accessors[p.attributes?.POSITION];
     if(!pos||!Number.isInteger(pos.count)||pos.count<3)throw Error('Mesh primitive missing POSITION accessor');
     vertices+=pos.count;
     hasNormals ||=p.attributes?.NORMAL!=null;
     hasUV ||=p.attributes?.TEXCOORD_0!=null;
     const mode=p.mode??4;
     if(mode===4){
       const count=p.indices!=null?accessors[p.indices]?.count:pos.count;
       if(!count||count%3!==0)throw Error('Invalid triangle indices for primitive');
       triangles+=count/3;
     }
   }
 }
 if(primitives===0||triangles===0)throw Error('No renderable triangles');
 const materials=document.materials||[],textures=document.textures||[],skins=document.skins||[],animations=document.animations||[];
 const pbr=materials.filter(m=>m.pbrMetallicRoughness).length;
 const normalMaps=materials.filter(m=>m.normalTexture).length;
 const emissive=materials.filter(m=>m.emissiveTexture).length;
 const isRigExpected=['human','monster','summon','animal'].includes(category);
 if(triangles<GEOMETRY_TARGETS[category])warnings.push('detail: triangle count below target '+GEOMETRY_TARGETS[category]);
 if(!pbr)warnings.push('materials: PBR metallic-roughness material not detected');
 if(!textures.length)warnings.push('textures: no texture references');
 if(!hasNormals)warnings.push('surface: normals missing');
 if(!hasUV)warnings.push('surface: texture UV missing');
 if(isRigExpected&&!skins.length)warnings.push('animation: no skeleton; retargeting/rigging required');
 if(isRigExpected&&!animations.length)warnings.push('animation: no animation clips; motion mapping required');
 if(category==='armor'&&skins.length)warnings.push('armor: confirm skeleton is compatible with target body');
 // Intentionally no claims about how PBR looks; material metadata is not visual QA.
 return {
   format:'glb',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
   bytes:bytes.length,meshes,primitives,vertices,triangles,
   materials:materials.length,pbrMaterials:pbr,normalMaps,emissiveMaterials:emissive,
   textures:textures.length,skinCount:skins.length,animationCount:animations.length,
   hasNormals,hasUV,geomTarget:GEOMETRY_TARGETS[category],warnings,
   structurallyValid:true,visuallyApproved:false
 };
}
