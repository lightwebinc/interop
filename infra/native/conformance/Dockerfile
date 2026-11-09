ARG TPNIL_INTEGRATED_BASE
FROM ${TPNIL_INTEGRATED_BASE}
USER root
COPY infra/native/conformance /work/infra/native/conformance
COPY programs/ISI-4/profiles/native-conformance-2.0.0 /work/programs/ISI-4/profiles/native-conformance-2.0.0
COPY programs/ISI-4/2.0.0 /work/programs/ISI-4/2.0.0
COPY itcves/ITCVE-1/1.4.0 /work/itcves/ITCVE-1/1.4.0
ENV TPNIL_NATIVE_CONFORMANCE=1 TPNIL_NATIVE_IDENTITY_TRUST=1
USER pwuser
