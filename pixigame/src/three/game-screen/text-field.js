import {words,box} from './menu-art.js';

// The browser delivers IME composition, selection, paste and keyboard events.
// The field, text selection and caret that the player sees are Three meshes.
export function createTextField(surface,value,changed,submit,cancel,repaint,{label,placeholder='',size=16,maxLength,autoFocus=true,search=false}){
  const doc=surface.ownerDocument,input=doc.createElement('input'),abort=new AbortController();
  const font=size+'px "Microsoft YaHei",sans-serif';
  const context=doc.createElement('canvas').getContext('2d');context.font=font;
  const options={signal:abort.signal};
  let caret=null,shown=true,ready=false,state='';
  input.type=search?'search':'text';if(maxLength!=null)input.maxLength=maxLength;
  input.value=value;input.autocomplete='off';input.spellcheck=false;input.enterKeyHint=search?'search':'done';
  if(!search)input.dataset.playerName='';input.setAttribute('aria-label',label);input.placeholder=placeholder;
  input.style.cssText='position:absolute;left:0;top:0;width:1px;height:1px;box-sizing:border-box;opacity:0;pointer-events:auto;padding:6px;border:1px solid transparent;margin:0;font:'+font;
  surface.append(input);
  function notify(){
    const key=JSON.stringify([input.value,input.selectionStart,input.selectionEnd,input.scrollLeft,doc.activeElement===input,shown]);
    if(state!==key){state=key;if(ready)changed(input.value);}
  }
  for(const event of ['input','select','selectionchange','keyup','click','scroll','focus','blur','compositionend'])
    input.addEventListener(event,notify,options);
  doc.addEventListener('selectionchange',()=>{if(doc.activeElement===input)notify();},options);
  input.addEventListener('keydown',event=>{
    if(event.isComposing||event.keyCode===229){event.stopPropagation();return;}
    if(event.key==='Tab'){event.preventDefault();event.stopPropagation();surface.focus({preventScroll:true});return;}
    if(event.key==='Enter'||event.key==='Escape'){
      event.preventDefault();event.stopPropagation();if(event.key==='Enter')submit();else cancel();
    }
  },options);
  if(autoFocus){input.focus({preventScroll:true});input.select();}ready=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timer=reduced?null:setInterval(()=>{if(caret&&shown&&doc.activeElement===input){caret.visible=!caret.visible;repaint();}},530);
  function draw(a,t,b,error,details){
    const {x,y,w,h}=b,focused=doc.activeElement===input,ink=search?'#123345':'#18354e';
    Object.assign(input.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    if(error)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
    if(details)input.setAttribute('aria-description',details);
    if(focused){const ring=search?2:3;a.quad(x-ring,y-ring,w+2*ring,h+2*ring,search?'#17374c':'#2582a8');a.quad(x-1,y-1,w+2,h+2,'#e8f3fa');}
    a.quad(x,y,w,h,error?'#973f36':search?'#5c8194':'#45677f');a.quad(x+1,y+1,w-2,h-2,search?'#eef5f7':'#e8f3fa');
    const clearSize=search&&focused&&input.value?13:0;
    if(clearSize){const cx=x+w-12,cy=y+h/2;a.line([[cx-3,cy-3],[cx+3,cy+3]],'#436078',1,1.5);a.line([[cx+3,cy-3],[cx-3,cy+3]],'#436078',1,1.5);}
    t.region('name-text',box(x+7,y+1,w-14-clearSize,h-2),w-14-clearSize,'x');
    const inkArt=t.layer('name-glyphs','name-text').art;
    const txt=input.value,start=focused?input.selectionStart:0,end=focused?input.selectionEnd:0;
    const prefix=txt.slice(0,start),selected=txt.slice(start,end),suffix=txt.slice(end);
    const measure=text=>context.measureText(text).width;
    const left=x+7-input.scrollLeft,cy=y+h/2,selectionX=left+measure(prefix),selectionW=measure(selected);
    if(!txt&&placeholder)words(inkArt,placeholder,left-2,cy,size,{align:'left',weight:400,color:'#757575',maxWidth:w-14});
    if(selectionW)inkArt.quad(selectionX,cy-size*.625,selectionW,size*1.25,'#3875d7');
    for(const [str,l,color] of [[prefix,left,ink],[selected,selectionX,'#fff'],[suffix,selectionX+selectionW,ink]])
      if(str)words(inkArt,str,l-2,cy,size,{align:'left',weight:400,color,maxWidth:Math.max(8,measure(str)+4)});
    caret=focused&&!selectionW?inkArt.quad(selectionX,cy-size*.56,1,size*1.125,ink):null;
  }
  return {draw,get value(){return input.value;},focus(){input.focus({preventScroll:true});},visible(on){
    if(shown===on)return;shown=on;input.style.visibility=on?'visible':'hidden';
    if(!on&&doc.activeElement===input)surface.focus({preventScroll:true});
  },close(restore=false){
    ready=false;abort.abort();clearInterval(timer);caret=null;input.remove();
    if(restore&&surface.isConnected)surface.focus({preventScroll:true});
  }};
}
