// Native Unity color tags become project highlights; text never becomes HTML.
export function skillEffectText(value,escape){
  let depth=0;
  const result=String(value??'').split(/(<color=[^>]+>|<\/color>)/gi).map(part=>{
    const match=part.match(/^<color=([^>]+)>$/i);
    if(match){depth++;return `<span class="${match[1].toLowerCase()==='#0e7311'?'fc-skill-value-highlight':'fc-skill-name-highlight'}">`;}
    if(/^<\/color>$/i.test(part))return depth?(depth--,'</span>'):'';
    return escape(part);
  }).join('');
  return result+'</span>'.repeat(depth);
}
