#!/usr/bin/env python3
"""Expose only compressed CI-generated v121 screenshots for human visual QA."""
import base64
import io
import pathlib
from PIL import Image
root=pathlib.Path('qa/screenshots/face-v121')
for name in ('neutral-face-front.png','neutral-face-side.png','neutral-face-mouth-open-front.png'):
    source=root/name
    if not source.exists():
        raise ValueError('No actual WebGL rendering: '+name)
    with Image.open(source) as im:
        im=im.convert('RGB')
        im.thumbnail((480,620))
        buf=io.BytesIO()
        im.save(buf,format='JPEG',quality=67,optimize=True)
    print('V121_PREVIEW_IMAGE',name,base64.b64encode(buf.getvalue()).decode('ascii'))
