export function resolveBattleMusic(path,services,baseURL){
  const key=String(path).match(/(?:^|\/)([a-z]+_(?:fight|boss))(?:-[\w-]+)?\.ogg(?:[?#]|$)/i)?.[1]?.toLowerCase();
  const {musicFiles,musicGains,battleMusic}=services;
  const selected=musicFiles?.[key]??battleMusic?.cached(key);
  if(selected)return {source:selected,gain:musicGains?.[key]??1};
  // Later tracks use the first packaged theme until the lobby has cached their own.
  if(battleMusic?.has(key)&&musicFiles?.brain_fight)return {source:musicFiles.brain_fight,gain:musicGains?.brain_fight??1};
  return {source:services.resolve(path,baseURL),gain:1};
}

export function createBattleMusicCache(downloads={},files,baseURL,makeAbort){
  const keys=Object.keys(downloads);
  function cached(key){
    const track=downloads[key];
    if(track)try{return files.cachedLocalFile(track.path,baseURL,track.bytes);}catch{}
  }
  return {cached,has:key=>Object.hasOwn(downloads,key),
    preloadInLobby({idle,loaded,failed,setTimer=setTimeout,clearTimer=clearTimeout}){
      const attempted=new Set();
      let active=false,timer=null,job=null;
      function schedule(){
        if(active&&timer===null&&!job&&attempted.size<keys.length)timer=setTimer(run,800);
      }
      async function run(){
        timer=null;
        if(!active||!idle()){schedule();return;}
        const key=keys.find(name=>!attempted.has(name));
        attempted.add(key);
        const track=downloads[key];
        if(cached(key)){schedule();return;}
        const request=makeAbort();job=request;
        try{
          await files.localFile(track.path,baseURL,{signal:request.signal,expectedBytes:track.bytes});
          if(!request.signal.aborted)loaded?.(key,track.bytes);
        }catch(error){
          if(!request.signal.aborted)failed?.(key,error);
        }finally{job=null;schedule();}
      }
      return {setActive(value){
        if(active===value)return;
        active=value;
        if(active){attempted.clear();schedule();return;}
        if(timer!==null){clearTimer(timer);timer=null;}
        job?.abort();
      }};
    },
  };
}
