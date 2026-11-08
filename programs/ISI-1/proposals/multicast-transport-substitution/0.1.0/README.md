# Multicast delivery fabric transport substitution

Version 0.1.0, **PROPOSED**. This optional ISI-1 profile substitutes a
multicast delivery fabric for two transports in the joined transaction-service
path: the hop from the transaction-submission role to the transaction
processor, and the announcement and fetch path from the processor to the
proof-delivery role. Broadcaster, Teranode and Merkle Service run unmodified.
[ISI-1 decision 0002](../../../decisions/0002-executable-profiles.md) and its
retained evidence keep their meanings.

## Frozen references and scope

The reference set is BRCs commit `99ee33ea5980313a5c2b01a02a1e42569d981fd6`:

| Boundary | Frozen reference | Scope |
| --- | --- | --- |
| Transaction payload | [BRC-30](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0030.md) | Extended Format, preserved end to end |
| Transaction frames | [BRC-124](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0124.md), [BRC-128](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0128.md), [BRC-129](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0129.md), [BRC-130](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0130.md) | Framing, group addressing and fragmentation on the fabric |
| Loss recovery | [BRC-126](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0126.md) | Per-flow sequence gaps, NACK, ACK and MISS |
| Processor objects | [BRC-143](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0143.md), [BRC-144](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0144.md) | Subtree and block objects pushed to delivery lanes |
| Headers | [BRC-135](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0135.md) | The 80-byte header lane, derived from proof-of-work-checked block objects |
| Proofs | [BRC-74](https://github.com/bsv-blockchain/BRCs/blob/99ee33ea5980313a5c2b01a02a1e42569d981fd6/transactions/0074.md) | The merkle path Broadcaster returns |

The substituted role is a transport. The submission, processing and proof
roles keep their pinned identities and their own transaction, block, and proof
semantics. The fabric components and the two landing bridges carry their own
digests:

| Component | Role in the profile | Source |
| --- | --- | --- |
| [arcade-bridge](https://github.com/lightwebinc/arcade-bridge) | Propagation facade for Broadcaster; subtree and block lane termination and announcement to Merkle Service; retrieval plane | A released tag, recorded in each run's evidence |
| [teranode-bridge](https://github.com/lightwebinc/teranode-bridge) | Transaction lane into Teranode propagation; reverse path from Teranode's blockchain notifications to BRC-143 and BRC-144 objects | A released tag, recorded in each run's evidence |
| Fabric ingress, delivery edge and retransmission | Framing, multicast delivery, lane delivery, BRC-126 repair | The tagged releases locked in [`multicast-test/tpnil/components.lock.json`](https://github.com/lightwebinc/multicast-test/blob/8e553bf81e55484dfb10431ae1e7da63f061dd3c/tpnil/components.lock.json) |

## Topology

```text
Broadcaster propagation ── POST /txs ──▶ facade ──▶ fabric ingress (BRC-124/128 frames)
                                                          │ multicast fabric (BRC-126 repair)
Teranode propagation ◀── transaction lane ◀── delivery edge ◀┘

Teranode blockchain notifications ──▶ reverse path (BRC-143/144 objects) ──▶ fabric
Merkle Service ◀── announcement + fetch from the bridge ◀── subtree and block lanes ◀┘
```

## Configuration fidelity

A scored run uses a declared fabric-only configuration, so that every
observation is attributable to the fabric:

- Broadcaster lists the facade as its only datahub, with
  `p2p.datahub_discovery` disabled. Its stock propagation is otherwise
  unchanged.
- Merkle Service's libp2p client has no reachable peer: DHT and mDNS are
  disabled and its bootstrap peer is unreachable. Its announcement source is
  therefore the bridge's Kafka publication alone.

Each change is ordinary configuration and is retained in the run evidence with
its digest. A deployment's standing configuration keeps both stock paths as
backups; the profile measures the fabric path, not the backups.

## Relationship to decision 0002

Decision 0002 does not claim that its retained joined run used Teranode's
native peer-to-peer announcement service; its transaction-services profile
provides Teranode's block and subtree objects to Merkle Service. In this
profile the announcements
derive from the processor's own blockchain notifications. The bridge fetches
each subtree and block from the processor, pushes it through the fabric, and
announces it to Merkle Service with a retrieval location the bridge serves. The
announcement path is exercised end to end without a laboratory publisher.

## Proposed requirements

| ID | Origin | Required observation |
| --- | --- | --- |
| MTS-01 | laboratory-profile | The fabric-only configuration is verified before submission: Broadcaster's effective datahub list is the facade alone, and Merkle Service holds no libp2p peer. |
| MTS-02 | standard | Broadcaster's propagation of the fixture transaction reaches the facade, and the bytes delivered on the transaction lane equal the fixture's Extended Format bytes. |
| MTS-03 | laboratory-profile | Teranode accepts the delivered transaction, it reaches the mempool, and the controlled miner includes it in a block. |
| MTS-04 | laboratory-profile | The mined transaction's raw bytes equal the fixture's raw bytes. |
| MTS-05 | standard | The block's subtree objects and block object arrive on their lanes with identities equal to the processor's, and Merkle Service fetches them from the bridge's retrieval plane. |
| MTS-06 | laboratory-profile | Broadcaster receives a mined proof, and independent computation reproduces the merkle root of the header read from the processor. |
| MTS-07 | standard | The header delivered on the header lane equals the header read from the processor. |
| MTS-08 | standard | Under a declared loss impairment on the fabric segment, gaps are detected and repaired, MTS-02 to MTS-07 still hold, and no second financial effect occurs. |
| MTS-09 | laboratory-profile | Restoring the standing configuration returns both stock paths, and the run evidence records the restoration. |

## Evidence

The fabric's wire formats have retained component qualifications: twelve
`MULTICAST-FABRIC-*` harness plans covering 55 scenarios, and two
`MULTICAST-FRAME-VECTORS-*` plans that check a frame conformance corpus with
two independent oracles. They establish the transport's framing, delivery,
filtering, fragmentation, repair, bundling and object-lane behavior in an
isolated harness, and the agreement of the frames with the BRC text.

A joined run on the Lightweb Inc. laboratory on 2026-11-07 exercised the
profile with upstream's published images, unmodified and identified by digest:
Teranode v0.16.1-beta-7, BSV Broadcaster (formerly Arcade) v0.20.0 and Merkle
Service v0.6.3. It observed MTS-01 to MTS-07. For MTS-02 and MTS-05 it counts
delivery on each lane and shows byte identity end to end, through MTS-04 and
the proof root of MTS-06, rather than on the lane itself. MTS-08 and MTS-09 are
not yet assertions. Its bundle identifies laboratory addresses, so it is an
internal check, not a candidate for scoring. The scored run of MTS-01 to MTS-09
will use logical names and the revisions agreed with the laboratory, and will
be submitted with its own retained bundle.

Teranode v0.16.1 requires its `grpc_admin_api_key` on every blockchain gRPC
method except Health. The reverse path's subscription therefore presents the
key, which teranode-bridge reads from a file. This is configuration of the
transport, not of the processor.

All results under this profile are `INFRASTRUCTURE_QUALIFICATION_ONLY`. The
profile introduces no SUT result and does not alter the claims of decision
0002.

## Provenance

Contributed by Lightweb Inc. under the Apache License, Version 2.0. Jeff
Harris of Lightweb Inc. authored the multicast specifications the profile
references: BRC-124, BRC-126, BRC-128 to BRC-130, BRC-135, BRC-143 and
BRC-144. BRC-30 and BRC-74 are referenced as published.
