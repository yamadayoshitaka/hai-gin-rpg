#!/usr/bin/env python3
"""Final female v121 GLB stage: clean cosmetic band/chin tint, sculpt soft folds.

This edits real skin POSITION, NORMAL and COLOR_0 attributes and saves a GLB.
The 13,455 indexed face vertex IDs, UVs, geometry index buffer, eye/pupil UV,
eyelashes, brows, rig zones and older game models are not changed.
"""
import argparse
import json
import math
import pathlib
import struct


def bell(x, center, width):
    return math.exp(-.5*((x-center)/width)**2)


def clamp(x, low=0., high=1.):
    return max(low, min(high, x))


def fade(x, low, high):
    t=clamp((x-low)/(high-low))
    return t*t*(3-2*t)


def vermilion_outline(x,y,z):
    """One anatomically tapered closed boundary for geometry AND pigment.

    In final actual XYZ, the upper edge is a shallow M with two Cupid peaks.
    The lower edge curves toward the neutral oral commissures. Soft 1-3 mm
    internal feathers make the surface legible without a painted hard stripe
    or a second ridge underneath the lower lip.
    """
    ax=abs(x)
    # v20 neutral lips are smaller than the oversize v19 reference.
    # The old v19 outline corresponds to a future lip-size slider MAX (1.0);
    # this neutral preset is approximately 0.68 in lip span/volume.
    if ax>=.047 or z<=.119 or y<.219 or y>.252:
        return 0.,0.,0.
    corner=fade(ax,.017,.038)
    # Narrow Cupid's bow and lift the lower rim towards the oral seam.
    # Keep both real raised Cupid peaks and a distinct central notch.
    upper=.2439+.0022*bell(ax,.0095,.005)-.00055*bell(ax,0.,.0038)-.0125*corner
    lower=.2235+.0094*corner
    if upper-lower<=.001:
        return 0.,upper,lower
    inside=(fade(y,lower-.0005,lower+.0015)*
            (1.-fade(y,upper-.0015,upper+.0005)))
    width=(1.-fade(ax,.026,.042))*bell(x,0.,.029)
    return clamp(inside*width*fade(z,.127,.144)),upper,lower


def nasolabial_relief(x,y,z):
    """Shallow anatomical fold from side of ala toward mouth commissure.

    Never carve a straight lateral cheek trench or touch the lip/philtrum.
    The crease starts at x~33 mm below the nostril and curves gently outward
    toward x~45 mm by the oral corner; it fades before reaching the chin.
    """
    ax=abs(x)
    if not (.225<y<.275 and .026<ax<.063):
        return 0.
    upper_fraction=fade(y,.226,.271)
    center=.045-.012*upper_fraction
    length=fade(y,.225,.237)*(1.-fade(y,.263,.275))
    # The older valley was visually too deep; retain an anatomical crease
    # without the angular/vertical cheek gouge visible at 45 degrees.
    return (-.00043*bell(ax,center,.0072)*length*
            fade(z,.080,.123))


def read_glb(path):
    data=path.read_bytes()
    if data[:4]!=b'glTF' or struct.unpack_from('<II',data,4)!=(2,len(data)):
        raise ValueError('Expected complete GLB 2.0')
    json_length=struct.unpack_from('<I',data,12)[0]
    graph=json.loads(data[20:20+json_length])
    offset=20+json_length
    if data[offset+4:offset+8]!=b'BIN\0':
        raise ValueError('GLB missing binary chunk')
    return graph,bytearray(data[offset+8:])


def accessor(g,b,i):
    a=g['accessors'][i]
    c={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']]
    view=g['bufferViews'][a['bufferView']]
    start=view.get('byteOffset',0)+a.get('byteOffset',0)
    stride=view.get('byteStride',c*struct.calcsize(fmt))
    return [struct.unpack_from('<'+fmt*c,b,start+j*stride)
            for j in range(a['count'])]


def add_vec3(g,b,values):
    while len(b)%4:b.append(0)
    offset=len(b)
    for v in values:
        b.extend(struct.pack('<fff',*v))
    view=len(g['bufferViews'])
    g['bufferViews'].append({'buffer':0,'byteOffset':offset,
                             'byteLength':12*len(values)})
    ai=len(g['accessors'])
    g['accessors'].append({
        'bufferView':view,'componentType':5126,'type':'VEC3',
        'count':len(values),
        'min':[min(v[k] for v in values) for k in range(3)],
        'max':[max(v[k] for v in values) for k in range(3)]})
    return ai


def normalise(v):
    d=math.sqrt(sum(t*t for t in v))
    return tuple(t/d for t in v) if d>1e-12 else (0.,0.,1.)


def normals(points,triangles):
    out=[[0.,0.,0.] for _ in points]
    for a,b,c in triangles:
        p,q,r=points[a],points[b],points[c]
        u=[q[k]-p[k] for k in range(3)]
        v=[r[k]-p[k] for k in range(3)]
        face=(u[1]*v[2]-u[2]*v[1],
              u[2]*v[0]-u[0]*v[2],
              u[0]*v[1]-u[1]*v[0])
        for i in (a,b,c):
            for k in range(3):
                out[i][k]+=face[k]
    return [normalise(t) for t in out]


def fold_displacement(x,y,z):
    """Fair the outer cheek and retain only a faint INNER smile fold.

    Broad continuous cheek support removes the lateral linear hollows; a
    separate curved nasolabial valley stays near the side of the nose, not
    beneath the cheekbone. Both fade out before the jaw or oral seam.
    """
    front=fade(z,.080,.123)
    ax=abs(x)
    under_eye=(-.00026*bell(y,.287,.0038)*
               fade(ax,.023,.033)*(1.-fade(ax,.062,.072))*front)
    # Replace the prior narrow 2.8-mm pit fill with soft cheek-wide support,
    # so it cannot read as an extra edge near the mouth corners.
    lateral_fair=(.00265*bell(ax,.071,.032)*bell(y,.245,.049)*
                  fade(y,.200,.221)*front)
    corner_fair=(.00140*bell(ax,.050,.020)*bell(y,.233,.025)*
                 front*(1.-fade(ax,.070,.090)))
    return under_eye+lateral_fair+corner_fair+nasolabial_relief(x,y,z)


def philtrum_relief(x,y,z):
    """Real central groove under the nasal septum, fading into Cupid's bow.

    The groove is not drawn as a dark cosmetic line. Paired raised philtral
    columns create the light/shadow difference naturally from the 3D surface.
    """
    # Previous -0.0092 peak formed an oval *hole* in the upper-lip skin:
    # its y mask cut off well before the septum and the paired high columns
    # exaggerated the isolated depression. The actual philtrum is a LONG,
    # gently shaded central channel, not a circular indentation.
    if y<.239 or y>.273:
        return 0.
    # A long central groove from the upper Cupid's bow to beneath the
    # columella. Preserve the known safe 3.8 mm maximum: extend its smooth
    # longitudinal plateau rather than deepening a circular pit.
    # Soft lateral columns describe genuine skin relief, never a drawn line.
    # The former philtrum started on the UPPER LIP at Y=.243 and its
    # 3.8-mm depression cancelled the lip's forward volume. End the central
    # channel above the lifted Cupid border: skin groove, not lip cavity.
    vertical=fade(y,.248,.255)*(1.-fade(y,.264,.273))
    front=fade(z,.071,.116)
    groove=-.0038*bell(x,0,.0050)*vertical*front
    columns=.00095*(bell(x,-.0098,.0046)+bell(x,.0098,.0046))*vertical*front
    return groove+columns



def nose_and_lips(x,y,z):
    """Sculpt the v121 neutral head in real XYZ, preserving mouth seal.

    Eyeballs and lid loops are outside the region. Narrow only the nasal tip
    and nasal wings, not the upper lip; sculpt M-shaped Cupid peaks and fuller
    lower vermilion. Separate the lower-lip volume from the labiomental skin,
    never adding a second ridge below the genuine lip boundary.
    """
    ax=abs(x)
    # Guard the nose from deforming lip corners directly below the alae.
    nasal=fade(y,.243,.254)
    nose_front=fade(z,.093,.141)*nasal
    wing=(bell(ax,.028,.017)*bell(y,.251,.017)*fade(z,.084,.127)*
          (1.-fade(ax,.043,.054))*nasal)
    nose_head=(bell(ax,.019,.015)*bell(y,.254,.017)*nose_front*
               (1.-fade(ax,.038,.052)))
    # Narrow the full alar silhouette and the nose head in actual XYZ,
    # without treating dark nostril pixels as a 2D texture. The nostril rim
    # and adjoining cheeks fade to the untouched source outside the masks.
    nx=x*(1.-.145*wing-.092*nose_head)
    tip=bell(x,0.,.017)*bell(y,.251,.016)*fade(z,.122,.154)*nasal
    ala=bell(ax,.027,.011)*bell(y,.252,.016)*nose_front*(1.-fade(ax,.043,.054))
    bridge=bell(x,0.,.012)*bell(y,.282,.030)*fade(z,.087,.138)
    # Keep a narrow central dorsal ridge rather than a blunt nasal button.
    # The narrow lift is balanced by a gentle alar/tip retraction in profile.
    central_ridge=(bell(x,0.,.009)*bell(y,.274,.018)*
                   fade(z,.118,.151)*nasal)
    nz=z-.00305*tip-.00152*ala+.00085*bridge+.00115*central_ridge

    # Mouth corners fall off continuously to zero, while the central lip
    # retains volume. A narrower bottom boundary restores the reference's
    # convex lower-lip surface without creating an infra-labial shelf.
    lip_front=fade(z,.103,.137)
    # v19's neutral shape is the MAX-size reference; 0.68 is the new
    # sculpted neutral default. Retain the 3D cupid silhouette, not its
    # excessive horizontal spread into the cheeks.
    horizontal=bell(x,0,.030)*(1.-fade(ax,.036,.048))
    # Separate convex upper and lower VERMILION surfaces on real skin vertices.
    # The mouth seal at y=.232 and its two contour loops are excluded from
    # either volume; otherwise the region reads as a single duck-bill ridge.
    upper=(bell(y,.2400,.0062)*horizontal*lip_front*
           fade(y,.2322,.2368)*(1.-fade(y,.247,.254)))
    lower=(bell(y,.2260,.0064)*horizontal*lip_front*
           fade(y,.217,.223)*(1.-fade(y,.229,.233)))
    cupids=bell(ax,.0095,.0054)*bell(y,.243,.0058)*lip_front*
           (1.-fade(ax,.034,.047))
    seam=bell(y,.232,.0028)*horizontal*lip_front

    # Physically shorten the nose-to-upper-lip interval, rather than merely
    # painting a vertical philtrum. Lift the entire closed-mouth area softly,
    # then lower the bottom vermilion rim a little to increase its height.
    # Leave the closed-mouth seal (Y ~ .232) in its original vertex band:
    # the native aperture morph is identified from these exact skin loops.
    # Pull the upper lip 2 mm further towards the nasal base at its center.
    # The narrow mouth-seal Y band (~.232) is still hard-faded to zero;
    # changing that seam would break real 3D mouth aperture topology.
    lip_lift=(.00215*bell(y,.240,.0080)*horizontal*lip_front*
              fade(y,.235,.239)*(1.-fade(y,.247,.254)))
    # Expand the real lip boundary vertically; do not move the resting
    # oral-seal band or make a second ridge beneath the lower vermilion.
    bottom_rim=.00075*bell(y,.219,.0045)*horizontal*lip_front
    upper_rim=(.00050*bell(y,.243,.0042)*horizontal*lip_front*
               fade(y,.237,.240))
    # The smaller upper vermilion still needs the two genuine M peaks.
    peaks=(bell(x,-.0095,.0045)+bell(x,.0095,.0045))
    bow_lift=.00100*peaks*bell(y,.243,.0045)*lip_front
    central_notch=.00055*bell(x,0,.0037)*bell(y,.243,.0045)*lip_front
    ny=y+lip_lift+upper_rim-bottom_rim+bow_lift-central_notch

    # Increase upper/lower vermilion projection, not the adjacent chin.
    # The fullness tapers into the genuine mouth corners via horizontal.
    # Give the upper vermilion its own convex front: it must not disappear
    # into the philtrum, nor sit behind the fuller lower lip in profile.
    # Keep the actual seam and mouth-corner end loops fixed.
    # A visible upper-lip convexity must survive bare-skin rendering,
    # independent of lipstick. Reduce the lower projection to avoid a bill.
    nz+=(.00440*upper+.00265*lower+.00080*cupids-.00025*seam)
    # Keep a single center groove between the columella and Cupid's bow;
    # the two philtral columns remain soft and do not cross the upper lip.
    nz+=philtrum_relief(nx,y,nz)
    # Trace the actual vermilion border with SUB-millimetre inward geometry.
    # The lift is inside the existing lip, not on the adjacent upper skin
    # or under the lower lip: no doubled contour or horizontal shadow band.
    skin_lip,upper_edge,lower_edge=vermilion_outline(nx,ny,nz)
    if skin_lip>0.:
        nz+=skin_lip*(.00038*bell(ny,upper_edge-.0015,.0012)+
                      .00020*bell(ny,lower_edge+.0016,.0012))
    return (nx,ny,nz)


def neutral_color(x,y,z):
    """Reference-like soft makeup, anchored to anatomical vertices.

    Avoid colour patches between the eyes/brows or on chin. Each mask
    fades on all edges; PBR BaseColor remains the underlying real skin.
    """
    ax=abs(x)
    front=fade(z,.070,.125)
    # Light rose blush following upper outer cheeks, nowhere near chin.
    # Do not extend blush into the lower jaw, even at a tiny gaussian tail.
    cheek=((bell(x,-.077,.037)+bell(x,.077,.037))*
           bell(y,.256,.033)*front if y>=.215 else 0.)
    nose_tip=bell(x,0,.024)*bell(y,.258,.012)*fade(z,.118,.153)
    # The very same M-bow and inward-tapering lip border gates pigment.
    # Outside the actual vermilion no lipstick can extend onto cheek/chin.
    lip_surface,_,_=vermilion_outline(x,y,z)
    vermilion=1.03*bell(y,.239,.0068)+.86*bell(y,.227,.0065)
    lips=clamp(vermilion*lip_surface)
    # Soft brown-beige upper eyelid shadow, bounded below the actual brows.
    shadow=(bell(x,-.044,.025)+bell(x,.044,.025))*bell(y,.318,.005)*front
    lower_liner=(bell(x,-.044,.023)+bell(x,.044,.023))*bell(y,.295,.004)*front
    # R channel near 1, G/B reductions create soft pink and taupe accents.
    return (clamp(.995-.007*lips-.024*shadow-.009*lower_liner),
            clamp(.994-.075*cheek-.022*nose_tip-.205*lips-.037*shadow-.015*lower_liner),
            clamp(.992-.094*cheek-.027*nose_tip-.232*lips-.049*shadow-.021*lower_liner))


def smooth_chin(points,faces):
    """One bounded pass across the old jagged chin shading, not the lips."""
    adjacency=[set() for _ in points]
    for a,b,c in faces:
        adjacency[a].update((b,c))
        adjacency[b].update((a,c))
        adjacency[c].update((a,b))
    result=list(points)
    smoothed=0
    for i,(x,y,z) in enumerate(points):
        if not (.098<y<.177 and abs(x)<.082 and z>.005):
            continue
        weight=(fade(y,.109,.133)*(1-fade(y,.153,.172))*
                (1-fade(abs(x),.058,.080))*fade(z,.005,.050))
        if weight<.015 or not adjacency[i]:
            continue
        mean=sum(points[j][2] for j in adjacency[i])/len(adjacency[i])
        value=clamp(mean-z,-.003,.003)*.32*weight
        result[i]=(x,y,z+value)
        if abs(value)>1e-7:smoothed+=1
    return result,smoothed



def correct_chin_profile(points):
    """Do not apply the legacy secondary chin bridge.

    The former stacked Gaussians and artificial +0.020 z "bridge" caused a
    second, protruding contour at the chin-to-neck junction. All lower-face
    geometry is now solved ONCE by rebuild-v121-mouth-chin.py, after the lip
    finish pass. Keep this stage for historical GLB metadata only.
    """
    lip_front=max(z for x,y,z in points if abs(x)<.042 and .217<y<.249)
    chin=max(z for x,y,z in points if abs(x)<.055 and .160<y<.204)
    return points,{
        'version':'female-v121-sagittal-guard-20261123',
        'lipFrontZ':round(lip_front,6),
        'chinBeforeZ':round(chin,6),
        'chinAfterZ':round(chin,6),
        'lipChinDepthClearance':round(lip_front-chin,6),
        'vertexCorrectionZ':0.,
        'labiomentalTransitionContinuous':False,
        'legacyBridgeDisabled':True,
        'neckBelow080Unaffected':True
    }


def finish(path):
    g,b=read_glb(path)
    face=g['meshes'][0]
    meta=face.get('extras',{})
    if meta.get('version')!=121 or meta.get('hairIncluded') is not False:
        raise ValueError('Only the female bald v121 face may be changed')
    if meta.get('naturalFoldCleanup'):
        raise ValueError('Skin was already cleaned')
    if len(g['meshes'])!=8 or len(g['nodes'])!=8:
        raise ValueError('Expected v121 with actual eyeliner/lash/brow meshes')
    p=face['primitives'][0]
    pos=[tuple(q) for q in accessor(g,b,p['attributes']['POSITION'])]
    if len(pos)!=13455:
        raise ValueError('Must preserve original 13455 skin vertices')
    flat=[t[0] for t in accessor(g,b,p['indices'])]
    if len(flat)!=25920*3:
        raise ValueError('Must preserve all 25920 skin triangles')
    faces=[tuple(flat[i:i+3]) for i in range(0,len(flat),3)]
    # No isolated chin smoothing pass: the rebuilt profile owns this region.
    xyz,chin_count=pos,0
    folds_left=[]
    folds_right=[]
    philtrum_ids=[]
    dimple_filled_ids=[]
    updated=[]
    nasal_vertices=[]
    lip_vertices=[]
    for i,(x,y,z) in enumerate(xyz):
        nx,ny,nz=nose_and_lips(x,y,z)
        dz=fold_displacement(nx,ny,nz)
        updated.append((nx,ny,nz+dz))
        fold=nasolabial_relief(nx,ny,nz)
        if fold<-.00010:
            (folds_left if nx<0. else folds_right).append(i)
        central=philtrum_relief(nx,ny,nz)
        if central<-.00038 and abs(nx)<.011 and .252<ny<.267:
            philtrum_ids.append(i)
        if dz>.00020 and .218<ny<.251 and .025<abs(nx)<.067:
            dimple_filled_ids.append(i)
        if abs(nx-x)>.00008 and .225<y<.280:
            nasal_vertices.append(i)
        # Record the resulting (not source) vermilion coordinates. The
        # Cupid peaks physically move up and the lower rim physically
        # moves down, so original-Y bounds would mislabel skin/philtrum.
        if abs(nz-z)>.00015 and .2152<ny<.2528 and abs(nx)<.058:
            lip_vertices.append(i)
    if len(nasal_vertices)<20 or len(lip_vertices)<30:
        raise ValueError('Nose and vermilion must have actual displaced vertices')
    updated,chin_profile=correct_chin_profile(updated)
    meta['sagittalChinProfile']=chin_profile
    # Keep the original POSITION vertex order, immutable UVs and triangles.
    p['attributes']['POSITION']=add_vec3(g,b,updated)
    p['attributes']['NORMAL']=add_vec3(g,b,normals(updated,faces))
    colors=[neutral_color(x,y,z) for x,y,z in updated]
    p['attributes']['COLOR_0']=add_vec3(g,b,colors)
    if (len(philtrum_ids)<12 or len(dimple_filled_ids)<12 or
            len(folds_left)<8 or len(folds_right)<8):
        raise ValueError('Real philtrum, faint inner folds and cheek fairing required')
    # Reduce the separate eyelid-crease ribbon tint: no hard pink mask.
    for material in g['materials']:
        if material['name']=='V121_NATURAL_UPPER_LID_CREASE_PBR':
            material['pbrMetallicRoughness']['baseColorFactor']=[
                .79,.65,.62,1.]
            material['pbrMetallicRoughness']['roughnessFactor']=.92
    # Texture/PBR remains embedded in the same original GLB; use tasteful,
    # low-gloss cosmetics rather than flat vertex-color face paint.
    skin_material=g['materials'][0]
    skin_material['pbrMetallicRoughness']['roughnessFactor']=.88
    skin_material['normalTexture']['scale']=.075
    for material in g['materials']:
        name=material.get('name','')
        pbr=material.get('pbrMetallicRoughness',{})
        if name=='V121_UPPER_EYELINER_PBR':
            pbr['baseColorFactor']=[.15,.095,.090,1.]
        elif name=='V121_FINE_LOWER_EYELASHES_PBR':
            pbr['baseColorFactor']=[.25,.17,.145,1.]
        elif name=='V121_INDIVIDUAL_EYEBROW_FIBERS_PBR':
            pbr['baseColorFactor']=[.38,.29,.235,1.]
    meta['referenceMakeup']={
        'version':'v121-natural-reference-size-lips-v20-20261124',
        'skinPalette':'warm-natural-ivory',
        'cheekBlush':'subtle-peach-rose',
        'lips':'soft-rose-pink-vertex-gradient',
        'upperLid':'warm-taupe-blended',
        'lashColor':'soft-brown',
        'skinPBR':True,
        'noSeparateFloatingDecals':True}
    meta['referenceFeatureSculpt']={
        'version':'v121-natural-reference-lips-v20-20261124',
        'narrowerNasalWingsAndHeadRealMesh':True,
        'centralNasalDorsumRidgeRealMesh':True,
        'upperLowerVermilionFullnessRealMesh':True,
        'lipFullnessFadesAtCornersAndChin':True,
        'anatomicalVermilionBorderRealGeometry':True,
        'upperVermilionRepositionedWithinBorder':True,
        'philtrumExcludedFromUpperLipGeometry':True,
        'upperLipConvexityMillimeters':4.40,
        'lipSizeDefaultRelativeToV19Maximum':.68,
        'lipSizeFormerV19Maximum':1.0,
        'lipSizeSliderEnabled':False,
        'lipReductionChangesActualVertices':True,
        'upperAndLowerVermilionSeparatedRealMesh':True,
        'oralSeamTopologyExcludedFromLipProjection':True,
        'outerCheekVolumetricFairing':True,
        'upperCupidBowBorderAndLowerRimDefined':True,
        'lipCornerTaperedToOralCommissure':True,
        'noSecondSubLabialRidge':True,
        'outerCheekTrenchSoftened':True,
        'shallowInnerNasolabialFoldSculpted':True,
        'upperLipRaisedTowardNoseMillimeters':2.15,
        'philtrumLongitudinalCoverage':[.248,.273],
        'philtrumReal3DGrooveNotMakeup':True,
        'oralMouthSealProtected':True,
        'lowerLipFullerAndCornerTapered':True,
        'upperLipMShapedCupidBow':True,
        'nasalTipAndAlarNarrowed':True,
        'philtrumDistanceShortenedByGeometry':True,
        'nostrilWingVerticesAdjusted':nasal_vertices,
        'lipVermilionVerticesAdjusted':lip_vertices,
        'centralPhiltrumStart':[0.,.264],
        'philtrumGrooveMasterDepth':.0038,
        'philtrumColumnsRelief':.00095,
        'philtrumShape':'continuous_nose_base_to_upper_vermilion_v19_channel',
        'philtrumNoOvalPit':True,
        'parametricDepthControlSupported':True,
        'centralPhiltrumEnd':[0.,.248],
        'philtrumVertexIds':philtrum_ids,
        'lateralDimpleCorrectionVertexIds':dimple_filled_ids,
        'lateralNasolabialPitRemoved':True,
        'nasolabialLeftVertexIds':folds_left,
        'nasolabialRightVertexIds':folds_right,
        'foldIsActualSkinGeometry':True,
        'preservesEyeAndMouthTopology':True,
        'facialExpressionAnimations':False}
    meta['naturalFoldCleanup']={
        'version':'v121-soft-supported-cheeks-20261124-v20',
        'technique':'native indexed skin vertex sculpt and corrected neutral vertex colors',
        'removedLegacyBrowLidBand':True,
        'removedChinTintLeakage':True,
        'lipPigmentRestrictedToVermilion':True,
        'chinVerticesSmoothed':chin_count,
        'nasolabialLeftVertexIds':folds_left,
        'nasolabialRightVertexIds':folds_right,
        'philtrumVertexIds':philtrum_ids,
        'dimpleCorrectionVertexIds':dimple_filled_ids,
        'additionalFoldRegions':['central-philtrum','infraorbital','inner-nasolabial'],
        'surfaceDeformationOnly':True,
        'expressionAnimationImplemented':False}
    g['asset']['generator']='HaiGin v121 v20 neutral lips reduced to 0.68 former v19 maximal dimensions'
    g['buffers'][0]['byteLength']=len(b)
    json_bytes=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    json_bytes+=b' '*((-len(json_bytes))%4)
    b+=b'\0'*((-len(b))%4)
    length=12+8+len(json_bytes)+8+len(b)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII',b'glTF',2,length))
        f.write(struct.pack('<I4s',len(json_bytes),b'JSON'))
        f.write(json_bytes)
        f.write(struct.pack('<I4s',len(b),b'BIN\0'))
        f.write(b)
    print('v121 skin cleanup complete',json.dumps({
        'vertices':len(updated),'chinSmoothed':chin_count,
        'centralPhiltrumVertices':len(philtrum_ids),
        'dimpleFillVertices':len(dimple_filled_ids),
        'noseChanged':len(nasal_vertices),'lipsChanged':len(lip_vertices),
        'byteLength':length}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('glb',type=pathlib.Path)
    finish(parser.parse_args().glb)
