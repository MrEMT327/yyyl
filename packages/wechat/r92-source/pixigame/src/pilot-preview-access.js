// Portrait review is opt-in and development-only. Normal startup always uses
// the saved roster; visiting a review never grants persistent ownership.
const REVIEW_PILOT_IDS=Object.freeze(['pilot-08','pilot-06','pilot-10','pilot-02','pilot-05','pilot-09','pilot-04']);
export function pilotPreviewAccess({development=import.meta.env?.DEV===true,search=globalThis.location?.search||''}={}){
  const requested=development?new URLSearchParams(search).get('preview-pilot'):null;
  return REVIEW_PILOT_IDS.includes(requested)
    ?{selected:requested,unlocked:[...REVIEW_PILOT_IDS]}
    :{selected:null,unlocked:[]};
}
