import {ITEM_QUALITY_TIERS} from '../replica/item-display-quality.js';
import {nineSliceGeometry} from './nine-slice-geometry.js';
import {cloudAssetBase} from './cloud-asset-base.js';

const FRAME_SIZE=128;
const FRAME_SLICE=18;
export const slotTier=({qualityRank,qualityKnown})=>qualityKnown!==false&&Number.isInteger(qualityRank)
  ? ITEM_QUALITY_TIERS[qualityRank] : undefined;
export const quantity=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
export const rewardSlotFrameUrl=row=>`${cloudAssetBase}art/psd-equipment-v1/frame-${slotTier(row)?.color??'empty'}.png`;

export function rewardSlotAmount(value) {
  const count=quantity(value);
  const unit=count>=1e8?1e8:count>=1e4?1e4:1;
  return `${Math.floor(count/unit*10)/10}${unit===1e8?'亿':unit===1e4?'万':''}`;
}
// Match the PSD plate, centred art window and quantity style in reward-item-slot.css.
export function paintRewardItemSlot(surface, row, {x,y,size}, paintImage) {
  const frame=paintImage(surface,rewardSlotFrameUrl(row),x,y,size,size,false);
  frame.geometry.dispose();
  frame.geometry=nineSliceGeometry(size,size,FRAME_SIZE,FRAME_SIZE,FRAME_SLICE,size*FRAME_SLICE/FRAME_SIZE);

  const artWidth=size*.8,artHeight=size*.71;
  paintImage(surface,row.image,x+(size-artWidth)/2,y+(size-artHeight)/2,artWidth,artHeight);

  if(row.isNew){
    const newSize=Math.max(11,Math.min(15,size*.22));
    surface.text('新',x+size*.08,y+size*.07+newSize/2,{size:newSize,weight:800,color:'#fff0a8',outline:'#102234'});
  }
  if(row.showQuantity===false)return;
  const fontSize=Math.max(9,Math.min(16,size*.22));
  surface.text('×'+rewardSlotAmount(row.amount),x+size*.91,y+size*.94-fontSize*.4,{
    size:fontSize,weight:400,family:'PsdPopup,"Microsoft YaHei",sans-serif',
    color:'#fff3cd',outline:'#102234',align:'right',maxWidth:size*.84,
  });
}
