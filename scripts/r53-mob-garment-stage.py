"""Run established garment fitting stages against independent mob GLBs.
Original scripts are unchanged. Exact anchors fail closed when source changes.
This adapter adds source records and uses each mob's own action asset.
"""
import sys
from pathlib import Path
STAGES={'fit':'r53-garment-fit.py','refine':'r53-garment-refine.py','third':'r53-garment-third.py','motion':'r53-garment-motion-audit.py'}
def patched(stage):
    path=Path(__file__).resolve().with_name(STAGES[stage])
    s=path.read_text()
    def replace(old,new):
        nonlocal s
        if s.count(old)!=1:raise RuntimeError('unexpected source anchor '+stage+' '+old)
        s=s.replace(old,new,1)
    anchor="folder,rec=records[ident];"
    replace(anchor,"for f in root.rglob('mob-study-report.json'):\n    m=json.loads(f.read_text());records[m['id']]=(f.parent,m)\n"+anchor)
    if stage in ('fit','motion'):
        replace("sex=ident.split('_')[0]","sex=ident.split('_')[1]")
    if stage=='motion':
        replace("mr['id']!=sex+'_30s_normal'","mr['id']!=ident or mr['sourceBodySHA256']!=rec['sha256']")
        replace("clips=['Idle_Loop','Walk_Loop','Sprint_Loop','Sword_Attack']","clips=['Idle_Loop','Walk_Loop','Walk_Formal_Loop','Sprint_Loop','Sword_Attack','Interact','Hit_Chest','Death01','Spell_Simple_Shoot','Punch_Jab']")
        replace("'sameSexNormalMotionStressTest':ident.endswith('obese')","'sameSexNormalMotionStressTest':False")
    return path,compile(s,str(path),'exec')
if sys.argv[1:]==['--check']:
    for stage in STAGES:patched(stage)
    print('All four mob garment source adaptations compile')
else:
    i=sys.argv.index('--');stage=sys.argv[i+1]
    path,code=patched(stage)
    sys.argv.pop(i+1)
    exec(code,{'__name__':'__main__','__file__':str(path)})
