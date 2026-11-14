/**
 * m006-specific Panthera-style sculpture. This is a fictional black panther,
 * using feline shoulder and digit biomechanics as analogues, not a copy of a
 * reference mesh. The existing 50-species surface rig remains untouched.
 */
export function addPantherArticulation(g,{head,torso}={}){
 if(!head?.isGroup||!torso?.isGroup)throw Error('m006 panther requires real skull and ribcage pivots');
 const root=g.root,p=g.pivots;
 const lumbar=g.group('paraspinal',[0,1.32,-.35],torso);
 g.bridge(lumbar,'skin',[0,.022,.22],[0,-.015,-.27],.31,.25);
 for(const side of [-1,1]){
   const suffix=side<0?'L':'R';
   g.sphere(lumbar,'skin',[side*.216,.018,-.055],
     [.093,.112,.244],{name:'m006-lumbar-multifidus'});
   const scapula=g.group('scapula'+suffix,
     [side*.322,1.45,.265],torso);
   g.bridge(scapula,'skin',[0,-.17,-.13],
     [side*.038,.174,.105],.143,.078);
   g.sphere(scapula,'light',[side*.018,.035,-.018],
     [.117,.194,.18],{name:'m006-mobile-scapular-muscle'});
   g.tube(scapula,'skin',[[side*.012,.155,-.105],
     [side*.041,.035,-.011],[side*.018,-.135,.115]],.021);
   // Black panther: pronounced zygomatic arch, thick jaw adductors and
   // a narrow nasal bridge, integrated into the pre-existing organic head.
   g.bridge(head,'skin',[side*.176,-.025,-.070],
     [side*.258,-.116,.18],.128,.083);
   g.sphere(head,'skin',[side*.215,-.082,.054],
     [.112,.143,.169],{name:'m006-masseter'});
   g.tube(head,'light',[[side*.172,.092,-.08],
     [side*.278,.100,.052],[side*.292,.073,.212]],.024);
   g.sphere(head,'shadow',[side*.117,-.173,.535],
     [.027,.019,.018],{name:'m006-nostril'});
   g.sphere(head,'skin',[side*.267,.162,.223],
     [.069,.019,.083],{name:'m006-supraorbital-ridge'});
   // Buried whisker follicles, no long unnatural spikes near the pupils.
   for(let i=0;i<4;i++)
     g.sphere(head,'shadow',
       [side*(.124+i*.013),-.195,.40+i*.024],
       [.005,.006,.006],{name:'m006-vibrissa-follicle'});
 }
 g.bridge(head,'skin',[0,.086,-.13],[0,-.109,.350],.178,.108);
 g.sphere(head,'shadow',[0,-.172,.530],
   [.119,.043,.073],{name:'m006-rhinarium'});
 // The rigid original paw is omitted for m006 in quadruped(). Its
 // replacement follows a wrist and a digital joint, with four flexible
 // claws based on the distal phalanx rather than glued static cones.
 for(const name of ['frontL','frontR','rearL','rearR']){
   const lower=p['lower'+name];
   if(!lower?.isGroup)throw Error('Missing distal feline limb '+name);
   const wrist=g.group('wrist'+name,[0,-.245,.025],lower);
   g.bridge(wrist,'skin',[0,.086,-.045],[0,-.165,.075],.12,.078);
   g.sphere(wrist,'shadow',[0,.005,0],[.105,.085,.104],
     {name:'m006-carpal-tarsal-cushion'});
   const paw=g.group('paw'+name,[0,-.235,.108],wrist);
   g.sphere(paw,'shadow',[0,-.030,.034],[.158,.066,.162],
     {name:'m006-metapodial-pad'});
   for(let digit=0;digit<4;digit++){
     const x=(digit-1.5)*.072;
     g.sphere(paw,'skin',[x,-.038,.113],[.042,.047,.083],
       {name:'m006-digit'});
     const nail=g.group('claw'+name+digit,[x,-.056,.177],paw);
     const rooted=g.rootedSpike(nail,'bone','skin',[0,0,0],
       [0,-.052,.101],.024,
       {name:'rooted-claw-m006-'+name+'-'+digit});
     // Retain the visible fang class while giving the socket the
     // rooted-claw-* contract used by all other feline/canine rigs.
     if(rooted?.tooth)rooted.tooth.name='m006-retractile-claw';
   }
 }
 const tail=p.tail;
 const caudal=g.group('caudalMuscle',[0,0,-.082],tail);
 g.sphere(caudal,'skin',[0,.025,-.042],[.13,.107,.19],
   {name:'m006-tail-base-muscle'});
 return root;
}
