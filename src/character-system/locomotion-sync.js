// One occupied tile is one footfall. A complete walk/run clip contains two
// alternating footfalls, so animation time must follow travelled distance,
// not a second independently advancing wall clock.
export function clipTimeForStepPhase(phase, duration){
  if(!Number.isFinite(phase)||!Number.isFinite(duration)||duration<=0)return 0;
  const cycle=2*Math.PI;
  return ((phase%cycle+cycle)%cycle)/cycle*duration;
}

// lowestFootY is already measured in model-parent coordinates, including the
// current model offset. Add the error to CURRENT height; rebuilding the target
// from baseline every frame incorrectly applies only half the correction.
export function groundedModelY(currentY, baselineY, restFootY, lowestFootY, height){
  if(![currentY,baselineY,restFootY,lowestFootY,height].every(Number.isFinite))return currentY;
  return Math.max(baselineY-height*.18,
    Math.min(baselineY+height*.24,currentY+restFootY-lowestFootY));
}

export function footfallAtPhase(phase){
  if(!Number.isFinite(phase))return {step:-1,progress:0};
  const stepFloat=Math.max(0,phase/Math.PI);
  const step=Math.floor(stepFloat);
  return {step,progress:stepFloat-step};
}

// Lock a planted foot only over its stance interval. Release during swing so
// the body cannot drag a foot anchor across a turn or a new grid cell.
export function footPlantWeight(progress){
  if(progress<0||progress>=.64)return 0;
  if(progress<.08)return progress/.08;
  if(progress<.42)return 1;
  return Math.max(0,(.64-progress)/.22);
}
