# BRC-22 submit boundary vectors

Version 0.1.0, **PROPOSED**. This optional ISI-2 input supplies frozen vectors
for the submission boundary that ISI-2 V002 and V006 exercise. The ISI-2 0.1.0
catalog and its draft vectors retain their existing meanings.

## Frozen references and scope

The reference is BRCs commit `99ee33ea5980313a5c2b01a02a1e42569d981fd6`,
specifically [BRC-22](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/overlays/0022.md).
[`vectors.json`](vectors.json) records each case, its classification, the
clause it rests on, its applicability, the evidence a run retains, its proposed
ISI-2 use, and the observed behavior of three implementations at pinned
commits:

| Implementation | Role | Pinned revision |
| --- | --- | --- |
| [go-overlay-services](https://github.com/bsv-blockchain/go-overlay-services/tree/b77904e276ea16558e8f7f3a104a8472b95586af) v1.3.8 | Server | `b77904e276ea16558e8f7f3a104a8472b95586af` |
| [overlay-express](https://github.com/bsv-blockchain/ts-stack/tree/52d36a5ab1ae7cb9e3243ff4147558bcccde3c07/packages/overlays/overlay-express) in ts-stack | Server | `52d36a5ab1ae7cb9e3243ff4147558bcccde3c07` |
| [go-sdk](https://github.com/bsv-blockchain/go-sdk/tree/cc1ba64c171885bd4338d83648f55f43ccf2dc56) `HTTPSOverlayBroadcastFacilitator` | Client | `cc1ba64c171885bd4338d83648f55f43ccf2dc56` |

The file also states the setup and teardown every vector shares and names the
runtime qualification. The go-overlay-services revision is the one ITCVE-1
1.1.0 selects. Its observations are runtime observations: the harness
`tests/tpnil/brc22` in
[lightwebinc/overlay-bridge](https://github.com/lightwebinc/overlay-bridge/tree/2bf3faca12c0b2b25ff3b941083cea2e529f1fca/tests/tpnil/brc22)
sends every vector through the server's own HTTP routes, under both
`RegisterRoutes` and `RegisterRoutesWithErrorHandler`, in front of an engine
that records the topics it is handed, and points the go-sdk client at the
running server. Each observation keeps its file and line reference. The run is
retained as the component qualification `OVERLAY-BRC22-SUBMIT-BOUNDARY-GO`: the
plan is `infra/plans/overlay-brc22-submit-boundary-go.json`, which names this
`vectors.json` as a digest-bound input through `${LAB_ROOT}`, and its evidence
is under
`journals/component-qualification/2026-11-07/overlay-brc22-submit-boundary-go/`.
The overlay-express observations are source observations; runtime confirmation
there remains the work of the vectors that adopt these cases.

## Classifications

- **standard**: BRC-22 states the required behavior. The vector carries an
  independent expected result derived from the cited clause.
- **extension**: a behavior BRC-22 does not define that both servers provide.
  It is recorded so a substitution matrix does not mistake it for a
  requirement.
- **open-interpretation**: BRC-22 is silent and the implementations differ.
  These cases need a laboratory interpretation before any of them is scored.

## Findings

| Vector | Classification | Observation |
| --- | --- | --- |
| `brc22.topics.json-array` | standard | Both servers accept the specified JSON array, and the go-sdk client sends it. |
| `brc22.topics.comma-list` | extension | Both servers also accept a comma-separated list. |
| `brc22.topics.whitespace-in-json-elements` | open-interpretation | go-overlay-services trims each topic name; overlay-express passes JSON elements through unchanged. |
| `brc22.topics.empty-entry` | open-interpretation | go-overlay-services drops empty entries; overlay-express rejects the request. |
| `brc22.topics.duplicate` | open-interpretation | go-overlay-services removes duplicates; overlay-express forwards the list as sent. |
| `brc22.topics.empty-array` | open-interpretation | go-overlay-services rejects an empty list; overlay-express forwards it to the engine. |
| `brc22.topics.non-string-element` | standard | Both servers reject a non-string element. go-overlay-services answers HTTP 400 under `RegisterRoutesWithErrorHandler` and HTTP 500 under `RegisterRoutes`, which keeps Fiber's default error handler. |
| `brc22.response.topic-keyed` | standard | overlay-express returns the topic-keyed object of step 5. go-overlay-services wraps the same map in an object under the key `STEAK`. |
| `brc22.response.client-decoding` | standard | Against go-overlay-services, the go-sdk client reads the wrapper key as a topic named `STEAK` and reports success with no admitted outputs and no error. |
| `brc22.response.ancillary-field-name` | extension | The ancillary transaction field is `ancillaryTxIDs` in go-overlay-services and `ancillaryTxids` in go-sdk. BRC-22 does not define it. |

The wrapped response is the one difference from a standard clause. The
status code of a rejected header depends on how a host registers the routes,
which a host using `RegisterRoutes`, as the ITCVE-1 1.1.0 host does, should
know. ITCVE-1
1.1.0 already maps go-overlay-services' envelope into the SDK-facing topic map
in its controlled host; these vectors state the underlying boundary so that a
substitution matrix can score a server or a client against BRC-22 itself
rather than against either implementation.

## Proposed use

| Vector set | Proposed ISI-2 use |
| --- | --- |
| standard vectors | V002 request and response assertions; V006 boundary inventory entries with independent expected results |
| extension vectors | V006 inventory entries recorded as supported or not supported, never as failures |
| open-interpretation vectors | Held out of scoring until a versioned laboratory interpretation fixes the expected result |

A submission of the BEEF bytes named by ISI-2 V002 with each header value, and
a read of each response body, would convert every source observation into a
runtime observation. The vectors use only the example topic names of BRC-22
and carry no transaction data.

## Provenance

Contributed by Lightweb Inc. under the Apache License, Version 2.0. The
observations were made while building an overlay bridge that submits
delivered BEEF objects to an overlay engine through BRC-22. An
earlier go-overlay-services release, v1.3.5, accepted only a comma-separated
list without trimming; v1.3.8 accepts both encodings, which is why the header
vectors now classify the comma list as an extension rather than a defect.
