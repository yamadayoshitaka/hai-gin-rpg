import assert from 'node:assert/strict';
import {renderStoryRubyText} from '../src/story-ruby-display.js';
import {screenplayRubyTokens} from '../src/story-screenplay-v2.js';
class TestNode {
 constructor(name,ownerDocument){this.name=name;this.ownerDocument=ownerDocument;this.children=[];this.attributes={};this.value='';}
 set textContent(s){this.value=String(s);this.children=[];}
 get textContent(){return this.value+this.children.map(x=>x.textContent).join('');}
 appendChild(x){this.children.push(x);}
 replaceChildren(...xs){this.value='';this.children=xs;}
 setAttribute(k,v){this.attributes[k]=v;}
}
const doc={
 createElement(name){return new TestNode(name,doc)},
 createTextNode(value){const node=new TestNode('#text',doc);node.textContent=value;return node;}
};
const target=doc.createElement('p');
const sample='灰銀の軍師は松影の森と星鐘を調べる。';
let result=renderStoryRubyText(target,{subtitleText:sample,rubyTokens:screenplayRubyTokens(sample)});
assert.equal(result.usedFallback,false);
assert.ok(result.rubyCount>=3);
const rubies=target.children.filter(x=>x.name==='ruby');
assert.ok(rubies.some(x=>x.children[0].textContent==='軍師'&&x.children[1].textContent==='ぐんし'));
assert.ok(rubies.every(x=>x.children[1].attributes['aria-hidden']==='true'));
assert.ok(target.textContent.includes('灰銀'));
result=renderStoryRubyText(target,{subtitleText:'本来のセリフ',rubyTokens:[{text:'別のセリフ',ruby:null}]});
assert.equal(result.usedFallback,true);
assert.equal(target.textContent,'本来のセリフ');
result=renderStoryRubyText(target,{text:'<script>alert(1)</script>',rubyTokens:[{text:'<script>alert(1)</script>',ruby:null}]});
assert.equal(result.usedFallback,false);
assert.ok(target.children.every(x=>x.name==='#text'),'user text is never parsed as markup');
console.log('PASS manga ruby: visible readings, strict matching, safe text nodes, original subtitles');
