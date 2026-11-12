/**
 * Safe ruby/furigana display for manga dialogue. Display text and the
 * synthesized pronunciation remain separate. Never inject dialogue as HTML.
 * Any malformed token list falls back to the original subtitle unchanged.
 */
import {storyRubyTokens} from './story-pronunciations.js';
export function renderStoryRubyText(target,panel){
 const subtitle=String(panel?.subtitleText??panel?.text??'');
 const tokens=Array.isArray(panel?.rubyTokens)?panel.rubyTokens:storyRubyTokens(subtitle);
 if(tokens.map(t=>t?.text??'').join('')!==subtitle){
  target.textContent=subtitle;
  return Object.freeze({rubyCount:0,usedFallback:true});
 }
 const doc=target.ownerDocument;
 const parts=[];let rubyCount=0;
 for(const token of tokens){
  if(!token.text)continue;
  if(typeof token.ruby==='string'&&token.ruby.trim()){
   const ruby=doc.createElement('ruby');
   ruby.appendChild(doc.createTextNode(token.text));
   const reading=doc.createElement('rt');
   reading.textContent=token.ruby;
   reading.setAttribute('aria-hidden','true');
   ruby.appendChild(reading);
   parts.push(ruby);rubyCount++;
  }else parts.push(doc.createTextNode(token.text));
 }
 target.replaceChildren(...parts);
 return Object.freeze({rubyCount,usedFallback:false});
}
