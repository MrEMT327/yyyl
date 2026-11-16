/** Proven values belong ONLY to the original game's compatibility_setup().
 * Missing main.scn fields remain explicit engine-reference defaults, not recovered
 * project settings. This profile must never be labelled Forward+ or 1:1 certified.
 */
export const PATHOGENIC_DISPLAY_PROFILE={
  renderer:'compatibility' as const,workingSpace:'srgb' as const,
  hdr:true,glowEnabled:true,tonemapper:'linear' as const,
  intensity:1.7,threshold:.9,
  scale:2,bloom:0,cap:12,exposure:1,
  evidence:{
    observed:'scn/main.gd:424-440: compatibility_setup + update_postprocessing_quality',
    observedFields:['intensity','threshold','tonemapper','glowEnabled'],
    engineReferenceDefaults:['scale','bloom','cap','exposure'],
    unresolved:['project.binary','main.scn Environment','original runtime renderer and screenshots'],
    parityCertified:false,
  },
};
export type PathogenicDisplayProfile=typeof PATHOGENIC_DISPLAY_PROFILE;
