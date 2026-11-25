"""Named male study adaptation of verified mob stages; never changes source or release gate."""
import sys
from pathlib import Path
STAGES={'wig':'r53-mob-wig-fit.py','motion':'r53-mob-motion.py','fit':'r53-garment-fit.py','refine':'r53-garment-refine.py','third':'r53-garment-third.py','audit':'r53-garment-motion-audit.py','assemble':'r53-mob-assemble.py'}
def patched(stage):
    path=Path(__file__).resolve().with_name(STAGES[stage]);s=path.read_text()
    def replace(old,new):
        nonlocal s
        if s.count(old)!=1:raise RuntimeError('unexpected anchor '+stage+' '+old)
        s=s.replace(old,new,1)
    if stage=='wig':
        replace("ident=args[3];sex=ident.split('_')[1];i=int(ident[-2:])","ident=args[3];sex='male';i={'commander-male':1,'garan':8}[ident]")
        replace("bodies.rglob('mob-study-report.json')","bodies.rglob('cast-study-report.json')")
    elif stage=='motion':
        replace("root.rglob('mob-study-report.json')","root.rglob('cast-study-report.json')")
    elif stage in ('fit','refine','third','audit'):
        anchor="folder,rec=records[ident];"
        replace(anchor,"for f in root.rglob('cast-study-report.json'):\n    m=json.loads(f.read_text());records[m['id']]=(f.parent,m)\n"+anchor)
        if stage in ('fit','audit'):replace("sex=ident.split('_')[0]","sex='male'")
        if stage=='audit':
            replace("mr['id']!=sex+'_30s_normal'","mr['id']!=ident or mr['sourceBodySHA256']!=rec['sha256']")
            replace("clips=['Idle_Loop','Walk_Loop','Sprint_Loop','Sword_Attack']","clips=['Idle_Loop','Walk_Loop','Walk_Formal_Loop','Sprint_Loop','Sword_Attack','Interact','Hit_Chest','Death01','Spell_Simple_Shoot','Punch_Jab']")
            replace("'sameSexNormalMotionStressTest':ident.endswith('obese')","'sameSexNormalMotionStressTest':False")
    elif stage=='assemble':
        replace("'classification':'assembled review candidate, not collision-free or release-approved'","'classification':'named male provisional assembly; not final likeness, beard or armor; not collision-free or release-approved'")
    return path,compile(s,str(path),'exec')
if sys.argv[1:]==['--check']:
    for stage in STAGES:patched(stage)
    print('All seven named male stage adapters compile')
else:
    i=sys.argv.index('--');stage=sys.argv[i+1];path,code=patched(stage);sys.argv.pop(i+1)
    exec(code,{'__name__':'__main__','__file__':str(path)})
