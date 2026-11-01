// Data-driven salon haircut geometry. Coordinates are metres in head-local space.
export const SALON_HAIR_STYLES = Object.freeze({
  long:{label:'ロング',front:.30,side:.48,back:.66,layer:.05},
  semiLong:{label:'セミロング',front:.22,side:.34,back:.43,layer:.06},
  bob:{label:'ボブ',front:.16,side:.22,back:.23,layer:.015},
  short:{label:'ショート',front:.09,side:.095,back:.11,layer:.025},
  pixie:{label:'ベリーショート',front:.045,side:.035,back:.045,layer:.01},
  wolf:{label:'ウルフ',front:.13,side:.14,back:.36,layer:.09},
  mash:{label:'マッシュ',front:.12,side:.13,back:.11,layer:.01},
  centerPart:{label:'センターパート',front:.20,side:.18,back:.13,layer:.04},
  ponytail:{label:'ポニーテール（下ろした状態）',front:.18,side:.48,back:.65,layer:.03},
  layered:{label:'レイヤーロング',front:.20,side:.38,back:.63,layer:.14}
});
const fract=x=>x-Math.floor(x);
export function generateSalonHairData({style='long',count=10000,diameter=.00014,seed=19}={}){
 const cut=SALON_HAIR_STYLES[style]||SALON_HAIR_STYLES.long;
 const strands=[];
 // Golden-angle distribution over scalp cap; long growth is the common starting state.
 for(let i=0;i<count;i++){
  const u=(i+.5)/count, az=i*2.399963229728653+seed;
  const polar=Math.acos(1-u*.92);
  const x=.115*Math.sin(polar)*Math.cos(az),z=.105*Math.sin(polar)*Math.sin(az);
  const y=.135*Math.cos(polar);
  const front=Math.max(0,Math.sin(az)),back=Math.max(0,-Math.sin(az));
  const side=1-front-back;
  const target=front*cut.front+back*cut.back+side*cut.side;
  const noise=(fract(Math.sin((i+seed)*127.1)*43758.5453)-.5);
  const layer=cut.layer*(fract(i*.61803398875)-.5);
  const length=Math.max(.012,Math.min(.72,target+layer+noise*.012));
  strands.push({root:[x,y,z],initialLength:.72,length,diameter,cutAmount:.72-length,azimuth:az});
 }
 return {style,count,diameter,strands};
}
export function trimSalonHair(data,style){
 const replacement=generateSalonHairData({style,count:data.count,diameter:data.diameter});
 replacement.strands.forEach((s,i)=>{s.length=Math.min(data.strands[i].length,s.length);s.cutAmount=s.initialLength-s.length;});
 return replacement;
}
