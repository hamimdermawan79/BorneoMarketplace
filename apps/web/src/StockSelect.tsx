import type {ComponentProps} from 'react';
import {ChevronDown} from 'lucide-react';

// Keep the native picker and keyboard behavior; only replace its cramped arrow.
export function StockSelect({children,...props}:ComponentProps<'select'>){
  return <span className="stock-select"><select {...props}>{children}</select><ChevronDown size={18} aria-hidden="true" focusable="false"/></span>;
}
