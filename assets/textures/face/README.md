# Face microtexture — photographed skin (CC0)

Asset: `cc0-human-skin-reference.jpg` (1,040,257 bytes).

- Original photograph: **Image skin texture.jpg**, unnamed photographer, 13 March 2017.
- Canonical Wikimedia Commons file and public license record: https://commons.wikimedia.org/wiki/File:Image_skin_texture.jpg
- Original publication: https://pixnio.com/textures-and-patterns/human-skin
- Public mirror used to import the unmodified original: https://github.com/v3devv/comfyui-skin-detailer/blob/main/assets/skin_reference_cc0.jpg
- License: **Creative Commons CC0 1.0 Universal**, permits commercial redistribution without attribution.
- Mirrored original SHA-1 Git blob: `07d51f9935e8d628e4a4208a00f154e6ee629aae`.

## Game treatment

`src/face-photo-microdetail-v76.js` downscales the actual photographed local luminance into two 384×384 GPU maps: neutral skin micro-bump relief and subtle PBR roughness variation. Wide lighting gradients and photographic skin tone are removed. **The image is not a UV portrait**, and its original color is never directly applied to eyes, nose, lips, brows or overall facial skin; original character pigmentation, makeup and age remain intact. The maps are shared across both male/female 3D faces. If the asset fails to decode, existing procedural skin and face controls remain usable.

This photo is a genuine skin close-up, **not a registered/retopologized 4K facial atlas**. The iris and lip optical relief maps in `src/face-optics-v76.js` are geometric/polar procedural details, not third-party photographed eye textures. Do not misrepresent them as a photogrammetric iris scan.
