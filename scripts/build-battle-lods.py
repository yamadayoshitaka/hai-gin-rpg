#!/usr/bin/env python3
"""Offline, non-destructive GLB master -> near/mid/far review candidate generator."""
import argparse
import hashlib
import json
import pathlib
import sys
import traceback

import bpy

TIERS = {'near': 1.0, 'mid': 0.42, 'far': 0.15}


def parse_arguments():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--id', required=True)
    parser.add_argument('--out', default='assets/battle-lod-candidates')
    return parser.parse_args(args)


def scene_stats():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    return {
        'meshParts': len(meshes),
        'triangles': sum(sum(max(0, len(p.vertices)-2) for p in o.data.polygons) for o in meshes),
        'materials': len({m.name for o in meshes for m in o.data.materials if m}),
        'armatures': len([o for o in bpy.data.objects if o.type == 'ARMATURE']),
        'skinnedParts': len([o for o in meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]),
        'morphParts': len([o for o in meshes if o.data.shape_keys and len(o.data.shape_keys.key_blocks)>1]),
    }


def import_master(source):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    if not any(o.type == 'MESH' and o.data.polygons for o in bpy.data.objects):
        raise RuntimeError('Master GLB has no usable triangles')


def merge_compatible():
    # Only a single material, identical armature/parent, without shape keys or
    # object-local animation. Never absorb face morphs or extra modifiers.
    groups = {}
    for obj in list(bpy.data.objects):
        if obj.type!='MESH' or obj.animation_data or obj.data.shape_keys or len(obj.data.materials)!=1:
            continue
        if any(mod.type!='ARMATURE' for mod in obj.modifiers):
            continue
        rig = next((m.object for m in obj.modifiers if m.type=='ARMATURE'),None)
        key = (obj.parent.as_pointer() if obj.parent else 0,
               rig.as_pointer() if rig else 0,
               obj.data.materials[0].as_pointer() if obj.data.materials[0] else 0)
        groups.setdefault(key,[]).append(obj)
    joined=0
    for group in groups.values():
        if len(group)<2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        bpy.ops.object.join()
        joined+=len(group)-1
    return joined


def decimate_meshes(ratio):
    changed=0
    skipped=0
    for obj in list(bpy.data.objects):
        if obj.type!='MESH' or len(obj.data.polygons)<100:
            continue
        if obj.data.shape_keys and len(obj.data.shape_keys.key_blocks)>1:
            skipped+=1
            continue
        modifier=obj.modifiers.new(name='BattleLOD_Collapse',type='DECIMATE')
        modifier.ratio=ratio
        modifier.use_collapse_triangulate=True
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        try:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            changed+=1
        except RuntimeError:
            obj.modifiers.remove(modifier)
            skipped+=1
    return {'reducedParts':changed,'skippedParts':skipped}


def export_file(destination):
    destination.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',
                              export_animations=True,export_skins=True,
                              export_morph=True,export_yup=True)
    raw=destination.read_bytes()
    if len(raw)<20 or raw[:4]!=b'glTF':
        raise RuntimeError('Invalid generated GLB')
    return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def main():
    options=parse_arguments()
    root=pathlib.Path.cwd().resolve()
    source=(root/options.input).resolve()
    output_root=(root/options.out).resolve()
    if not source.is_relative_to(root/'assets') or source.suffix.lower()!='.glb' or not source.is_file():
        raise RuntimeError('Master must be an existing GLB inside assets/')
    if not options.id.replace('-','').replace('_','').isalnum() or len(options.id)>50:
        raise RuntimeError('Invalid asset ID')
    dest=output_root/options.id
    if not dest.is_relative_to(root/'assets'/'battle-lod-candidates') or source.is_relative_to(dest):
        raise RuntimeError('Output must stay in the unapproved battle LOD candidate folder')
    records={}
    baseline=None
    for name,ratio in TIERS.items():
        import_master(source)
        if baseline is None:
            baseline=scene_stats()
        joined=merge_compatible()
        reduced={'reducedParts':0,'skippedParts':0} if ratio==1 else decimate_meshes(ratio)
        count=scene_stats()
        file=dest/(name+'.glb')
        blob=export_file(file)
        records[name]={'path':file.relative_to(root).as_posix(),'ratio':ratio,
                       **count,'joinedParts':joined,**reduced,**blob}
    report={
        'schema':'hai-gin/battle-lod-candidate/v1','id':options.id,
        'source':source.relative_to(root).as_posix(),
        'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceStats':baseline,'tiers':records,
        'generatedFor':'candidate-review','liveModelReplaced':False,
        'pixelComparisonApproved':False,'mobileFpsApproved':False,
        'bakedNormalOrOcclusion':False
    }
    (dest/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('LOD_CANDIDATES',json.dumps(report,ensure_ascii=False))


if __name__=='__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
