/** Small JSON timeline shared by the LAN authority and local player.
 * Inputs change trajectory SPEED, never wind. Integral and derivative are exact
 * for a first-order throttle response, including braking to a full stop. */
export const FLIGHT_RESPONSE = 0.65;
export function flightTarget(c) {
 return c.cruise ? Math.max(0,Number(c.flightSpeed)||0)*(c.boost?2:1) : 0;
}
export function createFlightClock(c) {
 return {version:1,response:FLIGHT_RESPONSE,revision:0,events:[{time:0,phase:0,rate:0,target:flightTarget(c)}]};
}
export function evaluateFlightClock(clock,time,out={}) {
 const t=Math.max(0,Number(time)||0),events=clock.events;let e=events[0];
 for(let i=events.length-1;i>=0;i--)if(events[i].time<=t+1e-9){e=events[i];break;}
 const dt=Math.max(0,t-e.time),tau=clock.response||FLIGHT_RESPONSE,fall=Math.exp(-dt/tau);
 out.phase=e.phase+e.target*dt+(e.rate-e.target)*tau*(1-fall);
 out.rate=e.target+(e.rate-e.target)*fall;
 // Once stopped, complete the negligible integral tail and expose exact zero.
 if(e.target===0&&out.rate<1e-7){out.rate=0;out.phase=e.phase+e.rate*tau;}
 return out;
}
export function commandFlightClock(clock,time,c) {
 const target=flightTarget(c),last=clock.events.at(-1);if(target===last.target)return false;
 const t=Math.max(last.time,Math.max(0,time)),state=evaluateFlightClock(clock,t);
 const event={time:t,phase:state.phase,rate:state.rate,target};
 if(Math.abs(last.time-t)<1e-9)clock.events[clock.events.length-1]=event;else clock.events.push(event);
 if(clock.events.length>256)clock.events.splice(0,clock.events.length-256);
 clock.revision++;return true;
}
