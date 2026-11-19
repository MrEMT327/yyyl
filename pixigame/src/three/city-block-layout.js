// Street plans stay fixed; independently fitted buildings occupy their painted
// parcels. Polygon coordinates use image space (top-left = 0,0).
const base=import.meta.env?.BASE_URL||'/';
const art=name=>`${base}art/city-slots-v1/${name}.png`;
const freeze=Object.freeze;
export const CITY_TILE_UNITS=36;
export const CITY_BLOCK_SEQUENCE=freeze(['winding','residential','service','industrial','winding','service']);
export const CITY_LOOP_UNITS=CITY_TILE_UNITS*CITY_BLOCK_SEQUENCE.length;
export const CITY_MODULE_URLS=freeze(Object.fromEntries([
  ['residential','ground-residential'],['industrial','ground-industrial'],
  ['winding','ground-winding'],['service','ground-service-yard'],
  ['office','building-office'],['apartment','building-apartment'],['shops','building-shops'],
  ['warehouse','building-warehouse'],['relay','building-relay'],['utility','building-utility'],
  ['row-shops','building-row-shops-v1'],
].map(([key,file])=>[key,art(file)])));
export const CITY_BUILDINGS=freeze({
  office:[.2233,.2751,.7767,.7233],apartment:[.2018,.1866,.7927,.7927],
  shops:[.1411,.2719,.8541,.7313],warehouse:[.1531,.2496,.8469,.7736],
  relay:[.2751,.2089,.7225,.7528],utility:[.1794,.2871,.8214,.7169],
  'row-shops':[.038,.390,.962,.651],
});
// [bottom center, bottom width / shared width, top center, top width / shared width].
// Measured asphalt ports; correction fades out within the quiet border strip.
export const CITY_ROAD_PORTS=freeze({
  residential:freeze([.5,1.013,.5004,1.004]),industrial:freeze([.4996,.985,.5,.976]),
  winding:freeze([.5108,.779,.4996,.891]),service:freeze([.5012,1.098,.504,.938]),
});
const rect=(l,t,r,b)=>[[l,t],[r,t],[r,b],[l,b]];
const pad=(x,y,width,height,choices,angle=0)=>freeze({x,y,width,height,choices:freeze(choices),angle});
const lot=(id,polygon,plans)=>freeze({id,polygon:freeze(polygon.map(freeze)),plans:freeze(plans.map(freeze))});
function gridLots(industrial){
  return freeze([[.074,.284],[.410,.600],[.728,.936]].flatMap(([top,bottom],row)=>[[.077,.417],[.586,.935]].map(([left,right],side)=>{
    const x=(left+right)/2,y=(top+bottom)/2,w=right-left,h=bottom-top;
    return lot(`${row}-${side}`,rect(left,top,right,bottom),[
      [pad(x,y,w*.95,h*.95,industrial?['warehouse','utility']:['shops','utility'])],
      [pad(x-w*.25,y,w*.45,h*.95,['apartment','relay']),pad(x+w*.25,y,w*.45,h*.95,['office','warehouse'])],
    ]);
  })));
}
export const CITY_TEMPLATES=freeze({
  residential:freeze({name:'规则居住街区',lots:gridLots(false)}),
  industrial:freeze({name:'规则工业街区',lots:gridLots(true)}),
  winding:freeze({name:'弯路与错位街口',lots:freeze([
    lot('upper-left',[[.15,.085],[.37,.065],[.419,.09],[.416,.205],[.393,.247],[.31,.291],[.235,.335],[.185,.399],[.161,.488],[.103,.485],[.052,.449],[.049,.251],[.073,.162]],[
      [pad(.234,.186,.29,.225,['apartment','utility']),pad(.108,.378,.086,.164,['relay'])],
      [pad(.233,.185,.29,.212,['warehouse','shops']),pad(.111,.377,.088,.164,['relay'])],
    ]),
    lot('upper-right',[[.642,.123],[.84,.066],[.947,.075],[.958,.124],[.883,.172],[.781,.199],[.615,.207],[.602,.176]],[
      [pad(.785,.140,.312,.105,['row-shops'],-.20)],
    ]),
    lot('middle-right',[[.658,.348],[.835,.329],[.913,.295],[.949,.327],[.958,.408],[.922,.474],[.924,.626],[.878,.678],[.736,.716],[.675,.677],[.619,.593],[.551,.547],[.533,.492],[.552,.423],[.597,.367]],[
      [pad(.765,.458,.317,.22,['warehouse','utility']),pad(.777,.634,.25,.105,['shops','office'])],
      [pad(.686,.475,.167,.23,['apartment','relay']),pad(.865,.46,.139,.212,['office','warehouse']),pad(.777,.634,.25,.105,['shops','utility'])],
    ]),
    lot('lower-left',[[.079,.681],[.21,.682],[.235,.746],[.39,.755],[.42,.795],[.422,.932],[.197,.932],[.156,.913],[.126,.869],[.064,.843]],[
      [pad(.279,.841,.281,.166,['shops','utility']),pad(.143,.725,.108,.077,['relay'])],
    ]),
    lot('lower-right',[[.652,.894],[.707,.831],[.883,.763],[.947,.745],[.947,.838],[.915,.9],[.663,.942]],[
      [pad(.807,.854,.277,.092,['row-shops'],-.32)],
    ]),
  ])}),
  service:freeze({name:'不规则服务区',lots:freeze([
    lot('large-yard',[[.087,.236],[.385,.091],[.428,.093],[.445,.178],[.518,.261],[.548,.302],[.502,.335],[.446,.418],[.396,.435],[.039,.435],[.041,.335]],[
      [pad(.266,.347,.352,.163,['warehouse','shops']),pad(.347,.199,.168,.117,['office','utility']),pad(.098,.374,.085,.115,['relay'])],
      [pad(.227,.337,.267,.184,['utility','warehouse']),pad(.383,.18,.111,.104,['relay'])],
    ]),
    lot('corner',[[.882,.104],[.926,.113],[.948,.177],[.862,.219],[.821,.232]],[
      [pad(.889,.166,.088,.09,['relay'],-.18)],
    ]),
    lot('lower-yard',[[.079,.631],[.414,.621],[.48,.585],[.573,.592],[.597,.629],[.585,.659],[.512,.700],[.454,.749],[.423,.855],[.079,.854],[.053,.827],[.057,.701]],[
      [pad(.277,.773,.31,.151,['warehouse','shops']),pad(.424,.655,.28,.11,['row-shops'],-.08),pad(.11,.747,.104,.16,['relay'])],
      [pad(.18,.76,.197,.17,['apartment','warehouse']),pad(.365,.768,.17,.164,['utility','office']),pad(.424,.655,.28,.11,['row-shops'],-.08)],
    ]),
    lot('narrow-yard',[[.758,.566],[.837,.54],[.876,.568],[.855,.681],[.816,.817],[.797,.838],[.668,.837],[.682,.789],[.741,.746],[.778,.683]],[
      [pad(.765,.788,.125,.112,['relay'],-.20)],
    ]),
  ])}),
});

function inside([x,y],polygon){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [a,b]=polygon[i],[c,d]=polygon[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
  }
  return hit;
}
function intersects(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<-1e-14&&cross(c,d,a)*cross(c,d,b)<-1e-14;
}
export function cityFootprintFits(footprint,polygon){
  return footprint.every(p=>inside(p,polygon))&&footprint.every((a,i)=>{
    const b=footprint[(i+1)%footprint.length];
    return polygon.every((c,j)=>!intersects(a,b,c,polygon[(j+1)%polygon.length]));
  });
}
export function cityBuildingFootprint(row){
  const [l,t,r,b]=CITY_BUILDINGS[row.asset],size=row.width/CITY_TILE_UNITS;
  const angle=-(row.angle??0),cos=Math.cos(angle),sin=Math.sin(angle);
  return [[l,t],[r,t],[r,b],[l,b]].map(([u,v])=>{
    const dx=(u-.5)*size,dy=(v-.5)*size;
    return[row.x/CITY_TILE_UNITS+.5+dx*cos-dy*sin,
      .5-(row.z-row.tileZ)/CITY_TILE_UNITS+dx*sin+dy*cos];
  });
}
function fitBuilding(site,polygon,asset){
  const [l,t,r,b]=CITY_BUILDINGS[asset],cos=Math.cos(site.angle),sin=Math.sin(site.angle);
  let low=0,high=Math.min(site.width/(r-l),site.height/(b-t));
  const footprint=size=>[[l,t],[r,t],[r,b],[l,b]].map(([u,v])=>{
    const dx=(u-(l+r)/2)*size,dy=(v-(t+b)/2)*size;
    return[site.x+dx*cos-dy*sin,site.y+dx*sin+dy*cos];
  });
  if(!inside([site.x,site.y],polygon))throw new Error('City building anchor is outside its parcel');
  for(let i=0;i<20;i++){const size=(low+high)/2;if(cityFootprintFits(footprint(size),polygon))low=size;else high=size;}
  const size=low*.975*CITY_TILE_UNITS,dx=(l+r-1)*size/2,dy=(t+b-1)*size/2;
  return{width:size,height:size,x:(site.x-.5)*CITY_TILE_UNITS-dx*cos+dy*sin,
    z:(.5-site.y)*CITY_TILE_UNITS+dx*sin+dy*cos,angle:-site.angle};
}

export function cityBlockPlacements(variant=0){
  const rows=[],visit=Math.max(0,Math.trunc(Number(variant)||0));
  CITY_BLOCK_SEQUENCE.forEach((template,tile)=>{
    const tileZ=tile*CITY_TILE_UNITS,id=`city-block-${tile}`;
    const below=CITY_BLOCK_SEQUENCE[(tile+CITY_BLOCK_SEQUENCE.length-1)%CITY_BLOCK_SEQUENCE.length];
    const above=CITY_BLOCK_SEQUENCE[(tile+1)%CITY_BLOCK_SEQUENCE.length];
    rows.push(freeze({id,asset:template,kind:'city-ground',template,x:0,z:tileZ,
      width:CITY_TILE_UNITS,height:CITY_TILE_UNITS,order:.2,
      groundBlend:freeze({below,above,ports:CITY_ROAD_PORTS[template],belowPorts:CITY_ROAD_PORTS[below],abovePorts:CITY_ROAD_PORTS[above]})}));
    CITY_TEMPLATES[template].lots.forEach((parcel,index)=>{
      const choice=tile+index+Math.floor(index/2)+(index%3===0?visit:0),plan=parcel.plans[choice%parcel.plans.length];
      plan.forEach((site,building)=>{
        const asset=site.choices[(Math.floor(choice/parcel.plans.length)+building)%site.choices.length];
        const fit=fitBuilding(site,parcel.polygon,asset);
        rows.push(freeze({id:`${id}-${parcel.id}-${building}`,kind:'city-building',template,lot:parcel.id,parent:id,asset,
          ...fit,z:tileZ+fit.z,tileZ,order:1}));
      });
    });
  });
  return freeze(rows);
}
