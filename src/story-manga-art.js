/**
 * Original comic-page artwork: twenty persistent illustrated 2D character
 * designs with eyes, noses, expressions, clothing, armor, hair and heraldry.
 * A panel is composed from its story scene, not a generic castle backdrop.
 * Fully offline SVG; can be replaced with final character concept art later.
 */
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
const identities=Object.freeze([
 // skin, hair, cloak, garment, eye, form
 ['#edc0a4','#af9bce','#d7cde5','#476183','#5966a6','regal'],
 ['#d5a58e','#d7d2be','#605343','#65717c','#515456','armor'],
 ['#f0bd9f','#6b392d','#f7e6cd','#568b78','#5b9e7d','healer'],
 ['#f1b9a7','#29303f','#405468','#364456','#647da8','hood'],
 ['#dcac8c','#6b4133','#896d58','#546570','#977553','thief'],
 ['#e3aa8e','#3b2b27','#a9574a','#515566','#915943','armor'],
 ['#ecc5a4','#ce985a','#d8b47c','#58748b','#8f7a51','engineer'],
 ['#ebc1a5','#634e39','#d4c1a7','#635d66','#638a88','scribe'],
 ['#edbb9e','#654534','#d1a19b','#8c6664','#7f8e9d','child'],
 ['#e6b594','#7e6250','#456b54','#596c46','#598b65','ranger'],
 ['#d6a082','#3e262a','#a24a42','#515b65','#ac6957','armor'],
 ['#dcb4a2','#d2b4a2','#952e39','#a16a4e','#734a56','crown'],
 ['#edc1af','#542d3a','#c6929a','#633651','#9c717e','regal'],
 ['#ca967e','#4c3537','#51374c','#47364d','#658080','scribe'],
 ['#cb967b','#312e35','#6a4542','#5b5865','#72727b','heavy'],
 ['#efcfaa','#e6dcc0','#577c63','#578f80','#4fba9f','crown'],
 ['#ddb89b','#474c59','#3e738c','#446779','#628ca8','ranger'],
 ['#edd1ae','#76747b','#485977','#4d4664','#b2b1be','hood'],
 ['#edd2bd','#f7ede5','#8277a8','#8077aa','#9ac6d2','mystic'],
 ['#cda492','#292c37','#413b4e','#39394a','#d3ac61','scribe']
]);
export const MANGA_VISUAL_CHARACTERS=Object.freeze(Object.fromEntries(STORY_KEY_PEOPLE.map((p,i)=>[p.id,Object.freeze({
 id:p.id,name:p.name,index:i,skin:identities[i][0],hair:identities[i][1],
 cloak:identities[i][2],garment:identities[i][3],eyes:identities[i][4],
 costume:identities[i][5],faction:p.faction
})])));
export const MANGA_BACKGROUND_CLASSES=Object.freeze(['royal-town','wilds','frontier','refuge','fortress','starbell']);
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const palette={
 '灰銀':['#345d79','#e6cf9e'],'紅炎':['#823e44','#deb889'],
 '翠嵐':['#3a7356','#b7d5aa'],'鐘守':['#7063a1','#d5cdf0'],
 '記録院':['#51516a','#c8b9a1'],'星鐘':['#7063a1','#d5cdf0']
};
function scenerySvg(scene){
 const style=scene.scenery||'wilds',seed=scene.artSeed||4,night=scene.mood==='mystery';
 const sky=night?['#191b39','#5d5c83']:['#314962','#b8a88b'];
 const sunX=640+(seed%90),sunY=105+(seed%65);
 let decor='';
 if(style==='wilds'||style==='refuge'){
  decor=Array.from({length:13},(_,i)=>{
   const x=i*78-35+(seed%28),y=300+(i%4)*18;
   return '<g stroke="#1a302b" stroke-width="8" fill="#355b4c" opacity=".78"><path d="M'+x+' 470V'+y+'"/><path d="M'+(x-30)+' '+(y+32)+'Q'+x+' '+(y-106)+' '+(x+40)+' '+(y+32)+'Z"/></g>';
  }).join('');
 }else if(style==='royal-town'||style==='fortress'){
  decor=Array.from({length:6},(_,i)=>{
   const x=i*170-30,h=150+(i*61+seed)%90;
   return '<g fill="#344155" stroke="#b0a38f" stroke-width="3"><rect x="'+x+'" y="'+(405-h)+'" width="146" height="'+(h+110)+'"/><path d="M'+(x-13)+' '+(405-h)+'l87 -80 87 80Z"/><rect x="'+(x+54)+'" y="'+(430-h)+'" width="29" height="46" fill="#edc78a"/></g>';
  }).join('');
 }else if(style==='starbell'){
  decor='<circle cx="485" cy="210" r="138" fill="none" stroke="#d2c2fa" stroke-width="13"/><circle cx="485" cy="210" r="110" fill="none" stroke="#c8b5e8" stroke-width="3"/>'+
  '<path d="M485 65v230M375 200h220M422 112l126 195M550 105L422 315" stroke="#b9a8df" stroke-width="4"/>';
 }else{
  decor='<path d="M0 438H970M0 466H970" stroke="#ddd2b6" stroke-width="12" opacity=".42"/>'+
  Array.from({length:5},(_,i)=>'<path d="M'+(i*205)+' 480l75 -210 95 210" fill="#454c5a" stroke="#afaa96" stroke-width="8"/>').join('');
 }
 return '<rect width="960" height="540" fill="'+sky[0]+'"/>'+
 '<path d="M0 190 Q320 40 960 205V540H0" fill="'+sky[1]+'" opacity=".75"/>'+
 '<circle cx="'+sunX+'" cy="'+sunY+'" r="68" fill="#ffe9b0" opacity=".36"/>'+
 '<path d="M0 345l112 -78 98 61 160 -115 100 91 167 -127 157 127 166 -67v303H0Z" fill="#283e53" opacity=".66"/>'+
 decor+'<path d="M0 455Q280 412 500 465T960 442V540H0Z" fill="#292f3a" opacity=".78"/>';
}
function portraitSvg(character,x,scale,expression='determined',mirror=false){
 const p=MANGA_VISUAL_CHARACTERS[character];
 if(!p)return '';
 const side=mirror?-1:1;
 const mouth=expression==='sorrowful'?'M-16 2Q0 -12 16 2':
  expression==='angry'?'M-15 0L15 3':
  expression==='hopeful'?'M-19 -2Q0 13 19 -2':'M-14 0Q0 6 14 0';
 const brow=expression==='angry'?'M-45 -42l30 9M14 -33l33 -9':
  expression==='anxious'?'M-45 -47l30 -4M14 -50l33 3':'M-45 -45l30 -2M14 -47l33 2';
 const longHair=['regal','healer','hood','crown','mystic'].includes(p.costume);
 const hat=p.costume==='hood'?
  '<path d="M-100 -58Q-96 -160 0 -184Q99 -162 101 -58L80 26 -70 26Z" fill="'+p.cloak+'" stroke="#121724" stroke-width="8"/>':
  p.costume==='crown'?
  '<path d="M-79 -133L-90 -202 -41 -172 0 -222 42 -172 92 -200 76 -133Z" fill="#e5bf66" stroke="#4e353d" stroke-width="7"/><g fill="#9bc9db"><circle cx="0" cy="-177" r="9"/><circle cx="-48" cy="-156" r="7"/><circle cx="48" cy="-156" r="7"/></g>':'';
 const outfit=p.costume==='armor'||p.costume==='heavy'?
  '<path d="M-90 82l-60 36 -22 150h346l-25 -147 -60 -39 -35 45h-108Z" fill="'+p.garment+'" stroke="#141927" stroke-width="10"/>'+
  '<path d="M-98 112l-52 16 -20 70 62 28 51 -71Z M98 112l50 16 20 70 -62 28 -50 -71Z" fill="#8d919b" stroke="#242936" stroke-width="9"/>'+
  '<path d="M-58 127h116l-9 119H-51Z" fill="#b2aba2" stroke="#31363e" stroke-width="7"/>':
  '<path d="M-96 86Q-154 120 -170 290H170Q157 126 96 86L47 112 -48 112Z" fill="'+p.cloak+'" stroke="#18202c" stroke-width="10"/>'+
  '<path d="M-75 124l-25 166h200L75 124Q0 147 -75 124Z" fill="'+p.garment+'" stroke="#34303f" stroke-width="7"/>';
 const hairSides=longHair?
  '<path d="M-86 -99Q-127 -35 -125 138L-84 142 -69 -21Z M86 -99Q127 -35 125 138L84 142 69 -21Z" fill="'+p.hair+'" stroke="#131822" stroke-width="7"/>':'';
 const longBangs=(p.index%4)===0;
 const bangs=longBangs?
  '<path d="M-96 -109Q-49 -194 42 -165Q-18 -112 -62 -73Q15 -105 90 -105L72 -156Q10 -211 -71 -166Z"':
  '<path d="M-93 -116Q-65 -183 5 -182Q79 -181 91 -108L72 -96 -32 -136 -85 -85Z"';
 const face='<path d="M-82 -117Q-98 -70 -80 4Q-51 75 -1 83Q49 72 80 4Q99 -70 79 -116Q20 -163 -82 -117Z" fill="'+p.skin+'" stroke="#1b2029" stroke-width="8"/>'+
  '<path d="M-69 -63Q-48 -80 -20 -62M23 -62Q49 -79 70 -61" fill="none" stroke="#71544d" stroke-width="5"/>'+
  '<g fill="#f7f5ef" stroke="#25242d" stroke-width="5"><path d="M-66 -38Q-39 -63 -11 -40Q-38 -14 -66 -38Z"/><path d="M13 -40Q41 -64 68 -38Q40 -15 13 -40Z"/></g>'+
  '<g fill="'+p.eyes+'" stroke="#1d2331" stroke-width="4"><ellipse cx="-39" cy="-38" rx="12" ry="16"/><ellipse cx="40" cy="-38" rx="12" ry="16"/></g>'+
  '<circle cx="-35" cy="-44" r="4" fill="#fff"/><circle cx="44" cy="-44" r="4" fill="#fff"/>'+
  '<path d="M-3 -34l-5 42 13 0" fill="none" stroke="#906b5e" stroke-width="5"/>'+
  '<path d="'+mouth+'" fill="none" stroke="#844e50" stroke-width="5" stroke-linecap="round"/>'+
  '<path d="'+brow+'" stroke="#3c3236" stroke-width="8" fill="none" stroke-linecap="round"/>';
 const hair=hairSides+'<path d="M-95 -119Q-56 -202 20 -184Q97 -183 95 -110L84 -71 52 -107 -18 -123 -73 -66Z" fill="'+p.hair+'" stroke="#131822" stroke-width="8"/>'+
 bangs+' fill="'+p.hair+'" stroke="#131822" stroke-width="7"/>';
 const insignia='<path d="M-17 198l17 -34 17 34 -17 20Z" fill="'+(palette[p.faction]||palette['灰銀'])[1]+'" stroke="#22263a" stroke-width="4"/>';
 const marks=p.index===1||p.index===10?
 '<path d="M43 -13l23 33" stroke="#9a5c56" stroke-width="4"/>':
 p.index===18?'<path d="M-80 -95l-24 -24M82 -96l24 -24" stroke="#e7dfff" stroke-width="5"/>':'';
 return '<g transform="translate('+x+' 240) scale('+(side*scale)+' '+scale+')" stroke-linejoin="round">'+
 '<path d="M-120 91Q-180 170 -204 314H210Q182 162 109 91Z" fill="'+p.cloak+'" stroke="#101a28" stroke-width="10"/>'+
 outfit+'<path d="M-39 65v52H40V65" fill="'+p.skin+'" stroke="#1b2029" stroke-width="8"/>'+
 hat+face+hair+marks+insignia+'</g>';
}
export function stageMangaSvg(panel){
 if(!panel||!panel.stageId)throw Error('Manga artwork requires a stage panel');
 const pp=panel.index||0,seed=panel.artSeed||1;
 const primary=panel.characterId,secondary=panel.secondaryId;
 // Seven continuity shots: establishing → portraits → discovery →
 // confrontation → resolution → link to the next stage.
 const two=Boolean(primary&&secondary)&&[0,3,4,5,6].includes(pp);
 const mirror=pp%2===1;
 const people=two?
  portraitSvg(primary,275,1.06,panel.expression,mirror)+
  portraitSvg(secondary,715,.93,pp===4?'angry':'thoughtful',!mirror):
  portraitSvg(primary||secondary,pp%2?590:360,1.35,panel.expression,mirror);
 const compositionalInk=pp===4?
  Array.from({length:17},(_,i)=>'<path d="M'+(i*57)+' 0L'+(550+i*29)+' 540" stroke="#fff1d0" opacity=".22" stroke-width="5"/>').join(''):
  pp===3?'<circle cx="484" cy="245" r="153" fill="none" stroke="#e4ddca" stroke-width="9" opacity=".3"/>':'';
 const stripes='<path d="M0 470Q480 441 960 480" fill="none" stroke="#d1c19d" stroke-width="3" opacity=".5"/>';
 const numbers='<text x="29" y="46" fill="#f1e0b9" font-size="19" font-family="serif" letter-spacing="3">CH.'+
  String(panel.chapter).padStart(2,'0')+'  //  STAGE '+String(panel.slot).padStart(2,'0')+
  '  //  '+String(pp+1).padStart(2,'0')+'</text>';
 const peopleNames=[primary,secondary].filter(Boolean).map(id=>MANGA_VISUAL_CHARACTERS[id]?.name).filter(Boolean);
 const cast='<text x="28" y="504" fill="#f3dfbd" font-size="24" font-family="sans-serif" letter-spacing="2">'+xml(peopleNames.join('  /  ')||'星鐘の物語')+'</text>';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="'+xml(peopleNames.join('と')+'が登場する第'+panel.chapter+'章の漫画')+'">'+
 '<defs><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="'+(seed%99)+'"/></filter></defs>'+
 scenerySvg(panel)+compositionalInk+people+stripes+
 '<rect x="10" y="10" width="940" height="520" fill="none" stroke="#f2dec0" stroke-width="12"/>'+
 '<path d="M18 475H942V522H18Z" fill="#101b2bdc"/>'+numbers+cast+
 '<rect width="960" height="540" filter="url(#paper)" opacity=".065"/>'+
 '</svg>';
}
export function stageMangaImage(panel){
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(stageMangaSvg(panel));
}
