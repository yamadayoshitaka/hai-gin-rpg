/**
 * The Blood Moon vampire's human-derived morphology. Independent sculpt
 * from hero/NPC models. No shared facial asset edits or fluorescent eyes.
 * The profile deliberately favors believable cadaver anatomy, dark velvet,
 * fine natural hair and two subtle canine teeth over anime silhouettes.
 */
export function sculptBloodMoonVampire(g,head,torso,{detail='high'}={}){
 const full=detail!=='low';
 // Partial hair cap only covers the crown. The forehead, eyes, cheeks and
 // jaw remain visible, and the scalp never looks like a hovering wig base.
 g.anatomicalLoft(head,'hair',[
  {y:.121,rx:.179,rz:.154,cz:-.110},
  {y:.175,rx:.221,rz:.185,cz:-.072},
  {y:.244,rx:.222,rz:.184,cz:-.063},
  {y:.319,rx:.157,rz:.153,cz:-.044},
  {y:.365,rx:.016,rz:.021,cz:-.042},
 ],{kind:'face',name:'m034-rooted-hair-cap',asymmetry:.06});

 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  // Skin-colored orbital ridge is attached to the skull. Eyes sit slightly
  // behind the lid aperture, never bulging above the facial surface.
  g.sphere(head,'shadow',[side*.129,.057,.206],
    [.094,.056,.018],{rough:.91,name:'m034-orbit-'+suffix});
  g.sphere(head,'eye',[side*.130,.054,.219],
    [.043,.026,.011],{rough:.32,name:'m034-iris-'+suffix});
  g.sphere(head,'shadow',[side*.132,.053,.229],
    [.014,.024,.008],{rough:.36,name:'m034-pupil-'+suffix});
  g.tube(head,'mortalSkin',[
    [side*.057,.105,.227],[side*.130,.118,.219],
    [side*.200,.088,.188]],.021);
  g.tube(head,'mortalSkin',[
    [side*.075,.004,.231],[side*.133,-.005,.225],
    [side*.193,.012,.188]],.012);
  // One believable ear attached behind the jaw line; not an elf spike.
  g.sphere(head,'mortalSkin',[side*.246,-.064,-.015],
    [.049,.091,.041],{rough:.91,name:'m034-ear-'+suffix});
  g.sphere(head,'shadow',[side*.273,-.064,.014],
    [.013,.040,.014],{rough:.94});
  // Back-swept strands follow skull and temple, no enormous paper sheets.
  if(full)for(let i=0;i<5;i++){
    const f=i/4;
    g.tube(head,i%3===0?'leather':'hair',[
      [side*(.075+f*.122),.320-f*.032,-.110-f*.033],
      [side*(.128+f*.119),.222-f*.068,-.142-f*.016],
      [side*(.145+f*.104),.028-f*.105,-.159-f*.045],
    ],.009+(i%2)*.004);
  }
  // Cadaveric nasolabial groove and shallow, sharply modeled cheek.
  if(full)g.tube(head,'shadow',[
    [side*.085,-.096,.237],[side*.118,-.139,.222],
    [side*.147,-.171,.200]],.0058);
 }
 // Cartilaginous bridge, alar wings, nostrils and philtrum; do not build
 // a giant protruding cone like the old generic monster mouth.
 g.bridge(head,'mortalSkin',[0,.072,.224],
   [0,-.113,.294],.038,.026);
 for(const side of [-1,1]){
  g.sphere(head,'mortalSkin',[side*.035,-.113,.273],
    [.035,.022,.025],{name:'m034-alar-cartilage'});
  g.sphere(head,'shadow',[side*.036,-.128,.291],
    [.016,.007,.009],{name:'m034-nostril'});
 }
 g.tube(head,'shadow',[[-.108,-.193,.228],
  [-.052,-.200,.251],[0,-.198,.264],[.056,-.200,.251],
  [.106,-.190,.225]],.007);
 g.tube(head,'mortalSkin',[[-.096,-.202,.235],
  [-.044,-.225,.241],[0,-.229,.249],[.043,-.226,.241],
  [.095,-.200,.234]],.016);
 // The fangs are just long human upper canines, not protruding tusks.
 for(const side of [-1,1]){
  g.spike(head,'bone',[side*.070,-.202,.244],
    [side*.075,-.250,.250],.010);
 }
 // Burgundy-black tailored coat with visible collar seams and weathered
 // cloak panels. Different physical material from his pale face.
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  g.fin(torso,'fabric',[side*.275,1.87,-.13],
    [side*.48,.85,-.32],.23);
  g.fin(torso,'fabric',[side*.325,1.69,-.24],
    [side*.54,.70,-.34],.19);
  g.fin(torso,'leather',[side*.245,1.86,.225],
    [side*.125,1.42,.275],.115);
  g.tube(torso,'fabric',[
    [side*.225,1.85,.217],[side*.174,1.66,.269],
    [side*.085,1.47,.273]],.024);
  if(full)g.tube(torso,'leather',[
    [side*.310,1.71,-.10],
    [side*.385,1.32,-.18],
    [side*.395,.89,-.19]],.010);
  // Slight asymmetry and gravity crease at the trailing hem.
  if(full)g.fin(torso,'fabric',
    [side*.38,1.17,-.21],
    [side*.46,.76,-.40],.12);
 }
 g.sphere(torso,'leather',[0,1.40,.273],
   [.106,.28,.033],{name:'m034-vest-front'});
 for(let i=0;i<4;i++)
  g.sphere(torso,'metal',[0,1.60-i*.126,.304],
    [.015,.014,.009],{metal:.72,rough:.49,name:'m034-coat-button'});
}
export function sculptVampireHand(g,elbow,side,{detail='high'}={}){
 const suffix=side<0?'L':'R';
 g.sphere(elbow,'mortalSkin',[side*.047,-.322,.073],
   [.105,.095,.092],{rough:.83,name:'m034-hand-'+suffix});
 const count=detail==='low'?3:4;
 for(let digit=0;digit<count;digit++){
  const x=side*.051+(digit-(count-1)/2)*.037;
  const from=[x,-.375,.146],to=[
    x+(digit-(count-1)/2)*.009,-.494+(digit===0?.03:0),.169];
  g.bone(elbow,'mortalSkin',from,to,.023,
    {tipRadius:.014,rough:.87});
  g.sphere(elbow,'bone',to,[.014,.010,.012],
    {rough:.83,name:'m034-fingernail'});
 }
}
