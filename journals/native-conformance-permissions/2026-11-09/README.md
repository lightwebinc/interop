# Native permission engineering preflight

The unchanged Yours Wallet 5.1.0 archive was exercised with fresh profiles in
headed macOS arm64 Chromium and controlled TypeScript services. The complete
scenario passed eight independent predicates across nine public CWI requests
and three visible permission decisions. No funding or transaction spending was
required. This local run does not qualify the Linux native profile: it uses the
engineering browser trust configuration and has no kernel isolation admission.

The first, headless attempt failed to start the extension service worker and is
retained. Subsequent fresh profiles verified actual UI denial both with and
without an explicit `seekPermission` argument. The final scenario granted a
protocol to one origin, rejected the same protocol at another origin, verified
that denial granted nothing and preserved the first origin's access, then
approved the second origin and verified cached access. Each UI operation retains
the displayed origin, protocol, screenshot bytes, pending-request barrier and
returned wallet result. Timeouts and transport errors are failures.

The historical V005 failure remains unchanged. Its alternate-origin request used
a different protocol without first establishing a grant and did not demonstrate
cross-origin grant isolation. These clean runs establish the prospective
experiment's feasibility; they do not determine why the historical requests
returned without recorded prompts or revise that evidence.

`provenance.json` binds the original reports, screenshots, admitted wallet ZIP,
local browser binary and executed observer files. `complete-scenario-runner.ts`
is the local diagnostic runner: copy it to `out/` before running with the
synthesis package's pinned `tsx` loader. It creates a fresh profile, uses only
public wallet/UI operations, and closes the browser and controlled services.
The reusable scenario and independent verifier are committed under
`synthesis/src/wallet-lab/native/`.
