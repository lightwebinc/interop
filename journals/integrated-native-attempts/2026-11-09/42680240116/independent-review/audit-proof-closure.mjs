import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {Beef,Transaction} from '../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js';
const root=path.resolve('out/native-ci-42680240116'),results=[];const hash=b=>createHash('sha256').update(b).digest('hex');
for(const repetition of [1,2]) {
 const base=path.join(root,`repetition-${repetition}/evidence`),report=JSON.parse(fs.readFileSync(path.join(base,'conformance/portability.json'))),fixture=JSON.parse(fs.readFileSync(path.join(base,'mined-funding-source.json'))).fixture;
 const sides=[];
 for(const side of ['source','destination']) {
  const dataset=report[side],union=new Beef(),inputs=[];
  for(const table of ['transactions','provenTxReqs'])for(const row of dataset[table]) {
   if(row.inputBEEF?.length) {const beef=Beef.fromBinary(row.inputBEEF);union.mergeBeef(beef);inputs.push({table,txid:row.txid,bytes:row.inputBEEF.length,sha256:hash(Buffer.from(row.inputBEEF)),proofs:beef.bumps.map(b=>({height:b.blockHeight,root:b.computeRoot()})),transactions:beef.txs.map(tx=>({txid:tx.txid,txidOnly:tx.isTxidOnly,hasProof:tx.hasProof}))});}
   if(row.rawTx?.length)union.mergeRawTx(row.rawTx);
  }
  const tracker={currentHeight:async()=>fixture.fundingHeight+fixture.maturityDepth,isValidRootForHeight:async(root,height)=>root===fixture.merkleRoot&&height===fixture.fundingHeight};
  const known=new Set(union.txs.map(x=>x.txid));const missing=[...new Set(union.txs.flatMap(x=>x.hasProof?[]:x.tx?.inputs.map(i=>i.sourceTXID)||[]).filter(x=>x&&!known.has(x)))];
  const signedTransactions=[];for(const row of dataset.provenTxReqs){const tx=Transaction.fromAtomicBEEF(union.toBinaryAtomic(row.txid));assert.equal(tx.toHex(),Transaction.fromBinary(row.rawTx).toHex());signedTransactions.push({txid:row.txid,verified:await tx.verify(tracker)});}
  assert.ok(signedTransactions.every(tx=>tx.verified));
  sides.push({side,signedTransactions,provenTxRows:dataset.provenTxs.length,inputBeef:inputs,union:{transactions:union.txs.length,proofs:union.bumps.length,containsPinnedMinedTransaction:known.has(fixture.txid),missingAncestorTxids:missing,structurallyValid:union.isValid(),pinnedRootVerified:await union.verify(tracker)}});
 }
 assert.deepEqual(sides[0].inputBeef,sides[1].inputBeef);assert.deepEqual(sides[0].union,sides[1].union);
 results.push({repetition,fixture,sides,conclusion:'The synchronized raw transactions plus retained inputBEEF reconstruct a complete, independently signed and pinned-root-verified proof graph. Native destination storage nevertheless cannot retrieve the mined ancestor by txid; proof bytes are retained but operational proof indexing/materialization is incomplete.'});
}
const receipt={schema:'tpnil-native-proof-closure-diagnostic@1',run:'42680240116',claim:'READ_ONLY_DIAGNOSTIC_NOT_QUALIFICATION',results};fs.mkdirSync('out/native-review-42680240116',{recursive:true});fs.writeFileSync('out/native-review-42680240116/proof-closure.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(results.map(r=>({repetition:r.repetition,sides:r.sides.map(s=>({side:s.side,provenTxRows:s.provenTxRows,union:s.union,nonemptyInputs:s.inputBeef.filter(i=>i.transactions.length||i.proofs.length)}))})),null,2));
