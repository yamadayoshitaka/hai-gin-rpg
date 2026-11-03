"""Fail-closed preflight for every unique outfit candidate and registered rigged outfit."""
import json, pathlib, struct, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/characters/seven-head-equipment-candidates'
REGISTRY=ROOT/'data/character-system/aligned-outfits.json'

def glb_json(path):
    raw=path.read_bytes()
    if len(raw)<20 or raw[:4]!=b'glTF': raise ValueError('not GLB')
    version,length=struct.unpack_from('<II',raw,4)
    if version!=2 or length!=len(raw): raise ValueError('invalid GLB header/length')
    n,kind=struct.unpack_from('<I4s',raw,12)
    if kind!=b'JSON': raise ValueError('missing GLB JSON chunk')
    return json.loads(raw[20:20+n])

def main():
    src=json.loads((SOURCE/'manifest.json').read_text(encoding='utf8'))
    registered=json.loads(REGISTRY.read_text(encoding='utf8')).get('items',[])
    candidates=sorted({f for sexes in src['jobs'].values() for files in sexes.values() for f in files})
    report={'schema':'outfit-pipeline-preflight-v1','candidates':[],
            'registered':[],'errors':[],'ready':False}
    for name in candidates:
        path=SOURCE/name
        try:
            data=glb_json(path)
            skins=len(data.get('skins',[]))
            report['candidates'].append({'file':name,'skins':skins,
                'status':'rigged-source' if skins else 'unrigged-source'})
        except Exception as exc:
            report['errors'].append(f'{name}: {exc}')
    for item in registered:
        try:
            path=ROOT/item['output']
            if not path.is_file(): raise ValueError('output not generated')
            data=glb_json(path)
            if not data.get('skins'): raise ValueError('export has no skin bindings')
            report['registered'].append({'output':item['output'],'status':'skinned-not-visual-verified'})
        except Exception as exc:
            report['errors'].append(f"{item.get('output','unknown')}: {exc}")
    report['ready']=bool(registered) and not report['errors'] and len(report['registered'])==len(registered)
    target=ROOT/'outfit-preflight-report.json'
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f"Candidates: {len(candidates)}; registered: {len(registered)}; errors: {len(report['errors'])}; ready: {report['ready']}")
    if report['errors']: print('\n'.join(report['errors']),file=sys.stderr)
    # Inventory audit may pass with no aligned outfits, but readiness cannot.
    if '--require-ready' in sys.argv and not report['ready']:
        print('NOT READY: no complete, validated rigged outfit registry',file=sys.stderr)
        return 1
    return 1 if report['errors'] else 0

if __name__=='__main__': sys.exit(main())
