// Three.js FileLoader emits ProgressEvent in Node 22 when source-geometry
// regression exercises async resources. Node has Event but not ProgressEvent.
if(typeof globalThis.ProgressEvent==='undefined'){
 globalThis.ProgressEvent=class ProgressEvent extends Event{
  constructor(type,{lengthComputable=false,loaded=0,total=0}={}){
   super(type);
   this.lengthComputable=Boolean(lengthComputable);
   this.loaded=Number.isFinite(loaded)?loaded:0;
   this.total=Number.isFinite(total)?total:0;
  }
 };
}
