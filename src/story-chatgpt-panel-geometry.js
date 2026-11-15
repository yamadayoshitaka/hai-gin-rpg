/** Native size contract for ChatGPT-image provisional intake.
 * Stage 4 explicitly permits split 2-up panels with >=800x450 original pixels.
 * Do not upscale or relax the 16:9 ratio.
 */
const MINIMUM_BY_STAGE=Object.freeze({
  'c01-s02':Object.freeze([768,320]),
  'c01-s04':Object.freeze([800,450])
});
const DEFAULT_MINIMUM=Object.freeze([1536,864]);
export function minimumChatGPTPanelPixels(stageId){
  return MINIMUM_BY_STAGE[stageId]||DEFAULT_MINIMUM;
}
export function validChatGPTPanelGeometry(stageId,w,h){
  const [minW,minH]=minimumChatGPTPanelPixels(stageId);
  return Number.isInteger(w)&&Number.isInteger(h)&&
    w>=minW&&h>=minH&&w*9===h*16;
}
