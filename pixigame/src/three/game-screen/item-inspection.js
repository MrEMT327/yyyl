import {createLobbyPanel} from './lobby-panel.js';
import {paintItemDetail} from './item-details.js';

export function createItemInspection(screen,container,getSnapshot){
  let host=null,panel=null,opener=null,retained=[];
  function close(){
    if(!panel)return;
    const previous=panel;panel=null;previous.close();host.remove();host=null;
    for(const [node,was] of retained)node.inert=was;
    retained=[];if(opener?.isConnected)opener.focus?.({preventScroll:true});opener=null;
    screen.repaintHome?.();
  }
  function open(item,source){
    close();opener=source||container.ownerDocument.activeElement;
    host=container.ownerDocument.createElement('div');
    host.setAttribute('data-three-item-inspection','');host.style.cssText='position:absolute;inset:0;z-index:100010;pointer-events:auto;';
    retained=[...container.children].map(n=>[n,n.inert]);container.append(host);
    for(const [node] of retained)node.inert=true;
    panel=createLobbyPanel(screen,host,'道具详情',(data,w,h,t)=>{paintItemDetail(data,w,h,t);return 'inspect';},
      command=>{if(command.type==='close')close();},{overlay:true});
    panel.update({inspect:item,snapshot:getSnapshot()},'item','item');screen.repaintHome?.();
  }
  return {open,close,destroy:close};
}
