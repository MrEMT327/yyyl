// Eight current airframes. Pilot identities are independent of this roster.
export const PILOT_FIGHTERS=Object.freeze({
  'pilot-01':'kestrel',
  'pilot-03':'crimson',
  'pilot-04':'azure',
  'pilot-05':'wraith',
  'pilot-07':'verdure',
  'pilot-08':'prism',
  'pilot-09':'bastion',
  'pilot-10':'auric',
});
export const currentAircraftId=id=>Object.hasOwn(PILOT_FIGHTERS,id)?id:'pilot-01';
