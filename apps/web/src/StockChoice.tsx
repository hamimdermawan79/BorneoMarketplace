type Props<T extends string>={
  name:string;
  label:string;
  value:T;
  options:readonly {value:T;label:string}[];
  disabled?:boolean;
  onChange:(value:T)=>void;
};

export function StockChoice<T extends string>({name,label,value,options,disabled=false,onChange}:Props<T>){
  return <fieldset className="stock-choice" disabled={disabled}>
    <legend>{label} *</legend>
    <div className="stock-choice-options">
      {options.map(option=><label key={option.value}>
        <input type="radio" name={name} value={option.value} checked={value===option.value} onChange={()=>onChange(option.value)}/>
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>
}
