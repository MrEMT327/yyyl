// Appearance browsing updates one open WeaponInfo, not a new dialog. Keep the
// stage, decoded artwork and variant buttons mounted across these updates.
function syncNode(current,next) {
  if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){
    current.replaceWith(next.cloneNode(true));return;
  }
  if(current.nodeType===3){
    if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;
    return;
  }
  if(current.nodeType!==1)return;
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  const children=[...next.childNodes];
  children.forEach((child,index)=>{
    const existing=current.childNodes[index];
    if(existing)syncNode(existing,child);else current.append(child.cloneNode(true));
  });
  while(current.childNodes.length>children.length)current.lastChild.remove();
}

export function updateWeaponShowcase(host,content) {
  const current=host.querySelector('.wd-showcase');
  if(!current)return false;
  const template=host.ownerDocument.createElement('template');template.innerHTML=content;
  const next=template.content.querySelector('.wd-showcase');
  if(!next)return false;
  syncNode(current,next);return true;
}
