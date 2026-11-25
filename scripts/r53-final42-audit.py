"""Strict R53 42-person release inventory; never generates or approves art.
All evidence must exist, be content-addressed, and match the same asset version.
The original 20-face gate remains independent.
"""
import argparse, hashlib, json, math, struct
from pathlib import Path
P=argparse.ArgumentParser()
P.add_argument('--report',default='review/r53-42/status.json')
P.add_argument('--body-dir',default=None)
P.add_argument('--strict',action='store_true')
args=P.parse_args()
ROOT=Path.cwd().resolve()
OUT=Path(args.report);OUT.parent.mkdir(parents=True,exist_ok=True)
errors=[]
def read(path): return json.loads(Path(path).read_text(encoding='utf-8'))
cast=read('data/r53-cast-reference-map.json')
mobs=read('data/r53-mob-roster.json')['mobs']
roster={r['id']:('cast',r) for r in cast['castRoster']}
roster.update({r['id']:('mob',r) for r in mobs})
assert len(cast['castRoster'])==22 and len(mobs)==20 and len(roster)==42
assert all(sum(m['sex']==s for m in mobs)==10 for s in ('female','male'))
views=('front','left','right','rear','left45','right45','crown','face','body_front','body_side','body_rear')
ages=('under10','teens','20s','30s','40s','50s','60s','70s','80plus')
builds=('slim','normal','muscular','chubby','obese')
checks=('topology','normals','face_flips','collapsed_faces','roundtrip','neck','hair_fit','garment_fit','skin_weights','expressions','combined_expressions','walk_run','actions','save_restore','action_sync','mobile_browser','lod','visual_comparison')
base=ROOT/'assets/character-r53-final'
def digest(raw): return hashlib.sha256(raw).hexdigest()
def file_record(entry, suffix=None):
    if not isinstance(entry,dict): raise ValueError('missing file record')
    p=(ROOT/entry['path']).resolve()
    if not p.is_relative_to(base.resolve()): raise ValueError('path outside final assets')
    if suffix and p.suffix.lower()!=suffix: raise ValueError('wrong extension: '+str(p))
    raw=p.read_bytes()
    if not raw or digest(raw)!=entry['sha256']: raise ValueError('hash mismatch: '+str(p))
    return p,raw
def glb(entry, skin=False):
    _,b=file_record(entry,'.glb')
    if len(b)<28 or struct.unpack_from('<III',b)!=(0x46546c67,2,len(b)): raise ValueError('invalid GLB header')
    n,kind=struct.unpack_from('<II',b,12)
    if kind!=0x4e4f534a or 28+n>len(b): raise ValueError('missing JSON/BIN')
    j=json.loads(b[20:20+n]);size,kind=struct.unpack_from('<II',b,20+n)
    if kind!=0x004e4942 or 28+n+size!=len(b): raise ValueError('invalid BIN')
    if skin and not j.get('skins'): raise ValueError('rig absent')
    h=hashlib.sha256();vertices=0
    for m in j['meshes']:
        for p in m['primitives']:
            a=j['accessors'][p['attributes']['POSITION']];v=j['bufferViews'][a['bufferView']]
            if a['type']!='VEC3' or a['componentType']!=5126 or a.get('sparse') or v.get('buffer',0)!=0: raise ValueError('unsupported positions')
            start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);count=a['count']
            if count<1 or start+(count-1)*stride+12>min(size,v.get('byteOffset',0)+v['byteLength']): raise ValueError('invalid accessor bounds')
            for i in range(count):
                k=28+n+start+i*stride;xyz=struct.unpack_from('<fff',b,k)
                if not all(map(math.isfinite,xyz)): raise ValueError('nonfinite position')
                h.update(b[k:k+12])
            vertices+=count
    if not vertices: raise ValueError('no vertices')
    return h.hexdigest(),vertices
def png(entry):
    _,b=file_record(entry,'.png')
    if b[:8]!=b'\x89PNG\r\n\x1a\n': raise ValueError('invalid PNG')
def record_error(ident,exc): errors.append(ident+': '+str(exc))
manifest=base/'manifest.json'
final={}
if manifest.is_file():
    try:
        rows=read(manifest)['characters']
        final={r['id']:r for r in rows}
        if len(final)!=len(rows) or set(final)!=set(roster): raise ValueError('manifest must have exactly 42 unique roster IDs')
    except Exception as e: record_error('manifest',e)
else: errors.append('final manifest missing: '+str(manifest.relative_to(ROOT)))
seen_faces=set();seen_full=set();seen_refs=set();statuses=[]
for ident,(kind,source) in roster.items():
    status={'id':ident,'category':kind,'source_status':source.get('sourceVisualStatus',source.get('status')),'release_approved':False}
    row=final.get(ident)
    if not row:
        status['reason']='final record missing';statuses.append(status);continue
    try:
        if row['category']!=kind: raise ValueError('category mismatch')
        if row['sex'] not in ('male','female') or (source.get('sex') and row['sex']!=source['sex']): raise ValueError('sex mismatch')
        face,_=glb(row['face']);full,v0=glb(row['full'],True)
        _,v1=glb(row['lod1'],True);_,v2=glb(row['lod2'],True)
        glb(row['hair'])
        if not 0<v2<v1<v0: raise ValueError('LOD vertex counts not descending')
        if face in seen_faces or full in seen_full: raise ValueError('duplicate baked geometry')
        seen_faces.add(face);seen_full.add(full)
        _,mb=file_record(row['measurements'],'.json');m=json.loads(mb)
        if m['id']!=ident or not m.get('observed') or 'estimated' not in m: raise ValueError('measurement provenance missing')
        refs=row['referenceViews'];renders=row['renderViews']
        for key in views: png(refs[key]);png(renders[key])
        front=refs['front']['sha256']
        if front in seen_refs: raise ValueError('shared frontal reference')
        seen_refs.add(front)
        if m.get('referenceHashes')!={k:refs[k]['sha256'] for k in views}: raise ValueError('measurements not bound to references')
        _,qb=file_record(row['quality'],'.json');q=json.loads(qb)
        if q['id']!=ident or q['assetHashes']!={k:row[k]['sha256'] for k in ('face','full','hair','lod1','lod2','measurements')}: raise ValueError('quality evidence asset mismatch')
        if q.get('renderHashes')!={k:renders[k]['sha256'] for k in views}: raise ValueError('quality evidence render mismatch')
        if any(q['checks'].get(k) is not True for k in checks): raise ValueError('incomplete quality checks')
        if set(q['ageBuildPass'])!={a+':'+b for a in ages for b in builds} or not all(v is True for v in q['ageBuildPass'].values()): raise ValueError('age/build matrix incomplete')
        if q.get('visualApproved') is not True or not q.get('visualReviewer'): raise ValueError('visual signoff missing')
        status['release_approved']=True
    except Exception as e:
        status['reason']=str(e);record_error(ident,e)
    statuses.append(status)
body={'verified':0,'expected':30,'status':'not supplied'}
if args.body_dir:
    try:
        bp=Path(args.body_dir);data=read(bp/'body-candidates.json')['models']
        expected={s+'_'+a+'_'+b for s in ('female','male') for a in ('child','adult','senior') for b in builds}
        if len(data)!=30 or {m['id'] for m in data}!=expected: raise ValueError('incomplete base body inventory')
        for m in data:
            if digest((bp/(m['id']+'.glb')).read_bytes())!=m['sha256'] or m['new_face_flips']!=0 or m['collapsed']!=0: raise ValueError('body audit failed: '+m['id'])
            body['verified']+=1
        body['status']='verified studies only; not final or nine age cohorts'
    except Exception as e: body['status']=str(e);record_error('body',e)
approved=sum(s['release_approved'] for s in statuses)
report={'target':42,'approved':approved,'unapproved':42-approved,'cast_reference_annotations':len(cast['references']),'cast_conflicts':cast['sourceConflicts'],'body':body,'characters':statuses,'errors':errors,'release_ready':approved==42 and not errors}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ('target','approved','unapproved','cast_reference_annotations','body','release_ready')},ensure_ascii=False))
if args.strict and not report['release_ready']: raise SystemExit(1)
