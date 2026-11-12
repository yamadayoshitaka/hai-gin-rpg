"""CI smoke test only: synthetic color stripes NEVER become game assets."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent.parent
with TemporaryDirectory(prefix='test-only-story-150-') as tmp:
 temp=Path(tmp)
 source=Image.new('RGB',(7680,6480))
 draw=ImageDraw.Draw(source)
 for i in range(150):
  xx=(i%10)*768;yy=(i//10)*432
  for stripe in range(18):
   color=((stripe*17+i*5)%256,(stripe*33+i*11)%256,(stripe*41+i*7)%256)
   draw.rectangle((xx,yy+stripe*24,xx+767,yy+(stripe+1)*24-1),fill=color)
 image=temp/'synthetic-NEVER-PUBLISH.webp'
 source.save(image,'WEBP',quality=70,method=0)
 plan=root/'qa-reports/story-chapters/c01-male-mainline-150.json'
 assert plan.is_file()
 result=subprocess.run([sys.executable,str(root/'scripts/ingest-story-chapter-atlas.py'),
  '--plan',str(plan),'--atlas',str(image)],capture_output=True,text=True,cwd=root)
 assert result.returncode==0,result.stderr
 j=json.loads(result.stdout)
 assert j['frames']==150 and j['gamePages']==20 and j['outputFiles']==171
 assert j['status']=='verified-not-registered' and not j['humanApproved']
 assert not (root/'assets/story/atlases/c01-male-mainline-150.webp').exists()
 print('PASS TEST-ONLY 150-frame atlas: real crop dimensions, 20 pages, 150 per-ID WebPs, no fake published art')
