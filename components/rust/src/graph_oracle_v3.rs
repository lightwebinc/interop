//! Explicit corpus-v3 laboratory observer. No wallet/SDK implementation is patched.
//! rs-sdk's owned Transaction tree expands shared ancestry once and places shallow
//! copies on other edges. Resolve edges from this request's exact BEEF table instead
//! of treating each owned placement as an independently complete proof tree.
use std::collections::{HashMap, HashSet};
use bsv::transaction::{Beef, Transaction};
use bsv::script::spend::{Spend, SpendParams};
use serde_json::{json, Value};
use super::{s, unique_inputs};

fn index(beef: &Beef) -> Result<HashMap<String, Transaction>, String> {
    let mut graph = HashMap::new();
    let mut seen = HashSet::new();
    for row in &beef.txs {
        if !seen.insert(row.txid.clone()) { return Err("Duplicate BEEF transaction id".into()); }
        let Some(raw) = &row.tx else { continue }; // Reachable txid-only rows fail lookup.
        if raw.id().map_err(|e| e.to_string())? != row.txid { return Err("BEEF transaction id differs from raw transaction".into()); }
        let mut tx = raw.clone();
        tx.merkle_path = beef.find_bump(&row.txid).cloned();
        graph.insert(row.txid.clone(), tx);
    }
    Ok(graph)
}

fn source<'a>(graph: &'a HashMap<String, Transaction>, tx: &Transaction, input: usize) -> Result<&'a Transaction, String> {
    let id = tx.inputs[input].source_txid.as_ref().ok_or("Missing ancestor txid")?;
    let parent = graph.get(id).ok_or("Unanchored missing ancestor")?;
    if parent.id().map_err(|e| e.to_string())? != *id { return Err("Ancestor transaction id differs".into()); }
    Ok(parent)
}

fn input_spend(tx: &Transaction, input_index: usize, parent: &Transaction) -> Result<(bool,u64), String> {
    let input = &tx.inputs[input_index];
    let output = parent.outputs.get(input.source_output_index as usize).ok_or("Missing ancestor output")?;
    let value = output.satoshis.ok_or("Missing ancestor value")?;
    let mut spend = Spend::new(SpendParams {
        locking_script: output.locking_script.clone(),
        unlocking_script: input.unlocking_script.clone().ok_or("Missing ancestor signature")?,
        source_txid: parent.id().map_err(|e| e.to_string())?,
        source_output_index: input.source_output_index as usize, source_satoshis: value,
        transaction_version: tx.version, transaction_lock_time: tx.lock_time, transaction_sequence: input.sequence,
        other_inputs: tx.inputs.iter().enumerate().filter(|(i,_)| *i != input_index).map(|(_,x)| x.clone()).collect(),
        other_outputs: tx.outputs.clone(), input_index,
    });
    Ok((spend.validate().unwrap_or(false), value))
}

struct Walk<'a> {
    graph: &'a HashMap<String, Transaction>, root: &'a str, height: u32,
    // Cache the longest remaining path as well as validity. A shallow prior
    // visit must not let a later deep placement bypass the 64-edge boundary.
    verified: HashMap<String,usize>, visiting: HashSet<String>, spent: HashMap<(String,u32),String>,
}
impl Walk<'_> {
    fn anchored(&mut self, id: &str, depth: usize) -> Result<bool, String> {
        if depth > 64 { return Err("Ancestry depth exceeded".into()); }
        if self.visiting.contains(id) { return Err("Cyclic transaction ancestry".into()); }
        if let Some(remaining) = self.verified.get(id) {
            if depth + remaining > 64 { return Err("Ancestry depth exceeded".into()); }
            return Ok(true);
        }
        let tx = self.graph.get(id).ok_or("Unanchored missing ancestor")?;
        if tx.id().map_err(|e| e.to_string())? != id { return Err("Ancestor transaction id differs".into()); }
        if !unique_inputs(tx) { return Ok(false); }
        if let Some(proof) = &tx.merkle_path {
            let valid = proof.block_height == self.height && proof.compute_root(Some(id)).map_err(|e| e.to_string())? == self.root;
            if valid { self.verified.insert(id.to_owned(),0); }
            return Ok(valid);
        }
        if tx.inputs.is_empty() { return Ok(false); }
        self.visiting.insert(id.to_owned());
        let mut input_value = 0u64;
        let mut longest = 0usize;
        for (i,input) in tx.inputs.iter().enumerate() {
            let parent = source(self.graph, tx, i)?;
            let parent_id = parent.id().map_err(|e| e.to_string())?;
            if !self.anchored(&parent_id, depth+1)? { return Ok(false); }
            longest = longest.max(1 + self.verified[&parent_id]);
            let outpoint = (parent_id, input.source_output_index);
            if self.spent.get(&outpoint).is_some_and(|owner| owner != id) { return Ok(false); }
            self.spent.insert(outpoint, id.to_owned());
            let (valid,value) = input_spend(tx, i, parent)?;
            if !valid { return Ok(false); }
            input_value = input_value.checked_add(value).ok_or("Ancestor input overflow")?;
        }
        let output_value = tx.outputs.iter().try_fold(0u64, |sum,o| sum.checked_add(o.satoshis.unwrap_or(0))).ok_or("Ancestor output overflow")?;
        if input_value < output_value { return Ok(false); }
        self.visiting.remove(id);
        self.verified.insert(id.to_owned(),longest);
        Ok(true)
    }
}

pub fn spends(v: &Value) -> Result<Value, String> {
    let bytes = hex::decode(s(v,"hex")?).map_err(|e| e.to_string())?;
    let beef = Beef::from_binary_strict(&bytes).map_err(|e| e.to_string())?;
    let subject = s(v,"txid")?;
    let selected = beef.atomic_txid.as_deref().or_else(|| beef.txs.last().map(|row| row.txid.as_str())).ok_or("Empty BEEF")?;
    if selected != subject { return Err("Requested subject differs from BEEF subject".into()); }
    let root = s(v,"merkleRoot")?;
    let height = u32::try_from(v["height"].as_u64().ok_or("Missing anchor height")?).map_err(|_| "Anchor height exceeds u32")?;
    let graph = index(&beef)?;
    let tx = graph.get(subject).ok_or("Subject transaction absent or txid-only")?;
    let mut valid = vec![];
    let mut inputs = 0u64;
    for i in 0..tx.inputs.len() {
        let (ok,value) = input_spend(tx, i, source(&graph, tx, i)?)?;
        valid.push(ok);
        inputs = inputs.checked_add(value).ok_or("Input overflow")?;
    }
    let outputs = tx.outputs.iter().try_fold(0u64, |sum,o| sum.checked_add(o.satoshis.unwrap_or(0))).ok_or("Output overflow")?;
    let anchored = Walk { graph: &graph, root, height, verified: HashMap::new(), visiting: HashSet::new(), spent: HashMap::new() }.anchored(subject,0)?;
    Ok(json!({"valid":unique_inputs(tx) && !valid.is_empty() && valid.iter().all(|x| *x) && inputs>=outputs,
        "inputs":valid,"inputSatoshis":inputs,"outputSatoshis":outputs,"fee":inputs.checked_sub(outputs),"anchoredGraphValid":anchored}))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bsv::transaction::{TransactionInput, TransactionOutput, MerklePath, MerklePathLeaf};
    use bsv::script::{locking_script::LockingScript, unlocking_script::UnlockingScript};
    fn tx(inputs: &[(&Transaction,u32)], values: &[u64]) -> Transaction {
        let mut result = Transaction::new();
        result.inputs = inputs.iter().map(|(parent,vout)| TransactionInput {
            source_txid: Some(parent.id().unwrap()), source_output_index: *vout,
            unlocking_script: Some(UnlockingScript::from_hex("52").unwrap()), ..Default::default()
        }).collect();
        result.outputs = values.iter().map(|value| TransactionOutput {
            satoshis: Some(*value), locking_script: LockingScript::from_hex("5287").unwrap(), change: false
        }).collect();
        result
    }
    fn root() -> Transaction {
        let mut tx = tx(&[], &[1000]);
        tx.merkle_path = Some(MerklePath::new(7, vec![vec![MerklePathLeaf {
            offset: 0, hash: Some(tx.id().unwrap()), txid: true, duplicate: false
        }]]).unwrap());
        tx
    }
    fn pack(rows: &[Transaction], subject: &Transaction) -> (Beef,Value) {
        let mut beef = Beef::new(bsv::transaction::beef::BEEF_V2);
        for row in rows { beef.merge_transaction(row).unwrap(); }
        let request = request(&beef, subject, &rows[0].id().unwrap());
        (beef,request)
    }
    fn request(beef: &Beef, subject: &Transaction, root: &str) -> Value {
        json!({"op":"spends-indexed-v3","txid":subject.id().unwrap(),"hex":hex::encode(beef.to_binary_atomic(&subject.id().unwrap()).unwrap()),"merkleRoot":root,"height":7})
    }
    fn request_preserving_table(beef: &Beef, subject: &Transaction, root: &str) -> Value {
        let mut bytes=bsv::transaction::beef::ATOMIC_BEEF.to_le_bytes().to_vec();
        let mut id=hex::decode(subject.id().unwrap()).unwrap();id.reverse();bytes.extend(id);
        beef.to_binary(&mut bytes).unwrap();
        json!({"op":"spends-indexed-v3","txid":subject.id().unwrap(),"hex":hex::encode(bytes),"merkleRoot":root,"height":7})
    }
    fn dag(reverse: bool) -> (Vec<Transaction>,Transaction) {
        let r = root(); let a = tx(&[(&r,0)], &[400,400]); let b = tx(&[(&a,0)], &[300]);
        let subject = if reverse { tx(&[(&a,1),(&b,0)], &[600]) } else { tx(&[(&b,0),(&a,1)], &[600]) };
        (vec![r,a,b,subject.clone()],subject)
    }
    fn accepted(result: Result<Value,String>) -> bool {
        result.is_ok_and(|v| v["valid"] == true && v["anchoredGraphValid"] == true)
    }
    #[test]
    fn shared_dag_is_valid_in_both_input_orders_without_expanding_duplicate_trees() {
        for reverse in [false,true] {
            let (rows,subject) = dag(reverse); let (_,req) = pack(&rows,&subject);
            assert!(accepted(spends(&req)));
            if !reverse {
                let mut old = req.clone(); old["op"] = json!("spends");
                assert_eq!(crate::execute(&old).unwrap_err(),"Unanchored missing ancestor", "original observer2 failure must remain reproducible");
            }
        }
    }
    #[test]
    fn parsed_but_reordered_beef_table_has_the_same_graph() {
        let (rows,subject) = dag(false);let (_,req) = pack(&rows,&subject);
        let mut beef = Beef::from_binary_strict(&hex::decode(req["hex"].as_str().unwrap()).unwrap()).unwrap();
        beef.txs.reverse(); // Parsed BEEF preserves its supplied order on serialization.
        assert!(accepted(spends(&request_preserving_table(&beef,&subject,&rows[0].id().unwrap()))));
    }
    #[test]
    fn missing_and_txid_only_ancestor_cannot_borrow_from_another_request() {
        let (rows,subject) = dag(false);let (mut beef,_) = pack(&rows,&subject);
        let missing = rows[1].id().unwrap();beef.txs.retain(|row| row.txid != missing);
        assert!(!accepted(spends(&request(&beef,&subject,&rows[0].id().unwrap()))));
        beef.txs.push(bsv::transaction::beef_tx::BeefTx::from_txid(missing));
        assert!(!accepted(spends(&request(&beef,&subject,&rows[0].id().unwrap()))));
    }
    #[test]
    fn forged_ancestor_bytes_cannot_keep_the_old_transaction_identity() {
        let (rows,subject) = dag(false);let (mut beef,_) = pack(&rows,&subject);
        let row = beef.txs.iter_mut().find(|row| row.txid == rows[1].id().unwrap()).unwrap();
        row.tx.as_mut().unwrap().outputs[0].satoshis = Some(401);
        assert!(index(&beef).unwrap_err().contains("differs from raw"));
        assert!(!accepted(spends(&request(&beef,&subject,&rows[0].id().unwrap()))));
    }
    #[test]
    fn duplicate_beef_entries_are_rejected_instead_of_last_writer_winning() {
        let (rows,subject) = dag(false);let (_,req) = pack(&rows,&subject);
        let mut beef=Beef::from_binary_strict(&hex::decode(req["hex"].as_str().unwrap()).unwrap()).unwrap();
        beef.txs.push(beef.txs[0].clone());
        assert!(index(&beef).unwrap_err().contains("Duplicate"));
        assert!(!accepted(spends(&request_preserving_table(&beef,&subject,&rows[0].id().unwrap()))));
    }
    #[test]
    fn duplicate_subject_inputs_cannot_inflate_available_value() {
        let r=root();let subject=tx(&[(&r,0),(&r,0)],&[1500]);let (_,req)=pack(&[r,subject.clone()],&subject);
        assert!(!accepted(spends(&req)));
    }
    #[test]
    fn two_distinct_ancestors_cannot_spend_the_same_outpoint() {
        let r=root();let a=tx(&[(&r,0)],&[400]);let mut b=a.clone();b.lock_time=1;
        let subject=tx(&[(&a,0),(&b,0)],&[700]);let (_,req)=pack(&[r,a,b,subject.clone()],&subject);
        assert!(!accepted(spends(&req)));
    }
    #[test]
    fn malformed_subject_framing_and_height_are_rejected() {
        let (rows,subject)=dag(false);let (_,req)=pack(&rows,&subject);
        let mut wrong=req.clone();wrong["txid"]=json!(rows[0].id().unwrap());assert!(spends(&wrong).is_err());
        let mut trailing=req.clone();trailing["hex"]=json!(format!("{}00",req["hex"].as_str().unwrap()));assert!(spends(&trailing).is_err());
        for value in [json!(4294967303u64),json!(-1),json!(7.5)] { let mut bad=req.clone();bad["height"]=value;assert!(spends(&bad).is_err()); }
    }
    #[test]
    fn mutated_script_value_root_height_and_missing_output_do_not_pass() {
        let (rows,subject)=dag(false);let (_,req)=pack(&rows,&subject);
        for field in ["merkleRoot","height"] {let mut bad=req.clone();bad[field]=if field=="height"{json!(8)}else{json!("00".repeat(32))};assert!(!accepted(spends(&bad)));}
        let mut bad=subject.clone();bad.inputs[0].unlocking_script=Some(UnlockingScript::from_hex("53").unwrap());
        let (_,req)=pack(&[rows[0].clone(),rows[1].clone(),rows[2].clone(),bad.clone()],&bad);assert!(!accepted(spends(&req)));
        let mut bad=subject.clone();bad.outputs[0].satoshis=Some(701);
        let (_,req)=pack(&[rows[0].clone(),rows[1].clone(),rows[2].clone(),bad.clone()],&bad);assert!(!accepted(spends(&req)));
        let mut bad=subject.clone();bad.inputs[0].source_output_index=99;
        let (_,req)=pack(&[rows[0].clone(),rows[1].clone(),rows[2].clone(),bad.clone()],&bad);assert!(spends(&req).is_err());
    }
    #[test]
    fn bad_ancestor_script_is_checked_even_when_subject_script_is_valid() {
        let r=root();let mut a=tx(&[(&r,0)],&[900]);a.inputs[0].unlocking_script=Some(UnlockingScript::from_hex("53").unwrap());
        let subject=tx(&[(&a,0)],&[800]);let (_,req)=pack(&[r,a,subject.clone()],&subject);
        let result=spends(&req).unwrap();assert_eq!(result["valid"],true);assert_eq!(result["anchoredGraphValid"],false);
    }
    #[test]
    fn ancestry_depth_limit_retains_the_original_64_edge_boundary() {
        for count in [64,65] {
            let mut rows=vec![root()];for _ in 0..count {rows.push(tx(&[(rows.last().unwrap(),0)],&[900]));}
            let subject=rows.last().unwrap().clone();let (_,req)=pack(&rows,&subject);
            if count==64 {assert!(accepted(spends(&req)));}else{assert!(spends(&req).unwrap_err().contains("depth exceeded"));}
        }
    }
    #[test]
    fn cycles_and_index_aliases_fail_closed() {
        // Hash-consistent Bitcoin transaction cycles cannot be constructed without
        // a hash fixed point. Exercise both defensive conditions independently.
        let r=root();let a=tx(&[(&r,0)],&[900]);let id=a.id().unwrap();let mut graph=HashMap::from([(id.clone(),a)]);
        let mut walk=Walk{graph:&graph,root:"",height:7,verified:HashMap::new(),visiting:HashSet::from([id.clone()]),spent:HashMap::new()};
        assert!(walk.anchored(&id,0).unwrap_err().contains("Cyclic"));
        let mut alias=graph.remove(&id).unwrap();alias.inputs[0].source_txid=Some(id.clone());graph.insert(id.clone(),alias);
        let mut walk=Walk{graph:&graph,root:"",height:7,verified:HashMap::new(),visiting:HashSet::new(),spent:HashMap::new()};
        assert!(walk.anchored(&id,0).unwrap_err().contains("transaction id differs"));
    }
    #[test]
    fn shallow_memoized_visits_do_not_hide_a_deep_dag_path() {
        // Each node keeps a spare output for the subject. Ancestor-first visits
        // prime the memo before reaching the 65-edge branch through the last.
        let mut rows=vec![root()];
        for n in 0..64 { rows.push(tx(&[(rows.last().unwrap(),0)],&[900-n,1])); }
        for reverse in [false,true] {
            let mut inputs:Vec<_>=rows.iter().skip(1).map(|tx|(tx,1)).collect();
            if reverse { inputs.reverse(); }
            let subject=tx(&inputs,&[1]);let mut all=rows.clone();all.push(subject.clone());
            let (_,req)=pack(&all,&subject);assert!(spends(&req).unwrap_err().contains("depth exceeded"));
        }
    }
}
