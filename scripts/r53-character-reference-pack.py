import sys,json,hashlib,base64,html
from pathlib import Path
from PIL import Image
root,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
registry=json.loads(Path('data/r53-character-reference-registry.json').read_text())
records=[]
import shutil
for r in registry['records']:
    i=r['id'];found=list(root.glob('*/'+i+'/record.json'))
    if len(found)!=1:raise ValueError('missing/duplicate '+i)
    p=found[0];v=json.loads(p.read_text())
    if v['id']!=i or v['sourceRun']!=r['sourceRun'] or v['referenceApproved'] or not v.get('modelSHA256'):raise ValueError('provenance '+i)
    if not .3<v['measurements']['height_m']<3:raise ValueError('measurement '+i)
    if len(v['images']['body'])!=4 or len(v['images']['head'])!=9:raise ValueError('view inventory '+i)
    d=out/'characters'/i;d.mkdir(parents=True,exist_ok=True)
    for group in v['images'].values():
        for k,f in group.items():
            with Image.open(p.parent/f) as im:im.verify()
            shutil.copyfile(p.parent/f,d/f);group[k]='characters/'+i+'/'+f
    (d/'record.json').write_text(json.dumps(v,ensure_ascii=False,indent=2));records.append(v)
registry['records']=records
(out/'registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2))
def esc(s):return html.escape(str(s))
cards=[]
labels={'front':'正面','rear':'背面','left':'左側面','right':'右側面','top':'上面','bottom':'下面','front_left_45':'左斜め','front_right_45':'右斜め','rear_left_45':'後斜め'}
for r in records:
    m=r['measurements'];i=r['id']
    pics=lambda kind:''.join(f'<figure><a href="{v}"><img loading="lazy" src="{v}"></a><figcaption>{labels[k]}</figcaption></figure>' for k,v in r['images'][kind].items())
    def cm(k):return '未計測' if m.get(k) is None else f"{m[k]*100:.1f} cm"
    cards.append(f'<article data-id="{i}" data-group="{r["group"]}"><h2>{esc(r["label"])} <small>{i}・未承認</small></h2><p>身長 {cm("height_m")} ／肩骨間 {cm("shoulderBoneDistance_m")} ／眼球骨間 {cm("eyeBoneDistance_m")} ｜{esc(r["age"])}・{esc(r["build"])}</p><div class="views">{pics("body")}</div><details><summary>顔9方向・採寸詳細</summary><div class="views">{pics("head")}</div><p><a href="characters/{i}/record.json">採寸・モデルSHA・出典 JSON</a></p></details></article>')
(out/'index.html').write_text('''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>灰銀のレゾナンス キャラクター基準台帳</title><style>body{font:15px system-ui;background:#141b25;color:#edf2fa;margin:12px}h1{font-size:24px}h2{font-size:18px}small{color:#e8b377;font-size:12px}article{background:#202c3b;padding:12px;margin:12px 0;border-radius:10px}.views{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}figure{margin:0;text-align:center}img{width:100%;height:auto}a{color:#9fd1ff}input,select{padding:8px;max-width:95%}@media(max-width:600px){.views{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>キャラクター基準台帳 全42体</h1><p>漫画・2D制作向けの実3Dモデル候補。正式承認前のため、確定原画に転用しないこと。寸法はモデル空間の値。</p><p><a href="registry.json">全採寸・画像登録データ JSON</a></p><input id="q" placeholder="名前・IDで検索"><select id="g"><option value="">全員</option><option value="cast">名あり</option><option value="mob">モブ</option></select>'''+''.join(cards)+'''<script>function filter(){document.querySelectorAll('article').forEach(a=>a.hidden=!a.textContent.includes(q.value)||(g.value&&a.dataset.group!==g.value))}q.oninput=g.onchange=filter</script></html>''',encoding='utf8')
print('REGISTERED',len(records),'model references and',sum(sum(len(x) for x in r['images'].values()) for r in records),'actual rendered images')
