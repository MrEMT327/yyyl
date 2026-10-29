// Existing Girl Flight seven-day adaptation. Not the APK SignIn_SignIn table.
// Keep earned receipts and future local rewards stable during original-rule audits.
export const LOCAL_SIGNIN_POLICY_ID='girl-flight-signin-v1';
export const STARTER_PLANE = 10104; // Light bullets are Fire (Bullet400002.Element=2).
export const STARTER_PILOT = 40200; // FireDamageAdd%=10, autonomous hive missiles.
const item = (id,count) => ({kind:'item',id,count});
const unit = (kind,id) => ({kind,id,count:1});
export const FLIGHT_SIGNIN = [
  [item(2,100),item(1,1000)], [unit('skins',STARTER_PLANE)],
  [item(2,150)], [item(1,3000),item(106,10),item(109,10)],
  [item(2,200)], [item(105,10),item(107,10),item(108,10)],
  [item(2,300),item(1,5000),unit('pilots',STARTER_PILOT)],
];
Object.freeze(FLIGHT_SIGNIN);
