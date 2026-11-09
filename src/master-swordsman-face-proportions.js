/**
 * Measured, reversible facial proportions for the real Blender Studio
 * inspection head. The source GLB stays unchanged; these values deform only
 * an owned preview geometry. NOT a photoreal art-quality certification.
 */
export const FACE_PROPORTION_FIELDS=Object.freeze([
 // key, Japanese label, minimum, maximum, neutral, group
 ['faceHeight','顔の縦長',.78,1.22,1,'顔・3等分'],
 ['upperThird','上顔面（生え際→眉）',.65,1.35,1,'顔・3等分'],
 ['middleThird','中顔面（眉→鼻下）',.65,1.35,1,'顔・3等分'],
 ['lowerThird','下顔面（鼻下→顎）',.65,1.35,1,'顔・3等分'],
 ['jawTaper','顎と輪郭の細さ',.62,1.35,1,'顔・3等分'],
 ['cheekRoundness','頬・輪郭の丸み',.70,1.65,1,'顔・3等分'],
 ['chinLength','顎先の長さ',.65,1.35,1,'顔・3等分'],
 ['eyeWidth','目の横幅',.65,1.55,1,'目'],
 ['eyeHeight','目の縦幅',.60,1.50,1,'目'],
 ['eyeSpacing','左右の目の間隔',.78,1.25,1,'目'],
 ['eyeVertical','目の上下位置',-.045,.045,0,'目'],
 ['eyeTilt','目尻の角度',-.22,.22,0,'目'],
 ['browVertical','眉の上下位置',-.04,.04,0,'眉'],
 ['browEyeGap','眉と目の距離',.70,1.35,1,'眉'],
 ['browAngle','眉の角度',-.20,.20,0,'眉'],
 ['browWidth','眉の長さ',.78,1.20,1,'眉'],
 ['browThickness','眉の太さ',.65,1.35,1,'眉'],
 ['noseLength','鼻の長さ',.55,1.50,1,'鼻'],
 ['noseOverall','鼻全体の大きさ',.55,1.50,1,'鼻'],
 ['noseWidth','鼻の幅',.45,1.55,1,'鼻'],
 ['noseBridge','鼻筋の高さ',.45,1.55,1,'鼻'],
 ['noseTip','鼻先の大きさ',.45,1.55,1,'鼻'],
 ['mouthWidth','口の幅',.45,1.55,1,'口'],
 ['mouthHeight','口の縦幅',.60,1.50,1,'口'],
 ['mouthVertical','口の上下位置',-.04,.04,0,'口'],
 ['lipFullness','唇の厚み',.45,1.55,1,'口'],
 ['mouthCorner','口角',-.020,.020,0,'口']
 // X is mirrored from the facial centre for left/right eyes. All offsets
 // are in METRES in head-local coordinates (not percent of screen pixels).
 // Keep the default zero so published legacy presets remain stable.
 // Separate group: these are *placement* controls, not shape morphs.
 ,['eyeOffsetX','眼球 X 左右',-.012,.012,0,'位置XYZ']
 ,['eyeOffsetY','眼球 Y 上下',-.012,.012,0,'位置XYZ']
 ,['eyeOffsetZ','眼球 Z 前後',-.010,.010,0,'位置XYZ']
 ,['irisOffsetX','虹彩 X 左右',-.006,.006,0,'位置XYZ']
 ,['irisOffsetY','虹彩 Y 上下',-.006,.006,0,'位置XYZ']
 ,['irisOffsetZ','虹彩 Z 前後',-.005,.005,0,'位置XYZ']
 ,['pupilOffsetX','瞳孔 X 左右',-.003,.003,0,'位置XYZ']
 ,['pupilOffsetY','瞳孔 Y 上下',-.003,.003,0,'位置XYZ']
 ,['pupilOffsetZ','瞳孔 Z 前後',-.002,.003,0,'位置XYZ']
 ,['upperLidOffsetX','上まぶた X 左右',-.008,.008,0,'位置XYZ']
 ,['upperLidOffsetY','上まぶた Y 上下',-.008,.008,0,'位置XYZ']
 ,['upperLidOffsetZ','上まぶた Z 前後',-.006,.006,0,'位置XYZ']
 ,['lowerLidOffsetX','下まぶた X 左右',-.008,.008,0,'位置XYZ']
 ,['lowerLidOffsetY','下まぶた Y 上下',-.008,.008,0,'位置XYZ']
 ,['lowerLidOffsetZ','下まぶた Z 前後',-.006,.006,0,'位置XYZ']
 ,['browOffsetX','眉 X 左右',-.012,.012,0,'位置XYZ']
 ,['browOffsetY','眉 Y 上下',-.012,.012,0,'位置XYZ']
 ,['browOffsetZ','眉 Z 前後',-.009,.009,0,'位置XYZ']
]);
export const FACE_XYZ_FIELDS=Object.freeze(FACE_PROPORTION_FIELDS.filter(field=>field[5]==='位置XYZ'));
export const FACE_PROPORTION_DEFAULTS=Object.freeze(Object.fromEntries(
 FACE_PROPORTION_FIELDS.map(([key,,,,neutral])=>[key,neutral])
));
const SPECS=Object.fromEntries(FACE_PROPORTION_FIELDS.map(([key,,min,max])=>[key,{min,max}]));
const bell=(v,center,width)=>Math.exp(-.5*((v-center)/width)**2);
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
export function validateFaceProportions(input={},base=FACE_PROPORTION_DEFAULTS){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Face proportions must be an object');
 const unknown=Object.keys(input).filter(k=>!SPECS[k]);
 if(unknown.length)throw Error('Unknown face proportion: '+unknown.join(', '));
 const result={...FACE_PROPORTION_DEFAULTS,...base};
 for(const [key,value] of Object.entries(input)){
  if(typeof value!=='number'||!Number.isFinite(value)||
     value<SPECS[key].min||value>SPECS[key].max)
   throw RangeError('Face proportion out of range: '+key);
  result[key]=Number(value.toFixed(4));
 }
 return Object.freeze(result);
}
/**
 * Three vertical face thirds, mapped continuously, with chin and hairline
 * anchors fixed. Values are ratios, not independent displacements.
 */
export function warpFaceThirds(y,p=FACE_PROPORTION_DEFAULTS){
 const chin=.12,noseBase=.38,brow=.70,hairline=.93;
 if(y<=chin||y>=hairline)return y;
 const lengths=[noseBase-chin,brow-noseBase,hairline-brow];
 const weights=[p.lowerThird??1,p.middleThird??1,p.upperThird??1];
 const total=lengths.reduce((v,n,i)=>v+n*weights[i],0);
 const scaled=lengths.map((n,i)=>n*weights[i]*(hairline-chin)/total);
 const from=[chin,noseBase,brow,hairline];
 const to=[chin,chin+scaled[0],chin+scaled[0]+scaled[1],hairline];
 let mapped=y;
 for(let i=0;i<3;i++){
  if(y<=from[i+1]){mapped=to[i]+(y-from[i])*scaled[i]/lengths[i];break}
 }
 // Face height is centered around the nose/cheek zone and feathered at
 // top and bottom so the face does not detach from the hair/neck.
 const fade=smooth(chin,chin+.095,y)*(1-smooth(hairline-.09,hairline,y));
 return mapped+(mapped-.52)*((p.faceHeight??1)-1)*fade;
}
/** Pure deformation used by runtime and geometry regression tests. */
export function deformFacePoint(x,y,z,box,p=FACE_PROPORTION_DEFAULTS){
 const width=Math.max(.001,box.max.x-box.min.x);
 const height=Math.max(.001,box.max.y-box.min.y);
 const depth=Math.max(.001,box.max.z-box.min.z);
 const cx=(box.max.x+box.min.x)*.5;
 const xn=(x-cx)/(width*.5);
 const yn=(y-box.min.y)/height;
 const zn=(z-box.min.z)/depth;
 const front=smooth(.42,.74,zn);
 const low=smooth(.60,.20,yn);
 const mouth=bell(xn,0,.43)*bell(yn,.40,.070)*front;
 const nose=bell(xn,0,.29)*bell(yn,.58,.14)*front;
 const noseTip=bell(xn,0,.24)*bell(yn,.52,.072)*front;
 const eye=bell(Math.abs(xn),.40,.30)*bell(yn,.745,.090)*front;
 const brow=bell(Math.abs(xn),.43,.30)*bell(yn,.80,.055)*front;
 const cheek=bell(Math.abs(xn),.57,.37)*bell(yn,.50,.19)*front;
 let xx=x;
 xx+=(x-cx)*((p.jawTaper??1)-1)*low*.74;
 xx+=(x-cx)*((p.cheekRoundness??1)-1)*cheek*.34;
 xx+=(x-cx)*((p.mouthWidth??1)-1)*mouth*.74;
 xx+=(x-cx)*((p.noseWidth??1)-1)*nose*.80;
 xx+=(x-cx)*((p.noseOverall??1)-1)*nose*.56;
 xx+=(x-cx)*((p.noseTip??1)-1)*noseTip*.30;
 const eyeX=Math.sign(xn)*(p.eyeSpacing-1)*width*.12;
 xx+=eyeX*eye;
 let yy=box.min.y+warpFaceThirds(yn,p)*height;
 yy+=height*mouth*(p.mouthVertical??0);
 yy+=(y-(box.min.y+height*.40))*mouth*((p.mouthHeight??1)-1)*.72;
 yy+=(y-(box.min.y+height*.58))*nose*((p.noseOverall??1)-1)*.38;
 yy+=height*noseTip*(p.noseLength-1)*-.055;
 yy+=height*low*bell(xn,0,.5)*(p.chinLength-1)*-.037;
 yy+=height*eye*(p.eyeVertical??0)*.7;
 yy+=height*brow*((p.browVertical??0)+(p.browEyeGap-1)*.015);
 yy+=height*mouth*(p.mouthCorner??0)*Math.abs(xn)*.9;
 const zz=z+depth*(cheek*((p.cheekRoundness??1)-1)*.085+
  nose*(p.noseBridge-1)*.046+
  nose*((p.noseOverall??1)-1)*.055+
  noseTip*(p.noseTip-1)*.025+
  mouth*(p.lipFullness-1)*.041);
 return {x:xx,y:yy,z:zz};
}
