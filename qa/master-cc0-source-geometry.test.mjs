import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path=new URL('../assets/master-sources/makehuman/high-poly-eyes.obj',import.meta.url);
const bytes=readFileSync(path);
const lines=bytes.toString('utf8').split(/\r?\n/);
const prefix=(p)=>lines.filter(x=>x.startsWith(p));

test('actual imported MakeHuman 3D geometry is the original CC0 upstream git blob',()=>{
 const expected='01562a9caf4dca9ebb1fd5c24db083c17e724330';
 const hash=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(hash,expected,'Source OBJ changed; do not silently modify master donor geometry');
 const header=lines.slice(0,18).join('\n');
 assert.match(header,/This asset was explicitly released as CC0/i);
 assert.match(header,/released as CC0 in september 2020/i);
});
test('eyes contain actual textured quad geometry, normals and two halves',()=>{
 assert.equal(prefix('v ').length,1064);
 assert.equal(prefix('vt ').length,808);
 assert.equal(prefix('vn ').length,1064);
 const polygons=prefix('f ');
 assert.equal(polygons.length,1020);
 assert.ok(polygons.every(f=>f.trim().split(/\s+/).length===5),
  'Source should retain original quad topology rather than simplified triangles');
 const coords=prefix('v ').map(x=>x.trim().split(/\s+/).slice(1,4).map(Number));
 assert.ok(coords.every(x=>x.length===3&&x.every(Number.isFinite)));
 const min=[0,1,2].map(k=>Math.min(...coords.map(x=>x[k])));
 const max=[0,1,2].map(k=>Math.max(...coords.map(x=>x[k])));
 assert.ok(min[0]<-.4&&max[0]>.4,'both actual eyeballs should be present');
 assert.ok(max[1]-min[1]>.25&&max[2]-min[2]>.2,'eye shape has collapsed');
});
test('matching original CC0 iris atlas and source material are imported without modifications',()=>{
 const png=readFileSync(new URL('../assets/master-sources/makehuman/brown_eye.png',import.meta.url));
 const sha=createHash('sha1').update('blob '+png.length+'\0').update(png).digest('hex');
 assert.equal(sha,'bda1b4b0d94f4b7b34ca4f58063eab04f05cd2e7');
 assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 const material=readFileSync(new URL('../assets/master-sources/makehuman/brown.mhmat',import.meta.url),'utf8');
 assert.match(material,/This asset was explicitly released as CC0/i);
 assert.match(material,/diffuseTexture brown_eye\.png/i);
 const meta=JSON.parse(readFileSync(new URL('../assets/master-sources/makehuman/SOURCE.json',import.meta.url),'utf8'));
 assert.equal(meta.originalIrisAtlasBlobSha,sha);
 assert.equal(meta.sourceTextureImported,true);
 assert.equal(meta.skinnedModelComplete,false);
 assert.equal(meta.ff13VisualQualityApproved,false);
});

test('master source viewer renders actual source geometry and does not auto-install to battle',()=>{
 const html=readFileSync(new URL('../master-eye-source-inspector.html',import.meta.url),'utf8');
 assert.ok(html.includes("OBJLoader"));
 assert.ok(html.includes("assets/master-sources/makehuman/high-poly-eyes.obj"));
 assert.ok(html.includes('MeshPhysicalMaterial'));
 assert.ok(html.includes('wireframe:true'));
 assert.ok(html.includes('originalIrisAtlasLoaded:true'));
 assert.ok(html.includes('brown_eye.png'));
 assert.ok(html.includes('THREE.SRGBColorSpace'));
 assert.ok(html.includes('sourceObjects.visible'));
 assert.ok(html.includes('window.__masterEyeSourceQA'));
 const library=readFileSync(new URL('../master-model-manager.html',import.meta.url),'utf8');
 assert.ok(library.includes('master-eye-source-inspector.html'));
 assert.ok(library.includes('実際に取り込んだ3D素材'));
});
