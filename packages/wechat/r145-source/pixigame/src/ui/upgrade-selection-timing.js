// Local pre-show submission flow is retained. Show-relative events use the
// original binary32 keys rather than the old 60Hz export's delayed samples.
export const UPGRADE_SELECTION_TIMING=Object.freeze({
  normalCommit:400,gatherStart:400,reveal:600,
  first:600+0.03333333507180214*1000,
  breakthroughCommit:600+0.8500000238418579*1000,
  burst:600+0.9166666865348816*1000,
  hide:600+0.9333333373069763*1000,
  finish:600+1.1666666269302368*1000,
});
