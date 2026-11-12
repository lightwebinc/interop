import fs from 'node:fs';
import {register} from '../../synthesis/node_modules/tsx/dist/esm/api/index.mjs';
register();
const {Transaction}=await import('../../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js');
const {verifyPortableProofClosure}=await import('../frozen-descendant-source-d02414f/synthesis/src/wallet-lab/native/portability-proof.ts');
const root=new URL('../native-ci-42690318194/',import.meta.url);
const receipt={schema:'tpnil-native-portability-diagnosis@1',run:42690318194,source:'d02414f58d888e3d11913dedd888a3e5871bf29f',claim:'FAILED_ATTEMPT_DIAGNOSIS_ONLY',repetitions:[]};
for(const repetition of [1,2]){
 const read=name=>JSON.parse(fs.readFileSync(new URL(`repetition-${repetition}/evidence/${name}`,root)));
 const r=read('conformance/portability.json');const spent=r.destinationAfter.outputs.find(o=>`${o.txid}.${o.vout}`===r.outpoint);const row=r.destinationAfter.transactions.find(t=>t.transactionId===spent.spentBy);
 const later=read('native-transactions.json').flatMap(t=>{const tx=Transaction.fromHex(t.rawTxHex);return tx.inputs.some(i=>`${i.sourceTXID}.${i.sourceOutputIndex}`===r.outpoint)?[{txid:tx.id('hex'),rawBytes:tx.toBinary().length}]:[]});
 const datasets=[];for(const name of ['source','destination','destinationAfter']){const proof=await verifyPortableProofClosure(r[name]);datasets.push({name,transactions:r[name].transactions.length,outputs:r[name].outputs.length,provenTxs:r[name].provenTxs.length,provenTxReqs:r[name].provenTxReqs.length,verifiedSignedTxids:proof.verifiedTxids});}
 receipt.repetitions.push({repetition,result:r.result,assertions:r.assertions,ui:r.ui,coldReload:r.coldReload,outage:r.outage,readWindows:r.readWindows,datasets,spentOutput:{outpoint:r.outpoint,spendable:spent.spendable,spentBy:spent.spentBy,updated_at:spent.updated_at},spendingTransaction:Object.fromEntries(Object.entries(row).filter(([key])=>!['inputBEEF','description'].includes(key))),redemptionPresent:Boolean(r.redemption),actionRpc:r.replacementRpc.filter(x=>['createAction','processAction'].includes(x.method)),laterFinalStorageSpends:later,findings:['Frozen oracle2 rejected CSS-rendered IN USE because it required mixed-case In use; original outcome disagreement remains.','Final listOutputs absence reflects an unsigned createAction input lock, not serialized redemption; destinationAfter has no spending txid/raw transaction and replacement RPC has no processAction in the observed window.','Later final storage may contain the signed spend, but it cannot establish completion before source restoration.']});
}
fs.writeFileSync(new URL('./portability-diagnosis.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt.repetitions.map(r=>({repetition:r.repetition,spending:r.spendingTransaction,later:r.laterFinalStorageSpends,proof:r.datasets.map(d=>({name:d.name,count:d.verifiedSignedTxids.length}))}))));
