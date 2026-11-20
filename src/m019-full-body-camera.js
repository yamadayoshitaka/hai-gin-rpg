/**
 * Camera framing for exceptionally long horizontal creatures on portrait
 * phones. A full-body fit must use horizontal FOV, not only vertical FOV.
 * Pure geometry keeps the math independently testable without a WebGL context.
 */
export function m019FullBodyFit({
 width,height,depth,aspect,fovDegrees=42
}={}){
 const dims=[width,height,depth,aspect,fovDegrees];
 if(!dims.every(Number.isFinite)||dims.some(v=>v<=0))
  throw Error('Valid model box, viewport aspect and fov are required');
 const vf=Math.tan(fovDegrees*Math.PI/360),hf=vf*aspect;
 // From negative X, +Z (head) is screen-right, -Z (tail) screen-left.
 // Reserve margins for horn tips, animated tail curvature and orbit damping.
 const spanX=depth*.99+width*.22;
 const spanY=height*1.025+depth*.035;
 const requiredDistance=Math.max(
  4,spanX/(2*hf*.88),spanY/(2*vf*.78)
 );
 return Object.freeze({
  distance:requiredDistance,
  horizontalSpan:spanX,verticalSpan:spanY,
  horizontalFovRadians:2*Math.atan(hf),
  azimuth:'negative-x-side-head-right',
  direction:Object.freeze({x:-.96,y:.205,z:.115})
 });
}
