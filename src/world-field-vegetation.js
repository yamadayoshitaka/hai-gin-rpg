/**
 * Species-aware field vegetation for the actual object-catalog meshes.
 * Each plant is a curved, tapered cluster of double-sided leaves, not a cone.
 * The authored plant is repeated with InstancedMesh so a 10x10 field uses
 * one draw call instead of a separate mesh/draw call for each crop.
 * World measurements are derived from the same cellSize as surrounding props.
 */
export function buildFieldPlantGeometry(THREE,{species='rice',cellSize=2.2}={}){
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('cellSize must be positive');
 if(species!=='rice'&&species!=='vegetable')throw new RangeError('Unknown plant species');
 const rice=species==='rice';
 const blades=rice?11:9,segments=5,height=(rice?.70:.50)*cellSize;
 const spread=(rice?.30:.56)*cellSize,baseWidth=(rice?.029:.105)*cellSize;
 const vertices=[],indices=[];
 for(let blade=0;blade<blades;blade++){
  // Each blade has a deterministic azimuth, variable reach, and no z-fighting.
  const angle=2*Math.PI*blade/blades+(blade%3)*.065;
  const outwardX=Math.cos(angle),outwardZ=Math.sin(angle);
  const sideX=-outwardZ,sideZ=outwardX;
  const reach=spread*(.82+(blade%4)*.075);
  const lift=height*(.86+(blade%5)*.027);
  const first=vertices.length/3;
  for(let s=0;s<=segments;s++){
   const t=s/segments;
   // Stalk bases rise from the soil, then leaf tips bend under their own weight.
   const y=lift*(rice?(1.17*t-.30*t*t):(.98*t-.40*t*t));
   const radial=reach*(t*t*(3-2*t));
   const width=baseWidth*Math.sin(Math.PI*(.04+.93*t));
   for(const sign of [-1,1]){
    vertices.push(outwardX*radial+sideX*width*sign,y,
     outwardZ*radial+sideZ*width*sign);
   }
  }
  for(let s=0;s<segments;s++){
   const k=first+s*2;
   indices.push(k,k+2,k+1,k+1,k+2,k+3);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.userData={species,bladeCount:blades,segmentsPerBlade:segments};
 return geometry;
}

export function addFieldPlants(THREE,root,{species,cellSize,material,rows=10,cols=10}={}){
 if(!root?.add||!material)throw new TypeError('Field requires root and leaf material');
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1)throw new RangeError('Invalid field grid');
 const geometry=buildFieldPlantGeometry(THREE,{species,cellSize});
 const total=rows*cols;
 const plants=new THREE.InstancedMesh(geometry,material,total);
 const dummy=new THREE.Object3D();
 let index=0;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const stagger=(row%2? .13:0)*cellSize;
  dummy.position.set((col-(cols-1)/2)*.73*cellSize+stagger,
   (species==='rice'?.16:.15)*cellSize,
   (row-(rows-1)/2)*.73*cellSize);
  dummy.rotation.y=((row*17+col*13)%11-5)*.08;
  dummy.scale.setScalar(.89+((row*7+col*3)%9)*.025);
  dummy.updateMatrix();
  plants.setMatrixAt(index++,dummy.matrix);
 }
 plants.instanceMatrix.needsUpdate=true;
 plants.name=species==='rice'?'rice_blade_clusters':'vegetable_leaf_rosettes';
 plants.castShadow=true;
 plants.receiveShadow=true;
 plants.userData={species,plantCount:total,biologicalGeometry:'curved_tapered_leaf_clumps'};
 plants.computeBoundingSphere?.();
 root.add(plants);
 return plants;
}
