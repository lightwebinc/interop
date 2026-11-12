# Native clause coverage review

This read-only review examines both unchanged reports from native run [42674638927](https://github.com/p2ppsr/interop/actions/runs/42674638927). The [original attempt archive](../../integrated-native-attempts/2026-11-09/42674638927/README.md) retains their exact bytes. This review neither changes verdicts nor establishes a new qualification.

[audit.json](audit.json) groups all 98 FAIL identifiers in each repetition, distinguishes direct malformed acceptance from rejected probes with working controls, and separates source-available laboratory scenarios from missing admitted interfaces or source interpretations. Exact inspected source hashes and pinned standard identity are retained. Native CWI is the default attribution: a Go backend alone does not prove that Go caused each observed behavior.

The two BLOCKED observations remain explicit: the noSendChange positive control receives a stale returned outpoint, and the comprehensive-coverage gate retains broader obligations. A possible future valid-input fixture must preserve the stale-return finding separately and prove pending-action visibility; it is not executed or scored here.
