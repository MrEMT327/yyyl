// Gear dialogs share the PSD shell. Keep actions outside the scrolling text so
// long inventories and small screens cannot push the primary action off-screen.
export function dockGearActions(host) {
  const panel=host.querySelector('[data-modal-type^="gear"] .ag-modal');
  if(!panel||panel.querySelector('.ag-modal-footer'))return;
  const children=[...panel.children];
  let first=children.findIndex(n=>n.matches('.ag-actions,.ag-inventory-actions'));
  if(first<0)first=children.findLastIndex(n=>n.matches('button.wc-button'));
  if(first<0)return;
  if(children[first-1]?.matches('.ag-merge-count'))first--;
  const cost=children.findIndex(n=>n.matches('.ag-cost'));
  if(cost>=0&&cost<first)first=cost;
  const notice=children.findIndex(n=>n.matches('.ag-error,.ag-success'));
  if(notice>=0&&notice<first)first=notice;
  const doc=panel.ownerDocument,scroll=doc.createElement('div'),footer=doc.createElement('div');
  scroll.className='ag-modal-scroll';footer.className='ag-modal-footer';
  scroll.append(...children.slice(0,first));footer.append(...children.slice(first));
  panel.append(scroll,footer);
}
