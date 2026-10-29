import { ARSENAL } from './airframe-arsenal.js';
export const FIXED_PARTS = Object.freeze({
  prism: {part:'W05',name:'三棱光束炮'}, tesla: {part:'W08',name:'电弧分叉器'},
  missile: {part:'W04',name:'蜂群导弹舱'}, bridge:{part:'C04',name:'桥接连接器'},
  twin: { part:'W01', name:'双联机炮' }, rail: { part:'W02', name:'长钉轨道炮' },
  capacitor: { part:'C02', name:'储能连接器' }, focus: { part:'C03', name:'聚焦连接器' },
});
export const fixedPartName = itemId => ARSENAL[itemId]?.name || FIXED_PARTS[itemId]?.name || itemId;
export const fixedPartIcon = part => Object.keys(FIXED_PARTS).find(id=>FIXED_PARTS[id].part===part);
