"""Blender new sword/shield candidate, measured projected outlines, separate modules."""
import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
args=sys.argv[sys.argv.index('--')+1:];src,design,out=map(Path,args);out=out.resolve();out.mkdir(parents=True,exist_ok=True)
data=json.loads(src.read_text());spec=json.loads(design.read_text())
def material(name,c,m,r):
    a=bpy.data.materials.new(name);a.use_nodes=True;a.diffuse_color=c;n=a.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=c;n.inputs['Metallic'].default_value=m;n.inputs['Roughness'].default_value=r;return a
def init():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return {k:material(k,v['baseColor'],v['metallic'],v['roughness']) for k,v in spec['materials'].items()}
def mesh(name,V,F,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(V,[],F);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(mat);return o
def tube(name,points,r,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(points)-1)
    for q,p in zip(s.points,points):q.co=(*p,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return bpy.context.object
def ell(name,p,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=p);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    return o
def lathe(name,rows,mat,n=32):
    V=[(r*math.cos(2*math.pi*i/n),r*math.sin(2*math.pi*i/n),z) for z,r in rows for i in range(n)];F=[]
    for j in range(len(rows)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;F.append((a,b,b+n,a+n))
    F.extend([tuple(reversed(range(n))),tuple(range((len(rows)-1)*n,len(rows)*n))]);return mesh(name,V,F,mat)
def curveinfo(P):
    A=np.array(P,float);D=np.diff(A,axis=0);L=np.linalg.norm(D,axis=1);u=D/np.maximum(L[:,None],1e-12);angles=np.degrees(np.arccos(np.clip(np.sum(u[:-1]*u[1:],axis=1),-1,1)))
    return {'pointsM':A.tolist(),'arcLengthM':float(L.sum()),'segmentTangent':u.tolist(),'turnAnglesDeg':angles.tolist(),'discreteCurvaturePerM':(np.radians(angles)/np.maximum((L[:-1]+L[1:])/2,1e-12)).tolist()}
def export(path,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True)
def render(folder,objects):
    P=np.array([tuple(o.matrix_world@v.co) for o in objects for v in o.data.vertices]);lo=P.min(0);hi=P.max(0);center=Vector((lo+hi)/2);size=float(np.max(hi-lo))
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.20,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    for name,p,energy in [('key',(-1,-2,2),500),('fill',(2,-1,.5),300),('rim',(0,2,1),400)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=2;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=center+Vector(p)*size;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('camera');d.type='ORTHO';d.ortho_scale=size*1.24;o=bpy.data.objects.new('camera',d);bpy.context.collection.objects.link(o);scene.camera=o
    for tag,axis in [('front',(0,-1,0)),('rear',(0,1,0)),('side',(1,0,0)),('threequarter',(.65,-1,.15))]:
        o.location=center+Vector(axis).normalized()*size*4;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(folder/(tag+'.png'));bpy.ops.render.render(write_still=True)
def finish(id,groups,curves,measure):
    folder=out/id;folder.mkdir(exist_ok=True);allobj=[o for v in groups.values() for o in v];bpy.context.view_layer.update();export(folder/'assembled.glb',allobj)
    rows=[]
    for k,objects in groups.items():
        p=folder/(k+'.glb');export(p,objects);Q=np.array([tuple(o.matrix_world@v.co) for o in objects for v in o.data.vertices]);rows.append({'id':id+'-'+k,'file':p.name,'boundsMm':(np.ptp(Q,axis=0)*1000).tolist(),'minM':Q.min(0).tolist(),'maxM':Q.max(0).tolist(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'materials':sorted({m.name for o in objects for m in o.data.materials if m})})
    report={'id':id,'source':str(src),'scaleTarget':measure,'parts':rows,'curves':curves,'PBR':spec['materials'],'visualApproved':False,'gripFitApproved':False,'collisionApproved':False,'limitations':['single approximate synthetic sheet','depth and thickness are artistic targets','not exact decorative reconstruction','not tested on animated body']}
    (folder/'report.json').write_text(json.dumps(report,indent=2));render(folder,allobj)
m=init();s=next(x for x in data['items'] if x['id']=='EQ-WS-001');f=s['pointsByView']['front'];L=spec['items']['sword']['lengthM'];origin=114;scale=L/341
def sx(x):return (x-origin)*scale
def sz(y):return (350-y)*scale
# Blade cross sections from traced pairs. Diamond cross section plus flat faces.
pairs=f['blade'];V=[];F=[]
for i in range(0,len(pairs)-1,2):
    a,b=pairs[i:i+2];z=sz(a[1]);w=(b[0]-a[0])*scale/2;t=.0045*(.45+.55*z/L)
    V.extend([(-w,0,z),(-w*.28,-t,z),(w*.28,-t,z),(w,0,z),(w*.28,t,z),(-w*.28,t,z)])
N=len(V)//6
for j in range(N-1):
    for k in range(6):a=j*6+k;b=j*6+(k+1)%6;F.append((a,b,b+6,a+6))
F.append(tuple(reversed(range(6))));tip=len(V);V.append((0,0,0))
for k in range(6):F.append(((N-1)*6+k,(N-1)*6+(k+1)%6,tip))
blade=mesh('blade',V,F,m['steel'])
guardpts=[(sx(x),0,sz(y)) for x,y in f['guard']];guard=tube('guard',guardpts,.008,m['gold'])
griplo=sz(75);griphi=sz(35);grip=lathe('grip',[(griplo,.016),(griplo+.01,.017),(griphi-.01,.015),(griphi,.017)],m['leather'])
wrap=[]
for k in range(9):
    z=griplo+(griphi-griplo)*(k+.5)/9
    wrap.append(tube('wrap_%02d'%k,[(.017*math.cos(t),.017*math.sin(t),z+.002*t/(2*math.pi)) for t in np.linspace(0,2*math.pi,33)],.0012,m['gold']))
pommel=lathe('pommel',[(sz(34),.011),(sz(29),.022),(sz(20),.026),(sz(12),.013),(sz(9),.003)],m['gold'])
gem=ell('gem',(0,-.011,sz(91)),(.013,.009,.015),m['gem']);trim=[tube('blade_inlay_'+str(i),[(sgn*.008,-.004,sz(y)) for y in (112,150,205,255,300)],.0009,m['gold']) for i,sgn in enumerate((-1,1))]
finish('EQ-WS-001',{'blade':[blade],'guard':[guard],'grip':[grip]+wrap,'pommel':[pommel],'gem':[gem],'gold_trim':trim},{'guard':curveinfo(guardpts),'bladeOutline':curveinfo([(sx(x),0,sz(y)) for x,y in f['outline']])},{'totalLengthM':L,'fromImageRatio':s['ratios']})
m=init();s=next(x for x in data['items'] if x['id']=='EQ-SH-001');f=s['pointsByView']['front'];H=spec['items']['shield']['heightM'];sc=H/306
def pp(q,offset=0):
    x=(q[0]-116)*sc;z=(684-q[1])*sc;return (x,.035*(abs(x)/(.192*H/.306))**2+offset,z)
# Curved plate built as a fan on the measured outline, independent surfaces.
def plate(name,outline,back,front,mat):
    A=[pp(q,front) for q in outline];B=[pp(q,back) for q in outline];n=len(A);v=A+B;v.extend([(0,front,H*.54),(0,back,H*.54)]);F=[]
    for i in range(n):j=(i+1)%n;F.extend([(2*n,i,j),(2*n+1,n+j,n+i),(i,n+i,n+j,j)])
    return mesh(name,v,F,mat)
core=plate('wood_core',f['outline'],.012,-.003,m['leather']);panel=plate('front_panel',f['innerRim'],-.003,-.007,m['navyWood'])
rimpts=[pp(q,-.008) for q in f['outline']];rim=tube('rim',rimpts+[rimpts[0]],.007,m['steel'])
crest=plate('crest_relief',f['crest'],-.008,-.013,m['gold'])
rivets=[ell('rivet_%02d'%i,pp(q,-.013),(.004,.003,.004),m['gold']) for i,q in enumerate(f['rivetSamples'])]
# Back hardware follows the visible rear positions, with estimated grip depth.
rear=s['pointsByView']['rear'];straps=[];buckles=[]
for k in ('upperStrap','lowerStrap'):
    Q=rear[k];z=(684-float(np.mean([q[1] for q in Q])))*sc
    straps.append(tube(k,[(-.11,.025,z),(0,.036,z),(.11,.025,z)],.009,m['leather']))
    buckles.append(tube(k+'_buckle',[(-.105,.039,z-.012),(-.075,.039,z-.012),(-.075,.039,z+.012),(-.105,.039,z+.012),(-.105,.039,z-.012)],.0025,m['gold']))
grip=tube('rear_grip',[(.055,.026,H*.66),(.055,.06,H*.62),(.055,.06,H*.36),(.055,.026,H*.32)],.009,m['leather'])
finish('EQ-SH-001',{'wood_core':[core],'front_panel':[panel],'rim':[rim],'crest':[crest],'rivets':rivets,'straps':straps,'grip':[grip],'buckles':buckles},{'outerRim':curveinfo(rimpts+[rimpts[0]]),'innerRim':curveinfo([pp(q) for q in f['innerRim']]),'crest':curveinfo([pp(q) for q in f['crest']])},{'heightM':H,'fromImageRatio':s['ratios']})
print('R53 new equipment candidates exported')
