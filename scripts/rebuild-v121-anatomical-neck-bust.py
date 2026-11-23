#!/usr/bin/env python3
"""Build a NEW contiguous cervical, clavicle and upper-bust surface for female v121.

The old donor neck/shoulder faces are removed from the visible head primitive,
not covered by a second surface. The existing UV-split cut is welded in XYZ,
and new circumferential anatomical rings are generated from fresh parametric
sections; no source torso triangles or depth values are reused below the cut.
Only v121 receives this treatment; mouth, morphs and eyes remain untouched.
"""
import collections
import json
import math
import pathlib
import runpy
import struct
import sys

H = runpy.run_path(str(pathlib.Path(__file__).with_name('rebuild-v121-mouth-chin.py')))
read_glb, accessor, add_vec3 = H['read_glb'], H['accessor'], H['add_vec3']
write_indices, normals = H['write_indices'], H['normals']
CUT_Y = .145

def add_uv(g, b, values):
    while len(b) % 4:
        b.append(0)
    start = len(b)
    for u,v in values:
        b.extend(struct.pack('<ff', u, v))
    view = len(g['bufferViews'])
    g['bufferViews'].append({'buffer': 0, 'byteOffset': start,
                             'byteLength': len(values)*8, 'target': 34962})
    acc = len(g['accessors'])
    g['accessors'].append({'bufferView': view, 'componentType': 5126,
                           'count': len(values), 'type': 'VEC2'})
    return acc

def close_rim(xyz, removed, kept):
    def edges(faces):
        output = collections.defaultdict(list)
        for a,b,c in faces:
            if len({a,b,c}) != 3:
                continue
            for u,v in ((a,b),(b,c),(c,a)):
                output[tuple(sorted((u,v)))].append((u,v))
        return output
    outer = edges(kept)
    inner = edges(removed)
    border = set(outer).intersection(inner)
    if not 55 <= len(border) <= 250:
        raise ValueError('Unexpected cervical border: '+str(len(border)))
    # Original anatomical donor has split UV seams; both IDs share the same XYZ.
    # The two open border arcs therefore become one continuous geometric ring.
    canon = {}
    representatives = {}
    for i in {i for e in border for i in e}:
        key = tuple(round(v,5) for v in xyz[i])
        representatives.setdefault(key,i)
        canon[i] = key
    adjacency = collections.defaultdict(set)
    for a,b in border:
        ka,kb = canon[a],canon[b]
        if ka == kb:
            continue
        adjacency[ka].add(kb)
        adjacency[kb].add(ka)
    degrees = collections.Counter(len(v) for v in adjacency.values())
    if set(degrees) != {2}:
        raise ValueError('Neck seam cannot be safely welded: '+str(degrees))
    first = min(adjacency)
    ring = [first]
    previous = None
    while True:
        options = sorted(adjacency[ring[-1]] - ({previous} if previous else set()))
        if not options:
            raise ValueError('Open neck boundary')
        nxt = options[0]
        if nxt == first:
            break
        if nxt in ring or len(ring)>len(adjacency):
            raise ValueError('Self-intersecting cervical border')
        previous, ring = ring[-1], ring+[nxt]
    if len(ring) != len(adjacency):
        raise ValueError('Multiple disconnected cervical seams')
    ids = [representatives[k] for k in ring]
    # The ring must contain the forward neck AND the rear/side neck.
    if min(xyz[i][2] for i in ids)>-.045 or max(xyz[i][2] for i in ids)<.065:
        raise ValueError('Neck rim does not encircle cervical anatomy')
    return ids, len(border)

def surface(theta, y):
    # [Y, half-width, frontal depth, dorsal depth] in metres.
    # Neck: slender and gently backward inclined; shoulders and upper chest
    # fan out below clavicles instead of converging into the old pointed bib.
    stations = [
      (.130,.061,.079,-.064),
      (.117,.061,.074,-.067),
      (.102,.063,.073,-.069),
      (.088,.073,.077,-.072),
      (.073,.100,.081,-.079),
      (.057,.143,.094,-.087),
      (.040,.181,.107,-.094),
      (.018,.196,.124,-.104),
      (-.021,.195,.151,-.114),
      (-.075,.192,.153,-.121)]
    for i in range(len(stations)-1):
        high,low=stations[i],stations[i+1]
        if high[0]>=y>=low[0]:
            t=(high[0]-y)/(high[0]-low[0])
            t=t*t*(3.-2.*t)
            w=high[1]+(low[1]-high[1])*t
            front=high[2]+(low[2]-high[2])*t
            back=high[3]+(low[3]-high[3])*t
            break
    else:
        w,front,back=stations[-1][1:]
    c,s=math.cos(theta),math.sin(theta)
    x=w*c
    z=(front if s>=0 else -back)*s
    # Fine sternocleidomastoid, clavicle and upper-chest relief, all bounded.
    front_factor=max(0.,s)
    collar=math.exp(-((y-.058)/.019)**2)
    clavicle=math.exp(-((abs(x)-.085)/.042)**2)*collar*.0035
    chest=math.exp(-((y+.016)/.044)**2)*math.exp(-((abs(x)-.087)/.046)**2)*.0075
    z+=(clavicle+chest)*front_factor
    return (x,y,z)

def rebuild(path):
    g,b=read_glb(path)
    head=g['meshes'][0]
    if head.get('extras',{}).get('version')!=121:
        raise ValueError('Refuse non-v121 torso replacement')
    if len(g['meshes'])!=11 or len(g['nodes'])!=11:
        raise ValueError('Unexpected pre-torso facial rig')
    if 'neckBustRebuild' in head.get('extras',{}):
        raise ValueError('New bust already generated')
    p=head['primitives'][0]
    xyz=[tuple(v) for v in accessor(g,b,p['attributes']['POSITION'])]
    uv=[tuple(v) for v in accessor(g,b,p['attributes']['TEXCOORD_0'])]
    color=[tuple(v) for v in accessor(g,b,p['attributes']['COLOR_0'])]
    old_normals=[tuple(v) for v in accessor(g,b,p['attributes']['NORMAL'])]
    flat=[int(row[0]) for row in accessor(g,b,p['indices'])]
    if len(xyz)!=13455 or len(flat)!=25920*3:
        raise ValueError('Unexpected original female head topology')
    removed, kept = [],[]
    new_flat=list(flat)
    for k in range(0,len(flat),3):
        face=tuple(flat[k:k+3])
        if len(set(face))<3:
            continue  # The existing native mouth aperture stays untouched.
        if min(xyz[i][1] for i in face)<CUT_Y:
            removed.append(face)
            new_flat[k:k+3]=[face[0]]*3
        else:
            kept.append(face)
    if not 1500 <= len(removed) <= 2300:
        raise ValueError('Cannot isolate the old donor neck and shoulders')
    ring, border_edges = close_rim(xyz,removed,kept)
    area=sum(xyz[ring[i]][0]*xyz[ring[(i+1)%len(ring)]][2]-
             xyz[ring[(i+1)%len(ring)]][0]*xyz[ring[i]][2]
             for i in range(len(ring)))/2
    if abs(area)<.001:
        raise ValueError('Cervical ring collapsed in side plane')
    rcount=len(ring)
    # New top ring exactly fits every retained head XYZ seam vertex.
    positions=[xyz[i] for i in ring]
    tex=[uv[i] for i in ring]
    colors=[color[i] for i in ring]
    angles=[math.atan2(xyz[i][2],xyz[i][0]) for i in ring]
    for station in (.130,.117,.102,.088,.073,.057,.040,.018,-.021,-.075):
        for i,theta in enumerate(angles):
            positions.append(surface(theta,station))
            u=(theta/(2*math.pi)+1)%1
            t=max(0.,min(1.,(.130-station)/.17))
            tex.append((uv[ring[i]][0]*(1-t)+(.75+.10*u)*t,
                        uv[ring[i]][1]*(1-t)+(.85-.07*t)*t))
            col=color[ring[i]]
            colors.append(tuple(col[k]*(1-t)+(.98,.96,.945)[k]*t for k in range(3)))
    faces=[]
    for row in range(10):
        a=row*rcount
        b=(row+1)*rcount
        for j in range(rcount):
            n=(j+1)%rcount
            if area>0:
                faces.extend(((a+j,a+n,b+j),(a+n,b+n,b+j)))
            else:
                faces.extend(((a+n,a+j,b+j),(b+n,a+n,b+j)))
    # Close bottom below the viewport to avoid the source's triangular open bib.
    bottom=len(positions)
    positions.append((0.,-.076,0.))
    tex.append((.80,.79))
    colors.append((.98,.96,.945))
    last=10*rcount
    for j in range(rcount):
        n=(j+1)%rcount
        faces.append((last+n,last+j,bottom) if area>0
                     else (last+j,last+n,bottom))
    result_normals=normals(positions,faces)
    # Average duplicate seam normals on the original head ring.
    for j,i in enumerate(ring):
        result_normals[j]=old_normals[i]
    if any(not math.isfinite(v) for row in positions for v in row):
        raise ValueError('Non-finite anatomical bust coordinates')
    p['indices']=write_indices(g,b,new_flat)
    body={
        'name':'V121_NEW_ANATOMICAL_CERVICAL_SHOULDERS_BUST',
        'primitives':[{
          'attributes':{'POSITION':add_vec3(g,b,positions),
                        'NORMAL':add_vec3(g,b,result_normals),
                        'COLOR_0':add_vec3(g,b,colors),
                        'TEXCOORD_0':add_uv(g,b,tex)},
          'indices':write_indices(g,b,[i for f in faces for i in f]),
          'material':p['material']
        }]
    }
    mesh_index=len(g['meshes'])
    g['meshes'].append(body)
    old_node=next(n for n in g['nodes'] if n.get('mesh')==0)
    node={'name':'V121_NEW_ANATOMICAL_CERVICAL_BUST_NODE','mesh':mesh_index}
    for key in ('matrix','translation','rotation','scale'):
        if key in old_node:
            node[key]=list(old_node[key])
    node_id=len(g['nodes'])
    g['nodes'].append(node)
    g['scenes'][0]['nodes'].append(node_id)
    head.setdefault('extras',{})['neckBustRebuild']={
        'version':'female-v121-anatomical-neck-bust-rebuilt-v1',
        'removedLegacyNeckShoulderTriangles':len(removed),
        'weldedUVSplitCervicalRimVertices':rcount,
        'originalBorderEdges':border_edges,
        'generatedAnatomicalBustVertices':len(positions),
        'generatedAnatomicalBustTriangles':len(faces),
        'newBodyIsRealMesh':True,'oldBodyFacesHiddenByRemoval':True,
        'topRimMatchesOriginalHeadExactly':True,
        'independentNeckShoulderClavicleProfiles':True,
        'facialMorphsPreserved':11}
    g['buffers'][0]['byteLength']=len(b)
    raw=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    raw+=bytes([32])*((-len(raw))%4)
    b+=bytes([0])*((-len(b))%4)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b)))
        f.write(struct.pack('<I4s',len(raw),b'JSON'))
        f.write(raw)
        f.write(struct.pack('<I4s',len(b),b'BIN'+bytes([0])))
        f.write(b)
    print('V121 NEW NECK BUST',json.dumps(head['extras']['neckBustRebuild']))

if __name__ == '__main__':
    rebuild(pathlib.Path(sys.argv[1]))
