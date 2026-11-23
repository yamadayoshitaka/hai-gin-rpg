/**
 * Female v121 makeup mixer. Alters real 13,455-vertex COLOR_0 PBR input and
 * actual eyeliner/brow materials, never a 2D screenshot or CSS overlay.
 * Each preset can be exported in the adjusted GLB.
 */
export const V121_MAKEUP_PRESETS=Object.freeze({
  bare:{label:'すっぴん',blush:0,lip:0,shadow:0,liner:.25,
    lipColor:[.02,.20,.23],shadowColor:[.24,.28,.32],brow:0x79695e,linerColor:0x59413b},
  natural:{label:'ナチュラル',blush:.27,lip:.54,shadow:.21,liner:.50,
    lipColor:[.04,.31,.30],shadowColor:[.26,.29,.34],brow:0x61504b,linerColor:0x422e2b},
  pink:{label:'血色ピンク',blush:.63,lip:.98,shadow:.40,liner:.72,
    lipColor:[.03,.39,.34],shadowColor:[.22,.28,.34],brow:0x574239,linerColor:0x382325},
  brown:{label:'ブラウン',blush:.37,lip:.82,shadow:.79,liner:.96,
    lipColor:[.16,.33,.32],shadowColor:[.43,.37,.29],brow:0x47362e,linerColor:0x291d1d},
  glamorous:{label:'華やか',blush:.78,lip:1.13,shadow:.93,liner:1.12,
    lipColor:[.08,.54,.48],shadowColor:[.29,.31,.37],brow:0x43302a,linerColor:0x241719}
});
const gauss=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const fade=(x,a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const clamp=x=>Math.max(0,Math.min(1,x));

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

  // Respect the face's local model space and the actual lip/eye anatomy.
  const masks=Array.from({length:color.count},(_,i)=>{
    const x=localXYZ[3*i],y=localXYZ[3*i+1],z=localXYZ[3*i+2];
    const ax=Math.abs(x);
    const front=fade(z,.084,.132);
    return {
      blush:(gauss(x,-.074,.033)+gauss(x,.074,.033))*
        gauss(y,.258,.029)*front,
      lip:(.86*gauss(y,.208,.008)+gauss(y,.185,.009))*
        gauss(x,0,.032)*fade(z,.087,.133),
      shadow:(gauss(x,-.044,.026)+gauss(x,.044,.026))*
        gauss(y,.323,.008)*fade(z,.090,.128),
      liner:(gauss(x,-.043,.024)+gauss(x,.043,.024))*
        gauss(y,.304,.003)*fade(z,.085,.127),
      highlighter:gauss(ax,.058,.024)*gauss(y,.272,.024)*front
    };
  });

  let current='pink';
  function select(id){
    const preset=V121_MAKEUP_PRESETS[id];
    if(!preset)throw Error('Unknown v121 makeup preset '+id);
    current=id;
    for(let i=0;i<color.count;i++){
      const m=masks[i], k=i*3;
      // The PBR base texture provides skin grain and skin tone; COLOR_0
      // introduces layerable pigments by physically situated face regions.
      // Stronger than the previous invisible ~2% default makeup.
      const blush=m.blush*preset.blush;
      const lipstick=m.lip*preset.lip;
      const eyes=m.shadow*preset.shadow;
      const upper=m.liner*preset.liner;
      const baseR=clamp(.995-.027*blush-.008*m.highlighter);
      const baseG=clamp(.994-.150*blush-.018*m.highlighter);
      const baseB=clamp(.992-.162*blush-.022*m.highlighter);
      color.array[k]=clamp(baseR-lipstick*preset.lipColor[0]-
        eyes*preset.shadowColor[0]-.055*upper);
      color.array[k+1]=clamp(baseG-lipstick*preset.lipColor[1]-
        eyes*preset.shadowColor[1]-.105*upper);
      color.array[k+2]=clamp(baseB-lipstick*preset.lipColor[2]-
        eyes*preset.shadowColor[2]-.100*upper);
    }
    color.needsUpdate=true;
    for(const part of cosmetic){
      const name=part.name;
      const mat=part.material;
      if(!mat?.color)continue;
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
  select('pink');
  return {select,current:()=>current,isChanged:()=>current!=='bare',
          presets:V121_MAKEUP_PRESETS,originals};
}
