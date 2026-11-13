import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const p0=JSON.parse(fs.readFileSync(path.join(root,'assets/story/quality/artwork-p0-rules.json'),'utf8'));
const mobile=p0.technicalRule.mobileDeliveryProfile;
assert.equal(mobile.profileId,'MOBILE_768x320_NATIVE_NO_UPSCALE');
assert.deepEqual(mobile.minimumNativePixels,[768,320]);
assert.deepEqual(mobile.acceptedSourceExampleNativePixels,[787,350]);
assert.equal(mobile.requiredNoUpscaling,true);
assert.equal(mobile.screenDisplayMaxCssWidth,740);
assert.equal(mobile.mobileThresholdOverridesDesktopOnlyWhenExplicitlySelected,true);
assert.equal(p0.technicalRule.minimumNativePixels[0],1536); // desktop untouched
assert.equal(p0.imageRule.textAllowed,false);
assert.equal(p0.referenceRule.actualBytesMustBeAttached,true);
assert.equal(p0.storyRule.noReuseAcrossOutcome,true);
const viewer=fs.readFileSync(path.join(root,'src/story-manga-viewer.js'),'utf8');
assert.match(viewer,/objectFit='contain'/); // per-cut aspect preserved
const passes=(w,h)=>w>=mobile.minimumNativePixels[0]&&h>=mobile.minimumNativePixels[1];
for(const h of [350,389,392,397,433])assert.equal(passes(787,h),true);
assert.equal(passes(500,400),false);
assert.equal(passes(787,200),false);
assert.equal(mobile.requiresManualApprovalFor.includes('exactCanonicalScript'),true);
assert.equal(mobile.requiresManualApprovalFor.includes('noTextOrUI'),true);
console.log('PASS: phone-size 787x350-433px is resolution eligible; desktop requirements and P0 story/cast/text gates remain untouched.');
