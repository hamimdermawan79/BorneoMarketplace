export type StockSource='COOPERATIVE'|'VENDOR';

export function resolveStockSource(requested:StockSource|undefined,masterSource?:StockSource):StockSource{
  if(masterSource){
    if(requested&&requested!==masterSource)throw Object.assign(new Error('Sumber Produk Pokok mengikuti pengaturan superadmin. Muat ulang data produk.'),{statusCode:400});
    return masterSource;
  }
  return requested??'COOPERATIVE';
}
