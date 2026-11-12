# Native closure source preflight

The committed allocator source `c82b06b8d6ba657e3c973f87b58416493b0433e6`
passes 90 core tests, catalog checks, typecheck, five Python packaging tests and
293 synthesis tests with eight gated skips. This is `LAB_SELF_TEST_ONLY`;
no native wallet or qualification execution occurred.

The first frozen-source cache omitted the `.json` manifests beside the pinned
Go binaries. Both live Go tests failed with ENOENT before Go execution; 291
other tests passed and eight were skipped. The original failed log is retained.
After linking the unchanged manifests, both affected suites passed all 14
tests. The complete prepared suite then passed all 293 tests. No source,
assertion or acceptance criterion changed to correct that setup error.

The manifest binds every original log and all ten unchanged native 2.0 plan
inputs. Subsequent component-only timestamp policy work receives its own
source and validation record before the next native dispatch.
