"""Pack existing game props as standalone GLBs and create one original brooch study."""
import json,struct,sys,hashlib,math
from pathlib import Path
src,out=map(Path,sys.argv[1:]);manifest=json.loads((out/'parts-manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(path,g,b):
    g['buffers']=[{'byteLength':len(b)}];j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
def align(b):b.extend(b'\0'*((-len(b))%4))
items=[]
for name,socket in [('Sword_Bronze','weapon_right'),('Shield_Wooden','shield_left')]:
    source=src/(name+'.gltf');g=json.loads(source.read_text())
    buf=src/g['buffers'][0]['uri'];b=bytearray(buf.read_bytes());assert len(b)==g['buffers'][0]['byteLength'];hashes={source.name:sha(source),buf.name:sha(buf)};cache={}
    for im in g.get('images',[]):
        p=src/im.pop('uri')
        if p.name not in cache:
            align(b);v=len(g['bufferViews']);bb=p.read_bytes();g['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(bb)});b.extend(bb);cache[p.name]=v;hashes[p.name]=sha(p)
        im['bufferView']=cache[p.name]
    path=out/(name+'.glb');write(path,g,bytes(b))
    items.append({'id':name,'file':path.name,'sha256':sha(path),'sourceFilesSHA256':hashes,'sourceDirectory':'assets/props/fantasy-megakit','socket':socket,'attachment':'rigid-bone-local','localTransform':None,'fitApproved':False,'status':'original asset packaged losslessly; grip/orientation not yet fitted'})
# Simple original fantasy blue gem brooch in a silver bezel. Local origin
# is the back mounting surface, face points +Z; not yet fitted to armor.
b=bytearray();views=[];acc=[];prims=[]
def meshpart(P,F,mat):
    # Flat normals per face, independent primitives with explicit normals.
    pp=[];nn=[]
    for a,c,d in F:
        p,q,r=[P[i] for i in (a,c,d)]
        u=[q[i]-p[i] for i in range(3)];v=[r[i]-p[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];l=math.sqrt(sum(x*x for x in n));n=[x/l for x in n]
        pp.extend([p,q,r]);nn.extend([n,n,n])
    ids=[]
    for arr in (pp,nn):
        align(b);v=len(views);data=struct.pack('<'+'f'*(3*len(arr)),*(x for p in arr for x in p));views.append({'buffer':0,'byteOffset':len(b),'byteLength':len(data),'target':34962});b.extend(data)
        a={'bufferView':v,'componentType':5126,'count':len(arr),'type':'VEC3'}
        if arr is pp:a.update({'min':[min(p[i] for p in pp) for i in range(3)],'max':[max(p[i] for p in pp) for i in range(3)]})
        ids.append(len(acc));acc.append(a)
    prims.append({'attributes':{'POSITION':ids[0],'NORMAL':ids[1]},'material':mat})
def rings(spec):
    P=[(r*math.cos(2*math.pi*i/8),r*math.sin(2*math.pi*i/8),z) for r,z in spec for i in range(8)];F=[]
    for j in range(len(spec)-1):
        for i in range(8):
            a=j*8+i;c=j*8+(i+1)%8;F.extend([(a,c,c+8),(a,c+8,a+8)])
    F.extend([(0,i+1,i) for i in range(1,7)]);k=(len(spec)-1)*8;F.extend([(k,k+i,k+i+1) for i in range(1,7)])
    return P,F
P,F=rings([(.021,0),(.024,.003),(.019,.007)]);meshpart(P,F,0)
P,F=rings([(.017,.006),(.018,.009),(.010,.015)]);meshpart(P,F,1)
g={'asset':{'version':'2.0','generator':'R53 original accessory study'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'R53_blue_gem_brooch','mesh':0}],'meshes':[{'primitives':prims}],'accessors':acc,'bufferViews':views,'materials':[{'name':'silver','pbrMetallicRoughness':{'baseColorFactor':[.6,.65,.72,1],'metallicFactor':.85,'roughnessFactor':.32}},{'name':'blue gem','pbrMetallicRoughness':{'baseColorFactor':[.025,.18,.58,1],'metallicFactor':.22,'roughnessFactor':.19}}]}
p=out/'R53_blue_gem_brooch.glb';write(p,g,bytes(b));items.append({'id':p.stem,'file':p.name,'sha256':sha(p),'source':'original procedural game accessory study','socket':'chest','attachment':'rigid-bone-local','localTransform':None,'fitApproved':False,'status':'independent mesh; chest placement not yet fitted'})
manifest['rigidItems']=items;manifest['weaponAccessoryPolicy']='independent rigid items included, but socket-local placement must be calibrated and reviewed before attachment'
(out/'parts-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Packed rigid items',len(items))
