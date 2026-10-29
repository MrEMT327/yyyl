import {buildDeckFocusedMachine} from './deck-focused-machines.js';

export const buildChapterEnemy = buildDeckFocusedMachine;

export function animateChapterEnemy(body,time,phase=1,charging=false) {
  const level=body.userData.singleFormBoss?0:Math.max(0,phase-1);
  body.traverse(part=>{
    if(!part.isGroup || part===body)return;
    const rest=part.userData.rest ??= {x:part.position.x,y:part.position.y,z:part.position.z};
    if(part.name.startsWith('machine-wing-')) {
      part.rotation.z=Math.sign(rest.x)*(Math.sin(time*1.5)*.035+(charging?.045:0));
    } else if(part.name.startsWith('deck-rotor-'))part.rotation.y=time*(charging?3:1.5);
    else if(part.name.startsWith('impeller-'))part.rotation.z=time*(charging?4:2);
    else if(part.name==='ufo-rim')part.rotation.y=time*.22;
    else if(part.name==='ufo-dome')part.position.y=rest.y+Math.sin(time*1.4)*.65;
    else if(part.name==='radar')part.rotation.y=time*.45;
    else if(part.name.startsWith('valve-'))part.rotation.y=Math.sin(time*.9)*.15+(charging?.25:0);
    else if(part.name.startsWith('satellite-')) {
      part.position.x=rest.x*(1+level*.12);part.position.z=rest.z*(1+level*.12);
      part.position.y=rest.y+Math.sin(time*1.3+rest.x)*2;
    } else if(part.name.startsWith('shutter-')) {
      part.position.x=rest.x+Math.sign(rest.x)*level*3;
      part.rotation.z=Math.sign(rest.x)*level*.14;
    } else if(part.name.startsWith('claw-'))part.rotation.y=Math.sign(rest.x)*(Math.sin(time*1.2)*.06+level*.12+(charging ? .12 : 0));
    else if(part.name.startsWith('cannon-'))part.position.z=rest.z+(charging?-2:0);
  });
}
