"""Batch rig all *pre-aligned* outfit assets, failing each invalid input explicitly.
Run under Blender: blender -b --python tools/batch_rig_outfits.py -- manifest.json
Manifest example: {"items":[{"body":"assets/.../body.gltf","armor":"assets/.../aligned.glb","output":"out/armor.glb"}]}
"""
import json, os, pathlib, subprocess, sys
def main():
    if '--' not in sys.argv: raise SystemExit('Manifest path required after --')
    manifest=pathlib.Path(sys.argv[sys.argv.index('--')+1])
    items=json.loads(manifest.read_text(encoding='utf-8')).get('items',[])
    if not items: raise SystemExit('No aligned outfits registered; refusing empty success')
    root=pathlib.Path.cwd().resolve()
    report=[]
    for item in items:
        try:
            paths=[pathlib.Path(item[key]) for key in ('body','armor','output')]
            if any(p.is_absolute() or '..' in p.parts for p in paths):
                raise ValueError('Paths must be relative to repository root')
            body,armor,out=paths
            if not (root/body).is_file() or not (root/armor).is_file():
                raise ValueError('Body or pre-aligned armor missing')
            if 'seven-head-equipment-candidates' in armor.parts:
                raise ValueError('Raw unaligned armor cannot be auto-rigged')
            (root/out).parent.mkdir(parents=True,exist_ok=True)
            result=subprocess.run([sys.executable,'-b','--python','tools/rig_outfit_blender.py',
                                   '--',str(body),str(armor),str(out)],
                                  capture_output=True,text=True,timeout=300)
            if result.returncode: raise RuntimeError((result.stdout+result.stderr)[-1500:])
            if not (root/out).is_file() or (root/out).stat().st_size==0:
                raise RuntimeError('Output missing')
            report.append({'armor':str(armor),'output':str(out),'status':'exported-unverified'})
        except Exception as exc:
            report.append({'armor':item.get('armor'),'status':'failed','error':str(exc)})
    pathlib.Path('outfit-rig-report.json').write_text(
        json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if any(r['status']=='failed' for r in report): raise SystemExit(1)
if __name__=='__main__': main()
