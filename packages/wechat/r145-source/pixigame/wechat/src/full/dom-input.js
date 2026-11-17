const blockedControl = Symbol('unpainted control');

export function attachDomInput(host, { listen = true } = {}) {
  const { api, layout, document, capture, emit, measurePerformance } = host;
  const touches = new Map(); let primary = null;
  let keyboardTarget=null, keyboardConfirmed=false;
  const editable=node=>node?.matches?.('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea')&&!node.readOnly&&!node.disabled;
  const closeKeyboard=()=>{if(!keyboardTarget)return;keyboardTarget=null;api.hideKeyboard?.();};
  const focus=target=>{
    if(!editable(target)){closeKeyboard();return;}
    if(keyboardConfirmed)return;
    if(keyboardTarget===target)return;
    keyboardTarget=target;
    const hint=target.getAttribute('enterkeyhint');
    api.showKeyboard?.({defaultValue:target.value || '',maxLength:target.maxLength>=0?target.maxLength:500,multiple:target.tagName==='TEXTAREA',confirmHold:false,confirmType:['done','next','search','go','send'].includes(hint)?hint:'done'});
  };
  const blur=target=>{if(keyboardTarget===target){emit(target,'change');closeKeyboard();}};
  host.onElementFocus=focus;host.onElementBlur=blur;
  const point = touch => ({ x: touch.clientX ?? touch.x, y: touch.clientY ?? touch.y });
  function setRange(input,p){
    const rect=input.getBoundingClientRect(),min=Number(input.min??input.getAttribute('min')??0),max=Number(input.max??input.getAttribute('max')??100);
    if(!rect.width||!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return;
    let value=min+Math.max(0,Math.min(1,(p.x-rect.left)/rect.width))*(max-min);
    const step=input.step??input.getAttribute('step')??1;
    if(step!=='any'&&Number(step)>0)value=min+Math.round((value-min)/Number(step))*Number(step);
    value=Math.max(min,Math.min(max,value));
    if(Number(input.value)!==value){input.value=String(value);emit(input,'input');}
  }
  function fields(id, p, buttons) { return { pointerId: id, pointerType: 'touch', isPrimary: id === primary, button: 0, buttons, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y }; }
  function scrollExtent(node, axis) {
    const box=layout.box(node);
    if(!box)return 0;
    return axis==='x'?(box.scrollWidth??box.width)-box.width:(box.scrollHeight??box.height)-box.height;
  }
  function scrollParent(node, axis) {
    for (; node?.nodeType === 1; node = node.parentElement) {
      const style = layout.styles.read(node);
      const action = style['touch-action'] || 'auto';
      if (action === 'none' || /pan-[xy]/.test(action) && !action.includes('pan-' + axis)) return null;
      const overflow = style['overflow-' + axis] || style.overflow;
      if (/auto|scroll/.test(overflow) && scrollExtent(node,axis) > 1) return node;
    }
    return null;
  }
  function begin(event) {
    keyboardConfirmed=false;
    for (const touch of event.changedTouches) {
      const id = touch.identifier, p = point(touch), hit = layout.hit(p.x, p.y, blockedControl);
      if (hit === blockedControl) continue;
      const target = hit || document.body;
      if (target.closest('[disabled], [inert]')) continue;
      if (primary == null) primary = id;
      const range=target.closest('input[type="range"]');
      touches.set(id, { target, range, start: p, last: p, scroll: null, axis: null, dragging: false });
      emit(target, 'pointerdown', fields(id, p, 1));
      if(range)setRange(range,p);
      // HTML touch capture keeps receiving moves across card/image boundaries.
      if (!capture.has(id)) capture.set(id, target);
    }
  }
  function move(event) {
    for (const touch of event.changedTouches) {
      const id = touch.identifier, state = touches.get(id); if (!state) continue;
      const p = point(touch);
      if(state.range){setRange(state.range,p);emit(state.range,'pointermove',fields(id,p,1));state.last=p;continue;}
      const dx=p.x-state.start.x,dy=p.y-state.start.y;
      if (!state.dragging && dx*dx+dy*dy>49) {
        const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        // Reconsider when the axis or computed layout changes; a captured
        // flight gesture must not rewalk a touch-action:none tree each move.
        layout.update();
        if (state.checkedAxis !== axis || state.checkedLayout !== layout.generation) {
          const scroll = scrollParent(state.target, axis);
          state.checkedAxis=axis;state.checkedLayout=layout.generation;
          if (scroll) {
            state.scroll = scroll; state.axis = axis; state.dragging = true;
            emit(capture.get(id) || state.target, 'pointercancel', fields(id, p, 0)); capture.delete(id);
          }
        }
      }
      if (state.dragging) {
        const horizontal = state.axis === 'x', position = horizontal ? 'scrollLeft' : 'scrollTop';
        const extent=scrollExtent(state.scroll,state.axis),previous=Number(state.scroll[position])||0;
        const next=Math.max(0,Math.min(extent,previous+state.last[state.axis]-p[state.axis]));
        if(next!==previous){state.scroll[position]=next;emit(state.scroll,'scroll');}
      } else emit(capture.get(id) || state.target, 'pointermove', fields(id, p, 1));
      state.last = p;
    }
  }
  function activate(target) {
    const select = target.closest('select');
    if (select) {
      const options = [...select.querySelectorAll('option')].filter(option => !option.disabled);
      api.showActionSheet({ itemList: options.map(option => option.textContent), success({ tapIndex }) { select.value = options[tapIndex].value; emit(select, 'input'); emit(select, 'change'); } });
      return;
    }
    const input = target.closest('input:not([type="range"]),textarea');
    if (input && !input.readOnly) {
      if (input.type === 'checkbox') { input.checked = !input.checked; emit(input, 'input'); emit(input, 'change'); return; }
      input.focus();
      return;
    }
    if(editable(document.activeElement))document.activeElement.blur();
    const summary = target.closest('summary'); if (summary?.parentElement?.tagName === 'DETAILS') summary.parentElement.toggleAttribute('open');
    emit(target, 'click', { button: 0, detail: 1 });
  }
  function finish(event, cancelled = false) {
    for (const touch of event.changedTouches) {
      const id = touch.identifier, state = touches.get(id); if (!state) continue;
      const p = point(touch), target = capture.get(id) || state.target;
      if(state.range){
        if(!cancelled){setRange(state.range,p);emit(state.range,'change');}
        emit(target,cancelled?'pointercancel':'pointerup',fields(id,p,0));
        target.releasePointerCapture?.(id);capture.delete(id);touches.delete(id);if(id===primary)primary=null;continue;
      }
      host.onInputDebug?.({stage:'before-release',target:state.target,detail:JSON.stringify({cancelled,dragging:state.dragging,connected:state.target.isConnected,start:state.start,end:p})});
      if (!state.dragging) emit(target, cancelled ? 'pointercancel' : 'pointerup', fields(id, p, 0));
      target.releasePointerCapture?.(id); capture.delete(id); touches.delete(id);
      host.onInputDebug?.({stage:'after-release',target:state.target});
      if (!cancelled && !state.dragging && state.target.isConnected && Math.hypot(p.x - state.start.x, p.y - state.start.y) <= 9) {
        const hit = layout.hit(p.x, p.y);
        host.onInputDebug?.({target:state.target,hit});
        const button = hit && hit !== state.target ? hit.closest('button') : null;
        if (hit && (hit === state.target || button && button === state.target.closest('button') || state.target.contains(hit))) activate(state.target);
      }
      if (id === primary) primary = null;
    }
  }
  const measured=handle=>measurePerformance ? event=>measurePerformance('input',()=>handle(event)) : handle;
  const start=measured(begin),drag=measured(move),end=measured(event=>finish(event)),cancel=measured(event=>finish(event,true));
  const keyboard = event => { const input=keyboardTarget; if(!input?.isConnected)return; input.value=String(event.value??'');input.setSelectionRange(input.value.length,input.value.length);emit(input,'input'); };
  const confirm = event => {
    const input=keyboardTarget;if(!input)return;keyboard(event);emit(input,'change');keyboardConfirmed=true;closeKeyboard();
    if(input.tagName!=='TEXTAREA'&&input.isConnected)emit(input,'keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,isComposing:false});
  };
  const complete = event => {const input=keyboardTarget;if(!input)return;keyboard(event);keyboardTarget=null;emit(input,'change');};
  if (listen) {
    api.onTouchStart(start); api.onTouchMove(drag); api.onTouchEnd(end); api.onTouchCancel(cancel);
    api.onKeyboardInput?.(keyboard); api.onKeyboardConfirm?.(confirm);api.onKeyboardComplete?.(complete);
  }
  return { start, move:drag, end, cancel, destroy() {
    if (listen) { api.offTouchStart?.(start); api.offTouchMove?.(drag); api.offTouchEnd?.(end); api.offTouchCancel?.(cancel); api.offKeyboardInput?.(keyboard); api.offKeyboardConfirm?.(confirm);api.offKeyboardComplete?.(complete); }
    closeKeyboard();if(host.onElementFocus===focus)delete host.onElementFocus;if(host.onElementBlur===blur)delete host.onElementBlur;
    touches.clear(); capture.clear();
  } };
}
