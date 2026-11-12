# Preparation attempt42661306475

The frozen source `ec6cff827e6bc29d0c53951a5ed6a9cae72e724b` stopped before native admission. The official Yours release URL returned HTTP500 across all five download attempts. No image, wallet, repetition or native evidence artifact was created; the upload step consequently reported no files.

The original all-job logs ZIP, run/jobs metadata and empty artifact inventory are retained with file hashes in [the manifest](manifest.json). This is a preparation failure, not a wallet conformance result.

Read-only recovery downloaded the official public release again and independently obtained the same asset through GitHub's release-asset API. Both copies were13,513,123 bytes with SHA256 `d55abda7dc8790ecfdd57ed0f5f4dd4a28187bb4833715f7612b067625eabc52`. The preparation helper now has a bounded API fallback and commits a cache file only after digest verification. Subsequent native admission is separately recorded; this failed sample remains unchanged.
