"""Produce review-only contact sheets from actual Blender candidate output."""
import hashlib,json,sys,shutil,html
from pathlib import Path
from PIL import Image,ImageDraw
src,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
report=json.loads((src/"male-candidate-audit.json").read_text())
ids=["male_face_%02d"%i for i in range(1,11)]
records={r["id"]:r for r in report["faces"]}
if set(records)!=set(ids):raise RuntimeError("Incomplete candidate set")
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for ident in ids:
    p=src/(ident+".glb");b=p.read_bytes()
    if b[:4]!=b"glTF" or int.from_bytes(b[8:12],"little")!=len(b):
        raise RuntimeError("Invalid GLB: "+ident)
    if digest(p)!=records[ident]["sha256"]:raise RuntimeError("SHA mismatch: "+ident)
    if records[ident]["new_face_flips"]!=0 or records[ident]["neck_anchor_error_m"]!=0:
        raise RuntimeError("Geometry regression: "+ident)
for tag in ("front","side","45"):
    sheet=Image.new("RGB",(5*320,2*352),(28,32,40));draw=ImageDraw.Draw(sheet)
    for i,ident in enumerate(ids):
        p=src/(ident+"_"+tag+".png")
        with Image.open(p) as im:
            im.load()
            img=im.convert("RGB");img.thumbnail((320,320))
            x=(i%5)*320;y=(i//5)*352
            sheet.paste(img,(x+(320-img.width)//2,y))
            draw.text((x+10,y+327),ident,fill=(235,235,235))
        shutil.copy2(p,out/p.name)
    sheet.save(out/("male_"+tag+"_contact.png"),optimize=True)
for ident in ids:
    shutil.copy2(src/(ident+".glb"),out/(ident+".glb"))
shutil.copy2(src/"male-candidate-audit.json",out/"male-candidate-audit.json")
cards=[]
for ident in ids:
    n=ident[-2:]
    cards.append('<article><h2>男性 '+n+'</h2><div class="views">'+''.join(
       '<figure><img loading="lazy" src="'+ident+'_'+tag+'.png" alt="'+label+'"><figcaption>'+label+'</figcaption></figure>'
       for tag,label in [('front','正面'),('side','側面'),('45','斜め')])+
       '</div><a href="'+ident+'.glb" download>GLBファイル</a></article>')
(out/"index.html").write_text("""<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>R53 男性試作比較</title>
<style>body{background:#151a21;color:#f2f3f5;font:16px system-ui;margin:16px;max-width:1200px}article{border:1px solid #526070;padding:10px;margin:12px 0;border-radius:8px}img{width:100%;display:block}figure{margin:4px}.views{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}a{color:#9ed2ff}h2{font-size:18px}</style>
<h1>R53 男性顔試作10体</h1><p>Blenderの実レンダリング。制作途中のため正式品質未承認。個別表情モーフ、肌材質、髪と全身の適合は未完成。</p>
<p><a href="male_front_contact.png">正面一覧</a> | <a href="male_side_contact.png">側面一覧</a> | <a href="male_45_contact.png">斜め一覧</a> | <a href="male-candidate-audit.json">検査データ</a></p>"""+''.join(cards),encoding="utf-8")
print("R53 review package verified and assembled, no production approval")
