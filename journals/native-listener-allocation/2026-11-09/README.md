Foundation run 42705007019 failed the real TypeScript counterpart shutdown test with EADDRINUSE on 127.0.0.1:37329. The old allocator probed and released three ephemeral ports before actual listener startup. The logs prove the bind conflict, but do not identify whether it arose from duplicate selection or another allocation between probe and bind. The exact failed log remains unchanged.

The prospective correction eliminates probe/release allocation. Initial listeners bind port 0 and expose only their actual bound addresses. No retries or alternate provider mask an error. Native run 42705211560 was cancelled during image construction before either native execution step; the corrected runtime requires a separate frozen native qualification.

| Consumer | Readiness and preserved contract |
| --- | --- |
| Controlled HTTP services | Bind loopback port 0, read actual address before passing fixture URL to the Go host or syncing headers. |
| Go host | Existing pinned host already binds its own port 0 and reports an authenticated/admitted origin; forwarding and callback URL semantics remain unchanged. |
| Go storage forwarder | Bind loopback port 0, expose actual storage URL before authentication, counterparts or proxy routing. |
| TypeScript StorageServer | Initial options.port 0 passes directly to app.listen; read actual address after listening. Storage restart reuses the already published port and identity. |
| MITM HTTP proxy | Pinned proxy explicitly accepts port 0; native 127.0.0.1 and emulator 10.0.2.2 URLs share the ready bound port. Host binding remains 0.0.0.0. |
| MITM HTTPS/SNI and CA | Pinned proxy already binds HTTPS port 0 and records it in its readiness callback. Existing CA creation and TLS routing remain unchanged. |
| Storage outage/reopen | Reopen retains the published endpoint, rejects EADDRINUSE if occupied, and does not silently choose a replacement port. |
| Overlay lookup, WAB and counterpart targets | Existing externally supplied loopback ports and registration validation remain unchanged. |
| Failed startup and final shutdown | Existing awaited cleanup closes already bound providers; tests prove partial startup and all published endpoints close. |

Three new tests cover 12 real concurrent TypeScript/Go starts, at least 48 initial in-process listeners, authenticated storage, header/proxy routes, CA and emulator address publication, occupied-port failure, source restart identity, and cleanup. A deterministic spy asserts every initial listen receives port 0, so the old algorithm fails without needing a random collision. The final relevant batch passed 19 tests; typecheck passed. The first new-test attempt remains recorded as a test fixture typo (two failures calling the wrong outage method), not a runtime finding.
