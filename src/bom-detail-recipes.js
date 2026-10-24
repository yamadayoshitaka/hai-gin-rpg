/** Optional high-detail BOM subassemblies. No engine-specific code or object switch. */
const p=(partId,x,y,z,material)=>({partId,position:[x,y,z],...(material?{material}:{})});
export const BOM_DETAIL_RECIPES=Object.freeze({
 table_low:[p('rail',0,.83,-1.1),p('rail',0,.83,1.1),p('goblet',.7,1.29,-.3),p('plate',-.7,1.26,.35)],
 desk:[p('rail',0,1.08,-.75),p('book',-.35,1.58,0),p('book',-.13,1.58,0),p('goblet',1,1.55,-.2)],
 chair_A_wood:[p('rail',0,1.35,-.48)],
 bed_single_A:[p('pillow',-1.02,1.03,-.45),p('pillow',.13,1.03,-.45),p('mattress',0,.78,0),p('headboard',0,1.22,-1.25),p('headboard',0,.82,1.25)],
 shelf_A_big:[...[-1.2,-.93,-.66,-.39,-.12,.15,.42,.69,.96].map((x,i)=>p('book',x,1.8,-.15,i%3===0?'royal':'linen')),
   ...[-1.0,-.72,-.44,-.16,.12,.40,.68,.96].map((x,i)=>p('book',x,2.65,-.2,i%3===0?'royal':'oak'))],
 counter:[p('rail',0,1.58,.86),p('goblet',-1.3,1.64,0),p('coin',1.1,1.59,0),p('coin',1.34,1.59,0)],
 chest:[p('rivet',-.75,.55,.63),p('rivet',[.75][0],.55,.63),p('handle',0,.65,.62)],
 throne:[p('crest',0,3.5,-.88),p('rivet',-1.4,1.4,-.2),p('rivet',1.4,1.4,-.2),p('royal-cushion',0,.9,0)],
 'weapon-rack':[...[-1.1,0,1.1].map(x=>p('blade',x,1.9,.38)),p('shield',1.5,1.65,.2)],
 'armor-stand':[p('armor-torso',0,1.9,0),p('shield',1.12,1.35,.10)],
 'lamp_standing':[p('lamp-cage',0,3.14,0),p('rivet',0,3.5,.33)],
 piano:[...Array.from({length:13},(_,i)=>p('piano-key',-1.8+i*.3,1.14,1.12,i%2?'oak':'linen'))],
 'window-ornament':[p('rail',0,0,.12)],
 'door-ornament':[p('handle',.55,1.35,.2)],
 'shop-ornament':[p('crest',0,.4,.13)],
 banner:[p('crest',0,2.85,.12)],
 'king':[p('crest',0,3.55,.12)],
 'guard':[p('shield',.75,1.5,.08)],
 'altar':[p('goblet',-.7,1.7,0),p('goblet',.7,1.7,0)]
});
