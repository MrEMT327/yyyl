export const navEdges=[0,139,279.5,467.5,608,750];
export const navTop=(safeBottom=0)=>1473-safeBottom;
export function navBounds(index,safeBottom=0){
  const y=navTop(safeBottom),x=navEdges[index];
  return [x,y,navEdges[index+1]-x,1624-y];
}
