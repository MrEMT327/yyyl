const shared=new WeakMap();
const retryStatuses=new Set([408,429,500,502,503,504]);

function failureMessage(error){
  const details=[error?.errMsg,error?.message].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim());
  return details.length?[...new Set(details)].join('; '):String(error||'');
}
const opaqueNativeFailure=/^(?:request|downloadFile):fail\s*$/i;

export function transientNetworkFailure(error){
  const message=failureMessage(error);
  if(/abort|cancel|domain list|not in.*domain|invalid.*url|certificate|cert_|permission|file data is empty|empty file/i.test(message))return false;
  // DevTools can show ERR_CONNECTION_CLOSED while the wx callback exposes only
  // "request:fail ". A bounded retry is safe for reads, even without a reason.
  return opaqueNativeFailure.test(message)||/timeout|timed\s*out|network|socket|connect|TLS|SSL|ECONN|ENET|EHOST|EAI_AGAIN|ENOTFOUND|interrupted|internet|net::|网络|超时/i.test(message);
}

/** One bounded queue for model fetches and downloaded UI/media files. Retry
 * only idempotent reads; callbacks and cancellation still settle exactly once. */
export function createWechatTransport(api,{concurrency=4,maxAttempts=3,retryDelays=[400,1200],setTimer=setTimeout,clearTimer=clearTimeout,
  onRetry=detail=>console.warn('[wechat-network-retry]',detail)}={}){
  const queue=[];let active=0,pumping=false;
  function release(operation){if(operation.active){operation.active=false;active--;}}
  function clearDeadline(operation){
    if(operation.deadline!==null)clearTimer(operation.deadline);
    operation.deadline=null;
  }
  function notify(operation,kind,result){
    try{operation.options[kind]?.(result);}finally{operation.options.complete?.(result);}
  }
  function pump(){
    if(pumping)return;pumping=true;
    try{while(active<concurrency&&queue.length){const operation=queue.shift();operation.queued=false;if(!operation.done)start(operation);}}
    finally{pumping=false;}
  }
  function start(operation){
    operation.active=true;active++;operation.attempt++;let ended=false;
    const attempt=operation.attempt;
    function finish(kind,result,abortAttempt=false){
      if(ended||operation.done||operation.attempt!==attempt)return;
      ended=true;
      const task=operation.task;
      operation.task=null;
      clearDeadline(operation);
      if(abortAttempt)try{task?.abort?.();}catch{/* The timeout still frees the slot. */}
      release(operation);
      const retryable=operation.safe&&(kind==='fail'?transientNetworkFailure(result):retryStatuses.has(result.statusCode));
      if(retryable&&attempt<maxAttempts){
        const delay=retryDelays[Math.min(attempt-1,retryDelays.length-1)]??0;
        operation.timer=setTimer(()=>{operation.timer=null;if(!operation.done){operation.queued=true;queue.push(operation);pump();}},delay);
        onRetry({type:operation.type,url:String(operation.options.url).split(/[?#]/,1)[0],attempt:attempt+1,maxAttempts,delayMs:delay,
          reason:kind==='fail'?failureMessage(result).replace(/https?:\/\/\S+/g,'[resource]'):'HTTP '+result.statusCode});
      }else{
        operation.done=true;
        if(kind==='fail'&&attempt>1){
          const reason=failureMessage(result);
          result={...result,errMsg:reason+(opaqueNativeFailure.test(reason)?'（平台未返回详细原因）':'')+`（已尝试 ${attempt} 次）`};
        }
        try{notify(operation,kind,result);}finally{pump();}
        return;
      }
      pump();
    }
    try{
      const task=api[operation.type]({...operation.options,success:result=>finish('success',result),fail:error=>finish('fail',error),complete:undefined});
      if(!ended&&!operation.done){
        operation.task=task;
        const timeout=operation.options.timeout;
        // On some native failures neither callback arrives. Use the same
        // timeout as the platform, starting when the request leaves the queue.
        if(operation.safe&&Number.isFinite(timeout)&&timeout>0){
          operation.deadline=setTimer(()=>finish('fail',{errMsg:`${operation.type}:fail timeout`},true),timeout);
        }
      }
    }catch(error){if(ended)throw error;finish('fail',error);}
  }
  function enqueue(type,options){
    const operation={type,options,safe:type==='downloadFile'||/^(GET|HEAD)$/i.test(options.method||'GET'),attempt:0,done:false,active:false,queued:true,task:null,timer:null,deadline:null};
    queue.push(operation);pump();
    return {abort(){
      if(operation.done)return;operation.done=true;
      clearDeadline(operation);
      if(operation.timer!==null){clearTimer(operation.timer);operation.timer=null;}
      if(operation.queued){const index=queue.indexOf(operation);if(index>=0)queue.splice(index,1);operation.queued=false;}
      const task=operation.task;operation.task=null;release(operation);
      try{task?.abort?.();}finally{
        try{notify(operation,'fail',{errMsg:type+':fail abort',name:'AbortError'});}finally{pump();}
      }
    }};
  }
  return {request:options=>enqueue('request',options),downloadFile:options=>enqueue('downloadFile',options)};
}

export function getWechatTransport(api){
  let transport=shared.get(api);if(!transport){transport=createWechatTransport(api);shared.set(api,transport);}return transport;
}
