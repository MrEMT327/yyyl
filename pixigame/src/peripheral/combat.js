// Account passives wrap the existing weapon simulation without changing a
// weapon's timing, shape, contacts, quality rules, or growth choices.
export function applyPeripheralStats(runStats, snapshot) {
  const p = snapshot.stats.pilotModifiers || {};
  const r = snapshot.stats.researchModifiers || {};
  runStats.maxHp = snapshot.stats.maxHp;
  runStats.magnetRange *= p.pickupRadiusMultiplier || 1;
  runStats.xpMultiplier *= p.xpMultiplier || 1;
  runStats.damageTakenMultiplier *= p.damageTakenMultiplier || 1;
  runStats.damageTakenMultiplier *= 1 - (snapshot.stats.gearModifiers?.damageReduction || 0);
  if (r.collisionReduction) runStats.researchCollisionReduction = Math.min(.65, r.collisionReduction);
  if (r.projectileReduction) runStats.researchProjectileReduction = Math.min(.65, r.projectileReduction);
}

export function finalPeripheralDamage(amount, snapshot, { boss = false, elite = false, rng = Math.random } = {}) {
  const stats = snapshot?.stats, p = stats?.pilotModifiers || {}, research = stats?.researchModifiers || {};
  let result = amount * (stats?.attackMultiplier || 1);
  if (boss) result *= p.bossDamageMultiplier || 1;
  result *= 1 + (boss ? research.bossDamageBonus || 0 : elite ? research.eliteDamageBonus || 0 : 0);
  const critChance = Math.min(p.critChanceCap??1, (p.critChance || 0) + (research.critChance || 0));
  if (critChance && rng() < critChance) result *= 1.75 + (p.critMultiplierBonus || 0) + (research.critDamageBonus || 0);
  return result;
}

export function peripheralDodgeCooldown(seconds, snapshot) {
  return seconds * (snapshot?.stats.pilotModifiers?.dodgeCooldownMultiplier || 1);
}

export function updatePeripheralPassive(game, runStats, dt) {
  const p = game.peripheralSnapshot?.stats.pilotModifiers;
  if (!p || game.state !== 'playing') return;
  if (game.pilotBarrierTime > 0) {
    game.pilotBarrierTime = Math.max(0, game.pilotBarrierTime - dt);
    if (!game.pilotBarrierTime) game.pilotBarrierHp = 0;
  }
  game.peripheralPassiveTimers ||= {};
  for(const [type,interval] of [['heal',p.healInterval],['shield',p.shieldInterval]]) {
    if(!(interval>0))continue;
    let timer=game.peripheralPassiveTimers[type]??(!(p.healInterval&&p.shieldInterval)?game.peripheralPassiveTimer:undefined)??interval;
    timer-=dt;
    while(timer<=0) {
      timer+=interval;
      if(type==='heal')game.hp=Math.min(runStats.maxHp,game.hp+runStats.maxHp*p.healMaxHpRatio);
      else {
        const amount=runStats.maxHp*p.shieldMaxHpRatio;
        if(!(game.pilotBarrierTime>0)||amount>=(game.pilotBarrierHp||0)){
          game.pilotBarrierHp=amount;game.pilotBarrierTime=p.shieldDuration;
        }
      }
    }
    game.peripheralPassiveTimers[type]=timer;
  }
}

export function updatePeripheralAircraftAbilities(game,dt,onCast) {
  if(game.state!=='playing'||!(dt>0))return;
  game.pilotStealthTime=Math.max(0,(game.pilotStealthTime||0)-dt);
  game.peripheralAircraftTimers ||= {};
  for(const source of game.peripheralSnapshot?.stats.aircraftAbilities||[]) {
    const a=source.ability;
    // Missile, firing-floor and side-shot skills use the common weapon clock
    // and hit receipts. This clock owns only player-state abilities.
    if(!a||!['phase','heal','sanctuary'].includes(a.type)||!(a.interval>0))continue;
    let timer=(game.peripheralAircraftTimers[source.id]??a.interval)-dt;
    while(timer<=0){timer+=a.interval;onCast(source);}
    game.peripheralAircraftTimers[source.id]=timer;
  }
}
