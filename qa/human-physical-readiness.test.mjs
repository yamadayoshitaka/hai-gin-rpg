import fs from 'node:fs';
import assert from 'node:assert/strict';
const contract=JSON.parse(fs.readFileSync(new URL('./human-motion-quality-contract.json',import.meta.url),'utf8'));
const results=[];
const check=(id,pass,detail)=>results.push({id,status:pass?'PASS':'FAIL',detail});
assert.equal(contract.units,'radians');
for(const [name,range] of Object.entries(contract.joints)){
 check('joint-range:'+name,Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min<range.max,'Data-defined finite joint limits');
}
for(const action of ['walk','run']){
 const value=contract.contact[action];
 check('ground-contact:'+action,!!value&&value.required===true&&value.mode!=='IK_NOT_IMPLEMENTED'&&value.mode!=='UNVERIFIED','Foot plant/IK runtime evidence required: '+(value?.mode||'missing'));
}
const grip=contract.equipment.grip;
check('weapon-grip-verification',!!grip&&grip.required===true&&grip.mode!=='HAND_TARGET_NOT_VERIFIED'&&grip.mode!=='UNVERIFIED','Hand target verification mode: '+(grip?.mode||'missing'));
const report={schemaVersion:1,scope:'human physical readiness',results,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length};
fs.mkdirSync('qa-reports',{recursive:true});
fs.writeFileSync('qa-reports/human-physical-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
