// Extract the 6x2 grid of hairstyles from Vincent Freelance's
// "12 Real-time woman Hairstyles collection 02" GLB without copying mannequin heads.
// Usage: node tools/split-women-hair-glb.mjs INPUT.glb OUTPUT_DIRECTORY
// Source: https://sketchfab.com/3d-models/12-real-time-woman-hairstyles-collection-02-cdcc0d801e01485fa918738199f3ebd4
import fs from 'node:fs';
import path from 'node:path';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Input GLB and output directory are required');
const source=fs.readFileSync(input);
if(source.toString('ascii',0,4)!=='glTF')throw Error('Not a GLB');
const jsonBytes=source.readUInt32LE(12);
const sourceJson=JSON.parse(source.toString('utf8',20,20+jsonBytes));
const binaryStart=20+jsonBytes+8;
const columns=[0,-30,-60,-90,-120,-150],rows=[0,-40];
function accessor(index){
 const item=sourceJson.accessors[index],view=sourceJson.bufferViews[item.bufferView];
 const size=item.type==='VEC3'?3:item.type==='VEC2'?2:item.type==='VEC4'?4:1;
 const byteSize=item.componentType===5125||item.componentType===5126?4:item.componentType===5123?2:1;
 const stride=view.byteStride||size*byteSize;
 const start=binaryStart+(view.byteOffset||0)+(item.byteOffset||0);
 return Array.from({length:item.count},(_,i)=>Array.from({length:size},(_,k)=>{
  const at=start+i*stride+k*byteSize;
  if(item.componentType===5126)return source.readFloatLE(at);
  if(item.componentType===5125)return source.readUInt32LE(at);
  if(item.componentType===5123)return source.readUInt16LE(at);
  if(item.componentType===5121)return source.readUInt8(at);
  throw Error('Unsupported accessor component '+item.componentType);
 }));
}
const cells=Array.from({length:12},()=>[]);
for(const [meshIndex,mesh] of sourceJson.meshes.slice(5).entries()){
 for(const primitive of mesh.primitives){
  const positions=accessor(primitive.attributes.POSITION);
  const normals=accessor(primitive.attributes.NORMAL);
  const indices=accessor(primitive.indices).map(v=>v[0]);
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i],b=indices[i+1],c=indices[i+2];
   const x=(positions[a][0]+positions[b][0]+positions[c][0])/3;
   const z=(positions[a][2]+positions[b][2]+positions[c][2])/3;
   const col=columns.reduce((best,cx,index)=>Math.abs(x-cx)<Math.abs(x-columns[best])?index:best,0);
   const row=rows.reduce((best,cz,index)=>Math.abs(z-cz)<Math.abs(z-rows[best])?index:best,0);
   cells[row*columns.length+col].push(...[a,b,c].map(index=>({
    pos:positions[index],normal:normals[index],origin:index,mesh:meshIndex
   })));
  }
 }
}
function glb(style,lod,vertices,centerX,centerZ){
 const fraction=lod===0?1:lod===1?4:16;
 const points=[],normals=[],indices=[],unique=new Map();
 for(let tri=0;tri<vertices.length/3;tri+=fraction){
  for(let t=0;t<3;t++){
   const vertex=vertices[tri*3+t],key=vertex.mesh+'/'+vertex.origin;
   let idx=unique.get(key);
   if(idx===undefined){
    idx=points.length/3;unique.set(key,idx);
    const [x,y,z]=vertex.pos;
    points.push((x-centerX)*.01,(y-165)*.01,(z-centerZ)*.01);
    normals.push(...vertex.normal);
   }
   indices.push(idx);
  }
 }
 if(points.length<90)throw Error('Empty hair: '+style+'/'+lod);
 const pos=Buffer.from(new Float32Array(points).buffer);
 const nor=Buffer.from(new Float32Array(normals).buffer);
 const index=Buffer.from(new Uint32Array(indices).buffer);
 const binary=Buffer.concat([pos,nor,index]);
 const min=[0,1,2].map(i=>Math.min(...points.filter((_,k)=>k%3===i)));
 const max=[0,1,2].map(i=>Math.max(...points.filter((_,k)=>k%3===i)));
 const j={
  asset:{version:'2.0',generator:'hai-gin-hair-split-v1'},
  scene:0,scenes:[{nodes:[0]}],nodes:[{name:'female-hair-'+style,mesh:0}],
  meshes:[{name:'female-hair-'+style,primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,material:0}]}],
  materials:[{name:'recolorable-strand-hair',doubleSided:true,
   pbrMetallicRoughness:{baseColorFactor:[.42,.31,.25,1],metallicFactor:0,roughnessFactor:.82}}],
  buffers:[{byteLength:binary.length}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:pos.length,target:34962},
   {buffer:0,byteOffset:pos.length,byteLength:nor.length,target:34962},
   {buffer:0,byteOffset:pos.length+nor.length,byteLength:index.length,target:34963}],
  accessors:[{bufferView:0,componentType:5126,count:points.length/3,type:'VEC3',min,max},
   {bufferView:1,componentType:5126,count:normals.length/3,type:'VEC3'},
   {bufferView:2,componentType:5125,count:indices.length,type:'SCALAR'}]
 };
 const pad4=bytes=>(bytes+3)&~3;
 const jsonBuffer=Buffer.from(JSON.stringify(j),'utf8');
 const json=Buffer.alloc(pad4(jsonBuffer.length),32);jsonBuffer.copy(json);
 const bin=Buffer.alloc(pad4(binary.length));binary.copy(bin);
 const header=Buffer.alloc(12);header.write('glTF',0);header.writeUInt32LE(2,4);
 header.writeUInt32LE(12+8+json.length+8+bin.length,8);
 const jsonHeader=Buffer.alloc(8);jsonHeader.writeUInt32LE(json.length,0);jsonHeader.write('JSON',4);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(bin.length,0);binHeader.write('BIN\0',4);
 return {data:Buffer.concat([header,jsonHeader,json,binHeader,bin]),triangles:indices.length/3,vertices:points.length/3,min,max};
}
fs.mkdirSync(output,{recursive:true});
const manifest={source:'Vincent Freelance - 12 Real-time woman Hairstyles collection 02',license:'CC BY 4.0',styles:[]};
for(let i=0;i<12;i++){
 const id=String(i+1).padStart(2,'0'),style={id,sex:'female',lods:[]};
 for(let lod=0;lod<3;lod++){
  const name='female_hair_'+id+'_lod'+lod+'.glb';
  const result=glb(id,lod,cells[i],columns[i%6],rows[Math.floor(i/6)]);
  fs.writeFileSync(path.join(output,name),result.data);
  style.lods.push({file:name,triangles:result.triangles,vertices:result.vertices,min:result.min,max:result.max});
 }
 manifest.styles.push(style);
}
fs.writeFileSync(path.join(output,'manifest-female.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.styles.map(x=>({id:x.id,triangles:x.lods.map(l=>l.triangles)}))));
