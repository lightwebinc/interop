# Prospective ancestry closure reference evidence

Both final reference-wallet runs pass all nine portability predicates, including source TCP outage, cold wallet reconstruction, exact task decryption and signed redemption. The archive retains each full report, independent verification, logs, Go build manifests and frozen source inputs. Its inventory is hashed per member and as a whole.

This is engineering evidence. It does not replace the exact unchanged native wallet run. Native attempt42680240116 remains failed and its old schema1 oracle is still replayed unchanged. The new schema2 proof oracle uses dataset bytes alone, requires the actual admitted mined root and independently verifies every owned signed transaction. The earlier Go preflight and transient shared TypeScript typecheck failure remain separately recorded.

For read-only replay, decompress `evidence.json.gz`, verify each member against its recorded size/SHA256, and run `verify-conformance-portability.mjs MEMBER --reference` on each final report. The focused proof test performs that same retained-evidence replay.
