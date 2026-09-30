export const orderTransitions:Record<string,string[]>={SUBMITTED:['PREPARING','CANCELLED'],PREPARING:['SHIPPED','CANCELLED'],SHIPPED:['AWAITING_KITCHEN'],AWAITING_KITCHEN:['COMPLETED']};
export function requiredStock(product:{weighing_required:boolean;estimated_kg_per_unit:number|null},quantity:number){return product.weighing_required?Number(product.estimated_kg_per_unit)*quantity:quantity;}
export function canTransition(from:string,to:string){return orderTransitions[from]?.includes(to)??false;}
export function lineTotal(quantityOrWeight:number,unitPrice:number){return Math.round(quantityOrWeight*unitPrice*100)/100;}
