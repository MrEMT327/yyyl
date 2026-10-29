// Measured from each current player's transparent square capture.
// Padding leaves room for motion; these settings frame the existing artwork,
// never modify the source camera, rig, proportions or animation.
const profile=(bounds,headY,groundX,groundY,catalogHeight=80,displayScale=1)=>Object.freeze({bounds:Object.freeze(bounds),headY,groundX,groundY,catalogHeight,displayScale});
export const PORTRAIT_FRAMING=Object.freeze({
  'pilot-07':profile([.290,.030,.760,.980],.049,.624,.956),
  'pilot-09':profile([.365,.020,.755,.980],.037,.590,.963),
  // Seated subject scale aligned with the other pilots; retain the measured motion bounds.
  'pilot-01':profile([.225,.105,.892,.914],.131,.560,.895,80,.96),
  'pilot-02':profile([.300,.005,.665,.990],.011,.524,.984),
  'pilot-03':profile([.160,.005,.840,.955],.013,.538,.945),
  // Bare-foot contact in the current export; the train extends below it.
  'pilot-04':profile([.068,.020,.937,.973],.023,.500,.946,76),
  'pilot-05':profile([.270,.055,.680,.955],.066,.441,.944),
  'pilot-06':profile([.320,.055,.680,.940],.066,.499,.928),
  'pilot-08':profile([.040,.020,.870,.890],.105,.455,.848,76),
  // Align the motorcycle's wheel contact, leaving the rider's heel in front.
  'pilot-10':profile([.150,.070,.860,.990],.083,.500,.900,76),
  'commander-silver':profile([.040,.060,.950,.930],.078,.522,.914),
});

export function portraitFramingVariables(id){
  const p=PORTRAIT_FRAMING[id];if(!p)return null;
  const [left,top,right,bottom]=p.bounds;
  return {
    '--portrait-visible-width':right-left,'--portrait-visible-height':bottom-top,
    '--portrait-center-x':(left+right)/2,'--portrait-center-y':(top+bottom)/2,
    '--portrait-head-y':p.headY,'--portrait-body-rise':bottom-p.headY,
    '--portrait-ground-x':p.groundX,'--portrait-ground-y':p.groundY,
    '--portrait-ground-rise':p.groundY-p.headY,'--portrait-catalog-height':p.catalogHeight,
    '--portrait-display-scale':p.displayScale,
  };
}
export function portraitFramingStyle(id){
  const values=portraitFramingVariables(id);
  return values?Object.entries(values).map(([key,value])=>`${key}:${Number(value.toFixed(6))}`).join(';'):'';
}
export function applyPortraitFraming(host,id){
  const values=portraitFramingVariables(id);
  host.toggleAttribute('data-portrait-framed',Boolean(values));
  if(values)for(const [key,value] of Object.entries(values))host.style.setProperty(key,String(value));
}
