# ISI-4 3.0.0: native category permissions and change-outpoint contracts

This prospective major version retains the permanent eight vector identifiers
and strengthens V005, V007 and V008 in [ITCVE-1 1.5.0](../../../itcves/ITCVE-1/1.5.0/README.md).
V001–V004 keep version 1.0.0; V006 keeps version 2.0.0. The new
[catalog](catalog.json), environment profile, oracle manifests and native plan
must be frozen before execution. ISI-4 2.0.0 and its recorded results remain
separately reproducible.

V005 requires the existing eight same-request, cross-origin protocol predicates
and the new category/revocation predicates. Only visible native UI may approve,
deny or revoke grants. Basket results, selectively disclosed certificate fields
and signed spending transactions provide independent effects beyond a prompt or
successful call. Denial requires the matching pending request and a specified
permission response; timeouts or generic failures cannot satisfy it. Individual
revocation must preserve unrelated access, and origin-wide revocation must
preserve the other origin's grants. One-shot spending behavior is tested as
implemented, without inventing a saved allowance or finite-expiry UI.

V007 selects portability oracle 3. Source storage stays unavailable until the
replacement retains a signed task spend with complete proof ancestry and a
successful native `processAction` response. All intermediate dataset polls,
the final public task read and the final complete dataset are retained and
ordered before source restoration. A reserved input or unsigned action does
not establish completion. Exact rendered active-status lines allow ASCII case
and whitespace normalization; previous oracle 2 outcomes remain unchanged.

V008 selects clause oracle 4. Its inherited 232 identifiers remain and the new
`output.createAction.noSendChange-final-outpoints` predicate checks returned
change outpoints against final signed transaction bytes and matching public
wallet action metadata. Only the `noSendChange` positive caller fixture changes:
it uses independently established final change outputs rather than trusting the
returned value under test. The original returned value is retained and scored
separately. A successful valid-input control permits the one-field malformed
input to be evaluated; a failed control remains non-passing. This change cannot
retrospectively qualify an oracle 3 observation.

Any implemented failure keeps its vector FAIL. Remaining source obligations keep
comprehensive coverage BLOCKED even if every implemented predicate passes.
Secondary privileged keys, finite permission expiry, additional linkage
semantics, native byte-wire applicability, basket-length interpretation and
remaining conditional branches are not waived. `completeBRC100Conformance`
remains false. A qualified execution can establish reproducible failures and
blockers; it is not certification.
