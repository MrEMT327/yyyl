// Semantic presentation cues. Gains are final output gains, shared by both hosts.
// No victory/failure/warning or waiting loop: no suitable source clip confirmed.
export const FEEDBACK_SOUNDS = Object.freeze({
  wheelTick:{file:'ui/button_click.wav',gain:.065,interval:.09},
  wheelResult:{file:'ui/unlock_sound.wav',gain:.14,interval:.4},
  upgrade:{file:'upgrade_sound.wav',gain:.209,interval:.4},
  choice:{file:'upgrade_sound.wav',gain:.16,interval:.25},
  breakthrough:{file:'ui/unlock_sound.wav',gain:.14,interval:.4},
  boxReveal:{file:'ui/confirm_sound.wav',gain:.075,interval:.25},
  rareReveal:{file:'ui/unlock_sound.wav',gain:.14,interval:.4},
  drawCharge:{file:'ui/combine_sound.wav',gain:.16,interval:.4},
  drawReveal:{file:'ui/unlock_sound.wav',gain:.14,interval:.4},
  reward:{file:'pickup_sound.wav',gain:.085,interval:.18},
});
export const feedbackAudioManifest=Object.fromEntries(Object.entries(FEEDBACK_SOUNDS).map(([key,cue])=>[
  `feedback:${key}`,{url:`/audio/pathogenic/${cue.file}`}
]));
