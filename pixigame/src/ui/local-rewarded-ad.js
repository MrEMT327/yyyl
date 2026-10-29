import './local-rewarded-ad.css';

let pending, cancelPending;
/** End an open placeholder when its owning game session stops. */
export function cancelLocalRewardedAd() {
  cancelPending?.();
}
/** Local placeholder only. Services own daily limits, item grants and receipts. */
export function playLocalRewardedAd() {
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
    const document=globalThis.document;
    if(!document?.body){reject(Error('模拟广告界面尚未就绪'));return;}
    const opener=document.activeElement,overlay=document.createElement('div');
    overlay.className='local-ad-overlay';
    overlay.innerHTML=`<section class="local-ad-dialog" role="dialog" aria-modal="true" aria-labelledby="local-ad-title"><h2 id="local-ad-title">模拟广告</h2><div class="local-ad-placeholder" aria-hidden="true">广告占位</div><p>本地学习版使用模拟广告。点击完成领取奖励，取消则不领取。</p><div class="local-ad-actions"><button type="button" class="wc-button" data-local-ad="cancel">取消</button><button type="button" class="wc-button" data-local-ad="complete">完成并领取</button></div></section>`;
    let closed=false;
    const finish=completed=>{
      if(closed)return;closed=true;
      cancelPending=undefined;
      document.removeEventListener('keydown',onKey,true);overlay.remove();
      if(opener?.isConnected)opener.focus?.({preventScroll:true});
      resolve({completed,status:completed?'completed':'cancelled',simulated:true});
    };
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false);}
      else if(event.key==='Tab'){
        event.preventDefault();event.stopImmediatePropagation();
        const buttons=[...overlay.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
        buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
      }
    };
    overlay.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-local-ad]');
      if(button)finish(button.dataset.localAd==='complete');
    });
    cancelPending=()=>finish(false);
    document.body.append(overlay);document.addEventListener('keydown',onKey,true);
    overlay.querySelector('[data-local-ad="cancel"]').focus({preventScroll:true});
  }).finally(()=>{pending=undefined;});
  return pending;
}
