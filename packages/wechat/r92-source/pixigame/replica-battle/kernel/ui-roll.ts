import media from '../public/data/ui-animation-assets.json';

/** CPU equivalent of shipped ArcheroII/UI/MaskRoll GLES fragment program.
 * The overlay only needs this surface during the three-second Boss warning. */
export class OriginalUiRoll {
  private surface = document.createElement('canvas');
  private texture?: ImageData;
  private mask?: ImageData;
  private output?: ImageData;
  private roll = new Image();
  private stencil = new Image();
  private lastFrame = -1;
  private readonly uv = media.sprites.original_ui_stg_main_startBattle_mask__5977198226797145682.uvRect;
  constructor() {
    this.roll.src = media.sprites.original_ui_RollBG_Shu.url;
    this.stencil.src = media.sprites.original_ui_stg_main_startBattle_mask.url;
    this.surface.width = 512; this.surface.height = 128;
  }
  private pixels(image: HTMLImageElement) {
    const canvas = document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d')!; context.drawImage(image,0,0);
    return context.getImageData(0,0,canvas.width,canvas.height);
  }
  draw(time: number): HTMLCanvasElement | null {
    if (!this.roll.complete || !this.roll.naturalWidth || !this.stencil.complete || !this.stencil.naturalWidth) return null;
    if (Math.floor(time*60)===this.lastFrame) return this.surface;
    this.lastFrame=Math.floor(time*60);
    this.texture ??= this.pixels(this.roll); this.mask ??= this.pixels(this.stencil);
    const ctx=this.surface.getContext('2d')!;
    this.output ??= ctx.createImageData(this.surface.width,this.surface.height);
    const out=this.output.data, tex=this.texture, mask=this.mask;
    const angle=-0.46000000834465027, c=Math.cos(angle), s=Math.sin(angle);
    const width=this.surface.width,height=this.surface.height;
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
      // Unity UVs are bottom-up and retain their original SpriteAtlas rectangle.
      const u=this.uv[0]+(x+.5)/width*this.uv[2], v=this.uv[1]+(1-(y+.5)/height)*this.uv[3];
      const tx=u*5.400000095367432,ty=v*1.5;
      const rx=c*tx+s*ty-2*time, ry=-s*tx+c*ty;
      const px=((rx%1+1)%1)*tex.width-.5,py=(1-((ry%1+1)%1))*tex.height-.5;
      const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
      const x0=(ix+tex.width)%tex.width,x1=(x0+1)%tex.width,y0=(iy+tex.height)%tex.height,y1=(y0+1)%tex.height;
      const p0=(y0*tex.width+x0)*4,p1=(y0*tex.width+x1)*4,p2=(y1*tex.width+x0)*4,p3=(y1*tex.width+x1)*4;
      const w0=(1-fx)*(1-fy),w1=fx*(1-fy),w2=(1-fx)*fy,w3=fx*fy;
      const mi=(Math.min(mask.height-1,Math.floor((y+.5)/height*mask.height))*mask.width+Math.min(mask.width-1,Math.floor((x+.5)/width*mask.width)))*4;
      const oi=(y*width+x)*4;
      for (let ch=0;ch<4;ch++) {
        const sample=tex.data[p0+ch]*w0+tex.data[p1+ch]*w1+tex.data[p2+ch]*w2+tex.data[p3+ch]*w3;
        const tint=ch===1?.6430334448814392:ch===2?.4858490824699402:ch===3?.125490203499794*mask.data[mi]/255:1;
        out[oi+ch]=sample*tint;
      }
    }
    ctx.putImageData(this.output,0,0); return this.surface;
  }
}
