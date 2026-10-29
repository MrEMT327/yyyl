// Shared presentation only. The caller supplies its Canvas or GPU part adapter.
export function poseParts(ctx,e,time,charge,recoil,animate,part){
 const p=(...args)=>part(ctx,e,...args),wave=animate?Math.sin(time*1.8):0;
 if(e.family==='晶簇生态'){
  if(e.id==='crystal-dart'){
   p('wing',-12,-10,44,31,{pivotX:1,angle:-charge*.25});p('wing',12,-10,44,31,{pivotX:1,flip:true,angle:charge*.25});
   p('spike',0,43+recoil*9,13,48);
   p('body',0,-5,39,103);p('core',0,-9,18,25);
  }else if(e.id==='crystal-petal'){
   ctx.save();ctx.rotate(animate?time*.18:0);
   for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);p('petal',0,-17-charge*8,30,56,{pivotY:1});ctx.restore()}
   for(let i=0;i<3;i++){ctx.save();ctx.rotate(i*Math.PI*2/3+Math.PI/6);p('shard',0,-75-wave*2,10,24);ctx.restore()}
   ctx.restore();p('body',0,0,59,58);
  }else if(e.id==='crystal-guard'){
   p('lance',-47,30+recoil*8,33,107);p('lance',47,30+recoil*8,33,107);
   p('body',0,-8,128,106);
   p('shield',-78-charge*10,-3+wave*2,57,95);p('shield',78+charge*10,-3-wave*2,57,95);
  }else{
   p('crown',0,-32-charge*7,114,118,{pivotY:.9});
   p('crown',-43,-15,99,103,{pivotY:.9,angle:-.55-charge*.12});
   p('crown',43,-15,99,103,{pivotY:.9,angle:.55+charge*.12});
   p('fist',-103,42+wave*3-charge*10+recoil*14,70,103);p('fist',103,42-wave*3-charge*10+recoil*14,70,103,{flip:true});
   p('body',0,6,161,151);
  }
  if(e.id!=='crystal-dart'){
   ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.5})`;
   if(e.id==='crystal-petal')p('core',0,0,34,38);
   else if(e.id==='crystal-guard')p('core',0,-10,43,48);
   else p('core',0,0,65,68);
   ctx.restore();
  }
 }else if(e.id==='bio-moth'){
  const flap=animate?Math.sin(time*10)*.08:0;
  p('wing',-13,-7,77,55,{pivotX:1,pivotY:.62,angle:flap});
  p('wing',13,-7,77,55,{pivotX:1,pivotY:.62,flip:true,angle:-flap});
  p('limb',-18,10,17,36,{pivotY:.1,angle:wave*.07});p('limb',18,10,17,36,{pivotY:.1,flip:true,angle:-wave*.07});
  p('body',0,0,37,105);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.45})`;
  p('core',0,-15,20,30);ctx.restore();
 }else if(e.id==='bio-sac'){
  const breath=1+wave*.025+charge*.08-recoil*.07;
  p('limb',-35,7,40,36,{pivotX:1,angle:wave*.06});p('limb',35,7,40,36,{pivotX:1,flip:true,angle:-wave*.06});
  p('body',0,2,89,96);p('sac',0,-12,75*breath,75*breath);
  p('mouth',0,45-recoil*4,42,42);
 }else if(e.id==='bio-hunter'){
  const grip=charge*.2-recoil*.32;
  p('limb',-33,-14,30,43,{pivotX:.8,pivotY:.15,angle:wave*.035});
  p('limb',33,-14,30,43,{pivotX:.8,pivotY:.15,flip:true,angle:-wave*.035});
  p('claw',-39,0,58,86,{pivotX:.8,pivotY:.1,angle:grip});
  p('claw',39,0,58,86,{pivotX:.8,pivotY:.1,flip:true,angle:-grip});
  p('body',0,-8,105,113);
  const breath=1+wave*.015+charge*.04;
  p('core',0,-24,26*breath,34*breath);
 }else if(e.id==='bio-mother'){
  const flap=(animate?Math.sin(time*3.4)*.045:0)+charge*.09;
  p('wing',-20,-7,138,109,{pivotX:1,pivotY:.66,angle:flap});
  p('wing',20,-7,138,109,{pivotX:1,pivotY:.66,flip:true,angle:-flap});
  const breath=1+wave*.025+charge*.08-recoil*.065;
  p('sac',0,-34,98*breath,103*breath);
  p('mouth',-44,65-recoil*5,49,47);p('mouth',44,65-recoil*5,49,47,{flip:true});
  p('body',0,2,69,132);
 }else if(e.id==='ruin-wing'){
  const open=charge*5;
  p('wing',-23-open,-6+wave,71,56,{pivotX:1,pivotY:.58,angle:wave*.018});
  p('wing',23+open,-6-wave,71,56,{pivotX:1,pivotY:.58,flip:true,angle:-wave*.018});
  p('gun',-32,25-recoil*3,27,36);p('gun',32,25-recoil*3,27,36);
  p('body',0,0,60,78);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.55})`;
  p('core',0,-7-wave*.5,19,27);ctx.restore();
 }else if(e.id==='ruin-ring'){
  p('ring',0,0,110,115,{angle:animate?time*.32:0});
  p('shard',-69,-wave*2,16,41);p('shard',69,wave*2,16,41,{flip:true});
  p('gun',0,49-recoil*3,29,32);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.6})`;
  p('core',0,-wave,43,45);ctx.restore();
 }else if(e.id==='ruin-obelisk'){
  const open=charge*9;
  p('slab',-69-open,-8+wave*2,25,142);p('slab',69+open,-8-wave*2,25,142);
  p('gun',-55,47-recoil*4,35,42);p('gun',55,47-recoil*4,35,42);
  p('body',0,0,68,173);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.55})`;
  p('core',0,-4-wave,39,40);ctx.restore();
 }else if(e.id==='ruin-sentinel'){
  p('ring',0,0,226,225,{angle:animate?time*.16:0});
  for(let i=0;i<4;i++){
   ctx.save();ctx.rotate(i*Math.PI/2);
   p('slab',0,-112-charge*10,70,75);ctx.restore();
  }
  p('gun',-63,58-recoil*4,54,48);p('gun',63,58-recoil*4,54,48);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.5})`;
  p('core',0,-wave,104,109);ctx.restore();
 }else if(e.id==='polar-owl'){
  const flap=wave*.025+charge*.045;
  p('wing',-18,-8,80,63,{pivotX:1,pivotY:.53,angle:flap});
  p('wing',18,-8,80,63,{pivotX:1,pivotY:.53,flip:true,angle:-flap});
  p('body',0,-3,61,88);p('core',0,-9,18,26);p('gun',0,39-recoil*5,32,42);
 }else if(e.id==='polar-spike'){
  const fold=charge*.22;
  p('wing',-12,-15,42,27,{pivotX:1,pivotY:.6,angle:-fold});
  p('wing',12,-15,42,27,{pivotX:1,pivotY:.6,flip:true,angle:fold});
  p('gun',-18,19-recoil*3,9,47);p('gun',18,19-recoil*3,9,47);
  p('body',0,0,41,128);p('core',0,-19,12,31);
 }else if(e.id==='polar-warden'){
  const open=charge*10;
  p('gun',-48,45-recoil*9,43,99);p('gun',48,45-recoil*9,43,99);
  p('body',0,-7,132,130);
  p('shield',-82-open,-6,56,115);p('shield',82+open,-6,56,115,{flip:true});
  p('core',0,-18,35,36);
 }else if(e.id==='polar-fortress'){
  const open=charge*9;
  p('pod',-140-open,-4,50,134);p('pod',140+open,-4,50,134,{flip:true});
  p('body',0,0,270,212);
  for(const x of [-89,89])for(const y of [-45,76])p('gun',x,y-recoil*8,44,70);
  p('tower',0,-7,94,104);
 }else if(e.id==='water-ray'){
  const flap=wave*.035+charge*.05;
  p('wing',-18,5,72,68,{pivotX:1,pivotY:.65,angle:flap});
  p('wing',18,5,72,68,{pivotX:1,pivotY:.65,flip:true,angle:-flap});
  p('gun',-32,23-recoil*4,18,39);p('gun',32,23-recoil*4,18,39);
  p('body',0,-8,61,94);p('core',0,7,21,23);
 }else if(e.id==='water-turbine'){
  p('pod',-57,0,26,43);p('pod',57,0,26,43);
  p('rotor',0,-6,68,66,{angle:animate?time*3:0,pivotX:.49,pivotY:.5});
  p('ring',0,-6,108,107);p('gun',0,43-recoil*7,31,46);
 }else if(e.id==='water-clearer'){
  const reach=charge*13-recoil*8;
  p('arm',-47,-39+reach,103,115,{pivotX:.85,pivotY:.2});
  p('arm',47,-39+reach,103,115,{pivotX:.85,pivotY:.2,flip:true});
  p('body',0,-13,144,113);p('gun',0,57-recoil*8,60,61);p('core',0,-23,32,41);
 }else if(e.id==='water-pump'){
  const open=charge*8;
  p('tank',-138-open,0,52,112);p('tank',138+open,0,52,112,{flip:true});
  p('body',0,0,250,209);
  p('pump',-73,-charge*4,86,67);p('pump',73,-charge*4,86,67);
  p('gun',0,79-recoil*10,84,81);
 }else if(e.id==='industrial-drill'){
  const fold=charge*.18;
  p('arm',-28,-23,42,30,{pivotX:1,angle:-fold});p('arm',28,-23,42,30,{pivotX:1,flip:true,angle:fold});
  p('drill',0,31+charge*5,32,67);p('body',0,-25,72,75);p('core',0,-27,20,24);
 }else if(e.id==='industrial-boiler'){
  p('pod',-49,-4,50,34);p('pod',49,-4,50,34,{flip:true});
  p('body',0,0,106,100);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.65})`;
  p('core',0,-22,38,38);ctx.restore();
  p('gun',0,24-recoil*8,58,65);
 }else if(e.id==='industrial-pincer'){
  const swing=wave*.012+charge*.17-recoil*.25;
  p('arm',-42,-41,110,115,{pivotX:.86,pivotY:.24,angle:swing});
  p('arm',42,-41,110,115,{pivotX:.86,pivotY:.24,flip:true,angle:-swing});
  p('body',0,-10,136,119);p('gun',0,53-recoil*7,49,63);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.5})`;
  p('core',0,-18,49,47);ctx.restore();
 }else if(e.id==='industrial-foundry'){
  const open=charge*9;
  p('pod',-128-open,-5,60,140);p('pod',128+open,-5,60,140,{flip:true});
  p('body',0,0,246,199);
  p('gun',-62,79-recoil*9,72,75);p('gun',62,79-recoil*9,72,75);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.55})`;
  p('core',0,-24,104,103);ctx.restore();
 }else if(e.id==='forest-leaf'){
  const opening=wave*.025+charge*.06;
  p('wing',-12,-12,84,47,{pivotX:1,pivotY:.25,angle:-opening});
  p('wing',12,-12,84,47,{pivotX:1,pivotY:.25,flip:true,angle:opening});
  p('gun',-33,29-recoil*5,18,36);p('gun',33,29-recoil*5,18,36);
  p('body',0,0,56,100);p('core',0,-10,19,31);
 }else if(e.id==='forest-stinger'){
  const fold=charge*.25+wave*.018;
  p('wing',-9,-17,53,27,{pivotX:1,pivotY:.35,angle:-fold});
  p('wing',9,-17,53,27,{pivotX:1,pivotY:.35,flip:true,angle:fold});
  p('gun',-19,19-recoil*4,11,47);p('gun',19,19-recoil*4,11,47);
  p('body',0,0,44,124);p('core',0,-33,18,27);
 }else if(e.id==='forest-mantis'){
  const swing=wave*.018+charge*.2-recoil*.28;
  p('arm',-40,-47,109,129,{pivotX:.85,pivotY:.14,angle:swing});
  p('arm',40,-47,109,129,{pivotX:.85,pivotY:.14,flip:true,angle:-swing});
  p('body',0,-7,91,156);
  p('gun',0,51-recoil*7,42,70);p('core',0,-20,38,42);
 }else if(e.id==='forest-falcon'){
  const spread=wave*.018+charge*.085;
  p('wing',-37,-35,139,87,{pivotX:1,pivotY:.4,angle:spread});
  p('wing',37,-35,139,87,{pivotX:1,pivotY:.4,flip:true,angle:-spread});
  p('body',0,0,114,176);
  p('gun',-54,61-recoil*9,53,75);p('gun',54,61-recoil*9,53,75);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.4})`;
  p('core',0,-7-wave*.5,40,63);ctx.restore();
 }else if(e.id==='alien-saucer'){
  p('gun',0,43-recoil*3,27,36);
  p('body',0,0,120,118);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.65})`;
  p('core',0,-2-wave*.8,40,41);ctx.restore();
 }else if(e.id==='alien-triangle'){
  const open=charge*7;
  p('wing',-62-open,-11,50,56,{angle:-charge*.06});p('wing',62+open,-11,50,56,{flip:true,angle:charge*.06});
  p('gun',0,43-recoil*3,23,36);p('body',0,0,104,98);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.5})`;
  p('core',0,-6-wave*.5,29,29);ctx.restore();
 }else if(e.id==='alien-trilobe'){
  p('body',0,0,160,150,{pivotY:.61});
  for(let i=0;i<3;i++){
   ctx.save();ctx.rotate(i*Math.PI*2/3);
   p('petal',0,-20-charge*10,116,92,{pivotY:1});ctx.restore();
  }
  for(const [x,y] of [[-58,35],[0,63],[58,35]])p('gun',x,y-recoil*5,30,44);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.55})`;
  p('core',0,-2-wave*.8,57,58);ctx.restore();
 }else if(e.id==='alien-mothership'){
  p('strut',0,0,28,230);p('strut',0,0,28,230,{angle:Math.PI/2});
  p('ring',0,0,260,256,{angle:wave*.012});
  for(const side of [-1,1])for(const y of [-63,63])p('gun',side*(115+charge*9),y-recoil*6,50,66);
  ctx.save();if(charge)ctx.filter=(ctx.filter==='none'?'':ctx.filter+' ')+`brightness(${1+charge*.6})`;
  p('core',0,-2-wave,96,97);ctx.restore();
 }else if(e.id==='city-patrol'){
  p('body',0,0,112,110);
  for(const x of [-44,44])for(const y of [-42,42]){
   p('ring',x,y,50,50,{pivotX:.47,pivotY:.487});
   p('rotor',x,y,32,32,{angle:animate?time*12*Math.sign(x*y):0});
  }
  p('gun',0,35-recoil*5,25,36);
 }else if(e.id==='city-blade'){
  const fold=charge*.12;
  p('wing',-18,-4,82,69,{pivotX:1,pivotY:.8,angle:fold});p('wing',18,-4,82,69,{flip:true,pivotX:1,pivotY:.8,angle:-fold});
  p('gun',-21,29-recoil*3,14,24);p('gun',21,29-recoil*3,14,24);
  p('body',0,0,39,130);p('core',0,-4,12,25);
 }else if(e.id==='city-warden'){
  const open=charge*8;
  p('arm',-85-open,-4,90,83);p('arm',85+open,-4,90,83,{flip:true});
  p('gun',-84-open,40-recoil*8,40,86);p('gun',84+open,40-recoil*8,40,86);
  p('body',0,-8,154,140);p('core',0,-21,37,38);
 }else if(e.id==='city-suppressor'){
  const open=charge*12;
  p('wing',-111-open,-11,120,99);p('wing',111+open,-11,120,99,{flip:true});
  p('body',0,0,190,146);
  p('gun',-90,40-recoil*9,57,72);p('gun',90,40-recoil*9,57,72);
  p('tower',0,-34,49,67);
 }else if(e.id==='naval-swallow'){
  p('wing',-45,-6,90,71,{angle:-wave*.012});p('wing',45,-6,90,71,{flip:true,angle:wave*.012});
  p('engine',-27,-30,21,40);p('engine',27,-30,21,40);
  p('body',0,0,45,119);p('core',wave*.25,16,14,26);
 }else if(e.id==='naval-gunboat'){
  p('engine',-38,-42,20,37);p('engine',38,-42,20,37);
  p('bridge',0,-10,118,43);
  p('hull',-38,0,36,103);p('hull',38,0,36,103);
  p('barrel',0,26-recoil*7,12,27);
  p('turret',0,-5-recoil*1.5,48,44);
 }else if(e.id==='naval-escort'){
  p('bridge',0,-30,190,101);
  p('hull',-70,0,60,236);p('hull',70,0,60,236);
  p('tower',0,-38,37,66);
  p('gun',-70,28-recoil*7,55,78);p('gun',70,28-recoil*7,55,78);
 }else if(e.id==='naval-carrier'){
  const extension=charge*6;
  p('pod',-112-extension,-3,55,186);p('pod',112+extension,-3,55,186,{flip:true});
  p('body',0,0,190,280);
  for(const x of [-112,112])for(const y of [-37,53])p('gun',x,y-recoil*7,42,54);
  p('tower',48,-54,52,70);
 }else if(e.id==='bone-scout'){
  p('wing',-35,-8,91,59,{angle:-wave*.025});p('wing',35,-8,91,59,{flip:true,angle:wave*.025});
  p('body',0,0,44,93);p('core',wave*.5,-12,18,27);
 }else if(e.id==='bone-dart'){
  p('engine',0,-62,25,45+charge*5);
  p('wing',-25,-28,50,37,{angle:charge*.2-wave*.015});p('wing',25,-28,50,37,{flip:true,angle:-charge*.2+wave*.015});
  p('body',0,0,45,133);
 }else if(e.id==='bone-guard'){
  const opening=wave*.025+charge*.24-recoil*.1;
  p('arm',-48,-53,145,166,{pivotX:.87,pivotY:.25,angle:opening});
  p('arm',48,-53,145,166,{pivotX:.87,pivotY:.25,flip:true,angle:-opening});
  p('gun',-49,41-recoil*8,36,64);p('gun',49,41-recoil*8,36,64);
  p('body',0,-6,151,162);p('core',0,-10-wave*.6,33,50);
 }else{
  const opening=wave*.035+charge*.06;
  p('wing',-100,-14,190,165,{angle:-opening});p('wing',100,-14,190,165,{flip:true,angle:opening});
  p('gun',-67,54-recoil*11,60,105);p('gun',67,54-recoil*11,60,105);
  p('body',0,-4,128,245);p('core',0,-27-wave*1.4,43,58);
 }
}
