import source from './native-failure-protection-source.json' with {type:'json'};
// ApplyProtectHpRate@6e5e2cc + GetHpRateByFailCount@6df3900.
// The caller must supply a recorded count. This function does not infer one
// from deaths, quits, retries or the bounded historical results list.
export function nativeProtectHpRateRaw(chapterId,defeatCount=0){
 if(!Number.isSafeInteger(defeatCount)||defeatCount<0)throw Error('失败保护计数无效');
 const chapter=source.chapters[chapterId];
 if(!chapter)throw Error('失败保护关卡未核实');
 if(defeatCount<1||chapter.templateId<1)return 65536;
 const rate=source.templates[chapter.templateId]?.[Math.min(defeatCount,10)-1];
 return Number.isSafeInteger(rate)&&rate<65536?rate:65536;
}
