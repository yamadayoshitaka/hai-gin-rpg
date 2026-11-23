/**
 * Female v121 makeup mixer. Alters real 13,455-vertex COLOR_0 PBR input and
 * actual eyeliner/brow materials, never a 2D screenshot or CSS overlay.
 * Each preset can be exported in the adjusted GLB.
 */
export const V121_MAKEUP_PRESETS=Object.freeze({
  bare:{label:'すっぴん',blush:0,lip:0,shadow:0,liner:.25,
    lipColor:[.01,.10,.13],shadowColor:[.24,.28,.32],brow:0x79695e,linerColor:0x59413b},
  natural:{label:'ナチュラル',blush:.30,lip:.36,shadow:.18,liner:.43,
    lipColor:[.015,.14,.16],shadowColor:[.22,.27,.31],brow:0x65534c,linerColor:0x483632},
  pink:{label:'血色ピンク',blush:.48,lip:.58,shadow:.34,liner:.66,
    lipColor:[.015,.22,.22],shadowColor:[.22,.28,.33],brow:0x59483e,linerColor:0x3c292a},
  brown:{label:'ブラウン',blush:.31,lip:.51,shadow:.58,liner:.84,
    lipColor:[.06,.17,.19],shadowColor:[.36,.32,.27],brow:0x503d34,linerColor:0x332523},
  glamorous:{label:'華やか',blush:.55,lip:.74,shadow:.70,liner:.97,
    lipColor:[.025,.26,.26],shadowColor:[.26,.30,.34],brow:0x4c3833,linerColor:0x302022}
});
const gauss=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const fade=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const clamp=x=>Math.max(0,Math.min(1,x));

/**
 * Derive pigments from real facial coordinates rather than 2D projected
 * circles. The lower vermilion begins above the chin; neither lip colour
 * nor cheek blush is permitted to run onto the jaw or underside of the head.
 * Exported for independent regression checks on anatomically critical points.
 */
export function v121MakeupMasks(x,y,z){
  const ax=Math.abs(x),front=fade(z,.084,.132);
  // Absolute anatomical guards are intentional: a gaussian alone has
  // nonzero tails on the chin and jaw. Do not let any preset cross them.
  const vermilion=(y>=.211&&y<=.250&&ax<=.052&&z>.119);
  const lipBands=(.82*gauss(y,.240,.0068)+gauss(y,.223,.0077));
  // Feather both pigmentation boundaries so no second horizontal lip line
  // is drawn by the COLOR_0 cutoff below the lower vermilion.
  const lipSurface=vermilion?
    fade(z,.119,.143)*fade(y,.211,.221)*(1-fade(y,.247,.251)):0;
  return {
    blush:y>=.215?(gauss(x,-.076,.031)+gauss(x,.076,.031))*
      gauss(y,.257,.028)*front:0,
    lip:clamp(lipBands*gauss(x,0,.033)*lipSurface),
    shadow:(gauss(x,-.044,.026)+gauss(x,.044,.026))*
      gauss(y,.323,.008)*fade(z,.090,.128),
    liner:(gauss(x,-.043,.024)+gauss(x,.043,.024))*
      gauss(y,.304,.003)*fade(z,.085,.127),
    highlighter:gauss(ax,.058,.024)*gauss(y,.272,.024)*front
  };
}

export function attachV121Makeup({neutral,face,onChange=()=>{}}){
  const color=face.geometry.getAttribute('color');
  const position=face.geometry.getAttribute('position');
  if(!color||color.count!==13455||color.itemSize!==3)
    throw Error('Female v121 makeup requires 13,455 PBR vertex colours');
  const originals=new Float32Array(color.array);
  const localXYZ=new Float32Array(position.array);
  const cosmetic=[];
  neutral.traverse(mesh=>{
    if(!mesh.isMesh||mesh===face)return;
    if(/EYELINER|EYELASHES|EYEBROW|LID_CREASE/.test(mesh.name))
      cosmetic.push(mesh);
  });
  if(cosmetic.length<5)throw Error('Missing eyelid, brow and lash geometry');

  // Capture the position after the selected neutral face reference is applied.
  // The pigments stay anchored to the anatomical lip bands, not a floating
  // cosmetic disc or a face-wide re-colour.
  const masks=Array.from({length:color.count},(_,i)=>
    v121MakeupMasks(localXYZ[3*i],localXYZ[3*i+1],localXYZ[3*i+2]));

  const originalMaterials=new Map(cosmetic.map(part=>
    [part,part.material.color.clone()]));
  let current='natural';
  function select(id){
    const preset=V121_MAKEUP_PRESETS[id];
    if(!preset)throw Error('Unknown v121 makeup preset '+id);
    current=id;
    for(let i=0;i<color.count;i++){
      if(id==='bare'){
        color.array.set(originals.subarray(i*3,i*3+3),i*3);
        continue;
      }
      const m=masks[i], k=i*3;
      // Preserve each source skin colour, including its natural lip
      // undertone. Apply small channel-wise pigment differences ONLY inside
      // the localized anatomical mask. No jaw/chin colour replacement.
      const blush=m.blush*preset.blush;
      const lipstick=m.lip*preset.lip;
      const eyes=m.shadow*preset.shadow;
      const upper=m.liner*preset.liner;
      color.array[k]=clamp(originals[k]-.019*blush-.004*m.highlighter-
        lipstick*preset.lipColor[0]-eyes*preset.shadowColor[0]-.040*upper);
      color.array[k+1]=clamp(originals[k+1]-.072*blush-.007*m.highlighter-
        lipstick*preset.lipColor[1]-eyes*preset.shadowColor[1]-.075*upper);
      color.array[k+2]=clamp(originals[k+2]-.080*blush-.008*m.highlighter-
        lipstick*preset.lipColor[2]-eyes*preset.shadowColor[2]-.070*upper);
    }
    color.needsUpdate=true;
    for(const part of cosmetic){
      const name=part.name;
      const mat=part.material;
      if(!mat?.color)continue;
      if(id==='bare'){
        mat.color.copy(originalMaterials.get(part));mat.needsUpdate=true;
        continue;
      }
      if(/EYEBROW/.test(name))mat.color.setHex(preset.brow);
      else if(/EYELINER/.test(name))mat.color.setHex(preset.linerColor);
      else if(/EYELASHES/.test(name))mat.color.setHex(preset.linerColor);
      else if(/LID_CREASE/.test(name))
        mat.color.setHex(id==='brown'?0x826a63:id==='glamorous'?0x936773:0x987c75);
      mat.needsUpdate=true;
    }
    neutral.userData.v121MakeupPreset=id;
    document.documentElement.dataset.v121Makeup=id;
    onChange(id,preset.label);
    return id;
  }
  select('natural');
  return {select,current:()=>current,isChanged:()=>current!=='bare',
          presets:V121_MAKEUP_PRESETS,originals};
}
