export const orderTransitions:Record<string,string[]>={SUBMITTED:['PREPARING','CANCELLED'],PREPARING:['SHIPPED','CANCELLED'],SHIPPED:['AWAITING_KITCHEN'],AWAITING_KITCHEN:['COMPLETED']};
// Match numeric(14,3) stock precision before reserving or comparing quantities.
export function stockPrecision(value:number){return Math.round(value*1000)/1000||0;}
export function requiredStock(product:{weighing_required:boolean;estimated_kg_per_unit:number|null},quantity:number){
  const value=product.weighing_required?Number(product.estimated_kg_per_unit)*quantity:quantity;
  if(!Number.isFinite(value)||value<=0)throw Object.assign(new Error('Jumlah stok atau estimasi berat tidak valid.'),{statusCode:400});
  return Math.max(.001,stockPrecision(value));
}
export function canTransition(from:string,to:string){return orderTransitions[from]?.includes(to)??false;}
export function lineTotal(quantityOrWeight:number,unitPrice:number){return Math.round(quantityOrWeight*unitPrice*100)/100;}
