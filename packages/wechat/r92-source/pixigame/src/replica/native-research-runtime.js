import research from './native-research-runtime.json' with {type:'json'};
/** Supplement the old dependency export with the previously omitted research
 * skills. Original skill IDs and normalized trigger fields remain unchanged. */
export function withNativeResearchRuntime(runtime){
 return {...runtime,skillRows:{...runtime.skillRows,...research.skillRows},triggers:{...runtime.triggers,...research.triggers}};
}
