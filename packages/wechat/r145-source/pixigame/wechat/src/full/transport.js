const shared=new WeakMap();
const retryStatuses=new Set([408,429,500,502,503,504]);

function failureMessage(error){
  const details=[error?.errMsg,error?.message].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim());
  return details.length?[...new Set(details)].join('; '):String(error||'');
}
const opaqueNativeFailure=/^(?:request|downloadFile):fail\s*$/i;

export function isIncompleteDownload(error){
  if(error?.name==='AbortError')return false;
  return /file data is empty|empty file|ERR_CONTENT_LENGTH_MISMATCH|(?:errcode|cronet_error_code):\s*-354\b|downloadFile:fail\s+Error:\s+aborted\b/i.test(failureMessage(error));
}

export function transientNetworkFailure(error){
  const message=failureMessage(error);
  if(/abort|cancel|domain list|not in.*domain|invalid.*url|certificate|cert_|permission|file data is empty|empty file/i.test(message))return false;
  // DevTools can show ERR_CONNECTION_CLOSED while the wx callback exposes only
  // "request:fail ". A bounded retry is safe for reads, even without a reason.
  return opaqueNativeFailure.test(message)||/timeout|timed\s*out|network|socket|connect|TLS|SSL|ECONN|ENET|EHOST|EAI_AGAIN|ENOTFOUND|interrupted|internet|net::|网络|超时/i.test(message);
}

/** One bounded queue for model fetches and downloaded UI/media files. Retry
 * only idempotent reads; callbacks and cancellation still settle exactly once. */
export function createWechatTransport(api,{concurrency=4,sortieConcurrency=6,maxAttempts=3,retryDelays=[400,1200],setTimer=setTimeout,clearTimer=clearTimeout,
  now=()=>performance.now(),
  onRetry=detail=>console.warn('[wechat-network-retry]',detail)}={}){
  const queue=[];let active=0,pumping=false,sortieLoads=0;
  const loadingLimit=Math.max(concurrency,sortieConcurrency);
  const observers=new Set(),observed=new Set();
  function timingRow(operation,end){
    const {queuedAt,firstAt,attemptAt,activeMs}=operation.timing;
    return {type:operation.type,url:String(operation.options.url),attempts:operation.attempt,
      elapsedMs:end-queuedAt,queueMs:(firstAt??end)-queuedAt,activeMs:activeMs+(attemptAt===null?0:end-attemptAt)};
  }
  function observeResult(operation,kind,result){
    if(!operation.timing)return;
    observed.delete(operation);
    if(!observers.size)return;
    const timing=timingRow(operation,now());
    const bytes=Number(result?.data?.byteLength ?? result?.totalBytesWritten ??
      result?.header?.['content-length'] ?? result?.header?.['Content-Length']);
    const status=kind==='success' ? result?.statusCode ?? 'unknown'
      : kind==='abort' ? 'aborted' : /timeout|timed\s*out|超时/i.test(failureMessage(result)) ? 'timeout' : 'failed';
    const row={...timing,status,bytes:Number.isFinite(bytes)&&bytes>=0?bytes:null};
    for(const observer of observers)try{observer(row);}catch{/* Diagnostics cannot change request settlement. */}
  }
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
    try{while(active<(sortieLoads?loadingLimit:concurrency)&&queue.length){const operation=queue.shift();operation.queued=false;if(!operation.done)start(operation);}}
    finally{pumping=false;}
  }
  function beginSortieLoad(){
    sortieLoads++;
    try{pump();}catch(error){sortieLoads--;throw error;}
    let loading=true;
    return ()=>{
      if(!loading)return;
      loading=false;
      sortieLoads--;
      // In-flight work owns its slot until its ordinary completion or abort.
    };
  }
  function start(operation){
    operation.active=true;active++;operation.attempt++;let ended=false;
    if(operation.timing){
      operation.timing.attemptAt=now();
      operation.timing.firstAt??=operation.timing.attemptAt;
    }
    const attempt=operation.attempt;
    function finish(kind,result,abortAttempt=false){
      if(ended||operation.done||operation.attempt!==attempt)return;
      ended=true;
      if(operation.timing){
        operation.timing.activeMs+=now()-operation.timing.attemptAt;
        operation.timing.attemptAt=null;
      }
      const task=operation.task;
      operation.task=null;
      clearDeadline(operation);
      if(abortAttempt)try{task?.abort?.();}catch{/* The timeout still frees the slot. */}
      release(operation);
      const incomplete=operation.type==='downloadFile'&&kind==='fail'&&isIncompleteDownload(result);
      const retryable=operation.safe&&!incomplete&&(kind==='fail'?transientNetworkFailure(result):retryStatuses.has(result.statusCode));
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
        observeResult(operation,kind,result);
        try{notify(operation,kind,result);}finally{pump();}
        return;
      }
      pump();
    }
    try{
      const {retryURL,...options}=operation.options;
      const url=attempt>1&&retryURL?retryURL(options.url):options.url;
      const task=api[operation.type]({...options,url,success:result=>finish('success',result),fail:error=>finish('fail',error),complete:undefined});
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
    if(operation.safe&&observers.size){
      operation.timing={queuedAt:now(),firstAt:null,attemptAt:null,activeMs:0};
      observed.add(operation);
    }
    queue.push(operation);pump();
    return {abort(){
      if(operation.done)return;operation.done=true;
      clearDeadline(operation);
      if(operation.timer!==null){clearTimer(operation.timer);operation.timer=null;}
      if(operation.queued){const index=queue.indexOf(operation);if(index>=0)queue.splice(index,1);operation.queued=false;}
      const task=operation.task;operation.task=null;release(operation);
      observeResult(operation,'abort');
      try{task?.abort?.();}finally{
        try{notify(operation,'fail',{errMsg:type+':fail abort',name:'AbortError'});}finally{pump();}
      }
    }};
  }
  return {request:options=>enqueue('request',options),downloadFile:options=>enqueue('downloadFile',options),beginSortieLoad,
    observe(callback){observers.add(callback);return ()=>observers.delete(callback);},
    pendingSnapshot(){
      const end=now(),rows=[];
      for(const operation of observed){
        const state=operation.queued?'queued':operation.active?'active':'retry-wait';
        rows.push({...timingRow(operation,end),state});
      }
      return rows;
    }};
}

export function getWechatTransport(api){
  let transport=shared.get(api);if(!transport){transport=createWechatTransport(api);shared.set(api,transport);}return transport;
}
