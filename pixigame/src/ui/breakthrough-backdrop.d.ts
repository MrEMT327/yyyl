export interface BreakthroughPose {visible:boolean;seconds:number;frontActive:boolean;rearActive:boolean}
export interface BreakthroughSurface {key:string;side:'front'|'rear';blend:'add'|'normal';draws:unknown[]}
export interface BreakthroughFrame extends BreakthroughPose {tier:string;surfaces:BreakthroughSurface[];flashAlpha:number;particleCount:number;shaderTime:number}
export function breakthroughBackdropPose(seconds:number):BreakthroughPose;
export function sampleBreakthroughFrame(seconds:number,tier?:string,reducedMotion?:boolean,shaderTime?:number):BreakthroughFrame;
export function drawBreakthroughSurface(context:CanvasRenderingContext2D,options:{width:number;height:number;ratio?:number;cardWidth?:number},surface:BreakthroughSurface,frame:BreakthroughFrame):void;
