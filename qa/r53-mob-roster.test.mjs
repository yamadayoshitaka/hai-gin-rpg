import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const mob=read('data/r53-mob-roster.json'),cast=read('data/r53-cast-reference-map.json');
assert.equal(cast.castRoster.length,22);
assert.equal(mob.mobs.length,20);
const ids=new Set(cast.castRoster.map(r=>r.id)),faces=new Set();
for(const r of mob.mobs){assert(!ids.has(r.id));ids.add(r.id);assert(!faces.has(r.faceCandidate));faces.add(r.faceCandidate);assert(r.id.startsWith('mob_'+r.sex+'_'));assert(r.faceCandidate.startsWith(r.sex+'_face_'));assert(mob.bodyTypes.includes(r.build));assert(mob.ageCohorts.includes(r.ageCohort));assert.equal(r.bodyCandidate,r.sex+'_'+r.ageCohort+'_'+r.build);assert.equal(r.visualApproved,false);assert.equal(r.integratedGLB,false);}
for(const sex of ['female','male']){const a=mob.mobs.filter(r=>r.sex===sex);assert.equal(a.length,10);assert.equal(new Set(a.map(r=>r.build)).size,5);}
console.log('22 named character IDs + 20 separate NPC IDs; five builds per sex; candidates only.');
