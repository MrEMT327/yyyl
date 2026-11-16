export type FeedbackKey = 'upgrade'|'wheelTick'|'wheelResult'|'choice'|'breakthrough'|'boxReveal'|'rareReveal'|'drawCharge'|'drawReveal'|'reward';
export const FEEDBACK_SOUNDS: Readonly<Record<FeedbackKey,{file:string;gain:number;interval:number}>>;
export const feedbackAudioManifest: Record<string,{url:string}>;
