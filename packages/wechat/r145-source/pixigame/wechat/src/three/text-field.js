import { words, box } from '../../../../../../../pixigame/src/three/game-screen/menu-art.js';

export function createWechatTextField(api,value,changed,submit,cancel,repaint,{placeholder='',size=16,maxLength,autoFocus=true,search=false}){
  let visible=true,editing=false,closed=false;
  const listeners=[];
  const ink=search?'#123345':'#18354e';
  function detach(hide){
    if(!editing)return;
    editing=false;
    for(const remove of listeners.splice(0))remove();
    if(hide)api.hideKeyboard({fail(){}});
  }
  function input(event){
    if(!editing)return;
    const next=String(event?.value??value);
    if(next===value)return;
    value=next;changed(value);repaint();
  }
  function focus(){
    if(editing||closed||!visible)return;
    editing=true;
    function watch(add,remove,handler){
      api[add](handler);listeners.push(()=>api[remove](handler));
    }
    watch('onKeyboardInput','offKeyboardInput',input);
    watch('onKeyboardConfirm','offKeyboardConfirm',event=>{
      input(event);detach(true);submit();
    });
    watch('onKeyboardComplete','offKeyboardComplete',event=>{
      input(event);detach(false);changed(value);repaint();
    });
    api.showKeyboard({defaultValue:value,maxLength:maxLength??64,multiple:false,confirmHold:false,
      confirmType:search?'search':'done',fail(){detach(false);changed(value);repaint();}});
    repaint();
  }
  if(autoFocus)queueMicrotask(focus);
  return {
    get value(){return value;},focus,
    visible(on){visible=on;if(!visible)detach(true);},
    draw(art,tools,{x,y,w,h},error){
      if(editing){art.quad(x-3,y-3,w+6,h+6,'#2582a8');art.quad(x-1,y-1,w+2,h+2,'#e8f3fa');}
      art.quad(x,y,w,h,error?'#973f36':search?'#5c8194':'#45677f');
      art.quad(x+1,y+1,w-2,h-2,search?'#eef5f7':'#e8f3fa');
      const clip=box(x+7,y+1,w-14,h-2);
      tools.region('name-text',clip,clip.w,'x');
      words(tools.layer('name-glyphs','name-text').art,value||placeholder,x+5,y+h/2,size,
        {align:'left',weight:400,color:value?ink:'#757575',maxWidth:w-14});
    },
    close(){closed=true;detach(true);},
  };
}

