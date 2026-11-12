#!/usr/bin/env python3
"""Publish an ENTIRE reviewed story chapter, never a half-finished branch.

Input:
  node scripts/prepare-story-chapter.mjs --chapter 1
  assets/story/chapter-drafts/c01/<approved filename>.webp
  assets/story/chapter-drafts/c01/review-approved.json

The plan covers all ten stages, choice/route/ending variants, victory and
defeat, both protagonist genders. Missing one required branch blocks the
whole chapter; no art is generated or silently substituted here.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageStat
ROOT=Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def validate(chapter, publish=False):
    if chapter not in range(1,21):
        raise ValueError('Chapter must be 1..20')
    ch=f'c{chapter:02d}'
    plan_path=ROOT/'qa-reports/story-chapters'/f'{ch}-production.json'
    if not plan_path.is_file():
        raise ValueError('Run prepare-story-chapter.mjs for this chapter first')
    plan=json.loads(plan_path.read_text(encoding='utf8'))
    if plan['chapter']!=chapter or plan['stageCount']!=10:
        raise ValueError('Production plan mismatch')
    draft=ROOT/'assets/story/chapter-drafts'/ch
    approval_file=draft/'review-approved.json'
    if not approval_file.is_file():
        raise ValueError('Missing chapter review record: '+str(approval_file))
    approval=json.loads(approval_file.read_text(encoding='utf8'))
    if approval.get('chapter')!=chapter or approval.get('approved') is not True or not str(approval.get('approvedBy','')).strip():
        raise ValueError('Chapter approval is incomplete')
    checks=['storyMatches','characterMatches','genderMatches','outcomeMatches','noDuplicatedScene','noTextInArt']
    if any(approval.get('confirm',{}).get(k) is not True for k in checks):
        raise ValueError('Missing human review: '+', '.join(k for k in checks if approval.get('confirm',{}).get(k) is not True))
    expected={}
    for variant in plan['variants']:
        if not variant['panels'] or not variant['pages']:
            raise ValueError('Empty comic variant')
        for page in variant['pages']:
            for gender in ('male','female'):
                relative=page['files'][gender]
                name=Path(relative).name
                if name in expected:
                    raise ValueError('Duplicate asset path in chapter plan: '+name)
                if not relative.startswith(f'assets/story/chapters/{ch}/'):
                    raise ValueError('Invalid page destination: '+relative)
                expected[name]=(draft/name,ROOT/relative,tuple(page['expectedPixels']),
                                variant['stageId'],variant['phase'],variant['edition'],gender)
    if len(expected)!=plan['requiredPages']:
        raise ValueError('Incomplete chapter manifest')
    approvals=approval.get('pages',{})
    if set(approvals)!=set(expected):
        missing=set(expected)-set(approvals)
        extra=set(approvals)-set(expected)
        raise ValueError(f'Approval set differs from chapter plan: missing={len(missing)}, extra={len(extra)}')
    missing=[name for name,(src,*_) in expected.items() if not src.is_file()]
    if missing:
        raise ValueError(f'Chapter is NOT ready: {len(missing)} page files missing; examples: {missing[:4]}')
    unique={}
    prepared=[]
    for name,(src,target,pixels,stage,phase,edition,gender) in expected.items():
        info=approvals[name]
        if not isinstance(info,dict) or info.get('approved') is not True:
            raise ValueError('Page is not individually approved: '+name)
        hash_value=digest(src)
        if hash_value!=info.get('sha256'):
            raise ValueError('Image was modified after approval: '+name)
        if src.stat().st_size<12000:
            raise ValueError('Page image is empty or too small: '+name)
        with Image.open(src) as im:
            im.load()
            if im.format!='WEBP' or im.size!=pixels:
                raise ValueError(f'{name}: expected WebP {pixels}, got {im.format} {im.size}')
            if ImageStat.Stat(im.convert('L')).stddev[0]<8:
                raise ValueError('Nearly blank artwork: '+name)
        # An exact image for victory may NOT silently serve as defeat artwork.
        key=(stage,phase,gender,hash_value)
        other=unique.get(key)
        if other and other!=edition:
            raise ValueError(f'Copied scene across different outcomes/choices: {name} and {other}')
        unique[key]=edition
        prepared.append((src,target,name,hash_value))
    # No output is touched until the full ten-stage chapter has passed.
    if publish:
        for src,target,_,_ in prepared:
            target.parent.mkdir(parents=True,exist_ok=True)
            temp=target.with_suffix('.webp.tmp')
            temp.write_bytes(src.read_bytes())
            temp.replace(target)
        registry={'chapter':chapter,'approvedBy':approval['approvedBy'],'schemaVersion':1,
                  'pageCount':len(prepared),'editionCount':plan['editionCount'],
                  'pages':{name:sha for _,_,name,sha in prepared}}
        output=ROOT/'assets/story/chapters'/ch/'registration.json'
        output.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    return {'chapter':chapter,'status':'published' if publish else 'all-approved-ready',
            'stages':10,'editions':plan['editionCount'],'genderSeparatedPages':len(prepared)}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--chapter',type=int,required=True)
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args()
    try:
        print(json.dumps(validate(args.chapter,args.publish),ensure_ascii=False))
    except (ValueError,OSError,KeyError) as ex:
        print('CHAPTER INCOMPLETE: '+str(ex),file=sys.stderr)
        sys.exit(1)
