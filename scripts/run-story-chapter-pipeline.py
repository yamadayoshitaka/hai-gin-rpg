#!/usr/bin/env python3
"""Execute plan -> high-res 150-cell master -> 150 crop -> 20 page registration -> commit.

Use a previously rendered 7680x6480 atlas for each chapter/gender, OR twenty
genuine source sheets. Without real input images this command fails safely.

python scripts/run-story-chapter-pipeline.py \
 --chapter 1 --gender male --atlas-dir assets/story/atlases --commit

python scripts/run-story-chapter-pipeline.py \
 --all --atlas-dir assets/story/atlases --commit
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parent.parent
def sh(args):
 subprocess.run(args,check=True,cwd=ROOT)
def targets(args):
 if args.all:
  if args.chapter is not None or args.gender is not None:raise ValueError('--all cannot mix with --chapter/--gender')
  return [(ch,g) for ch in range(1,6) for g in ('male','female')]
 ch=args.chapter or 1
 g=args.gender or 'male'
 if not 1<=ch<=5:raise ValueError('chapter 1..5 only')
 return [(ch,g)]
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--all',action='store_true')
 p.add_argument('--chapter',type=int)
 p.add_argument('--gender',choices=('male','female'))
 p.add_argument('--atlas-dir')
 p.add_argument('--source-dir')
 p.add_argument('--commit',action='store_true')
 p.add_argument('--replace',action='store_true')
 args=p.parse_args()
 if bool(args.atlas_dir)==bool(args.source_dir):
  p.error('Choose exactly one of --atlas-dir or --source-dir')
 plans=targets(args)
 inputs=[]
 for ch,g in plans:
  base='c'+str(ch).zfill(2)+'-'+g+'-mainline-150.webp'
  source=(Path(args.atlas_dir)/base if args.atlas_dir else
          Path(args.source_dir)/('c'+str(ch).zfill(2)+'-'+g))
  if args.atlas_dir and not source.is_file():
   raise ValueError('Original 150 panel artwork missing: '+str(source))
  if args.source_dir and not source.is_dir():
   raise ValueError('Original 20-sheet art folder missing: '+str(source))
  inputs.append((ch,g,source))
 for ch,g,source in inputs:
  sh(['node','scripts/compile-story-chapter-atlas.mjs','--chapter',str(ch),'--gender',g])
  plan=Path('qa-reports/story-chapters')/('c'+str(ch).zfill(2)+'-'+g+'-mainline-150.json')
  atlas=source
  if args.source_dir:
   atlas=Path('assets/story/atlases')/('c'+str(ch).zfill(2)+'-'+g+'-mainline-150.webp')
   sh([sys.executable,'scripts/assemble-story-chapter-atlas.py',
       '--plan',str(plan),'--source-dir',str(source),'--output',str(atlas)])
  command=[sys.executable,'scripts/ingest-story-chapter-atlas.py',
     '--plan',str(plan),'--atlas',str(atlas),'--register']
  if args.replace:command.append('--replace')
  if args.commit:command.append('--commit')
  sh(command)
 print(json.dumps({'processed':len(inputs),'chapters':sorted({ch for ch,_,_ in inputs}),
   'framesPerChapterAndGender':150,'sourceType':'existing genuine art only',
   'committed':args.commit},ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except (ValueError,subprocess.CalledProcessError) as exc:
  print('PIPELINE STOPPED, NO FAKE ART: '+str(exc),file=sys.stderr)
  sys.exit(1)
