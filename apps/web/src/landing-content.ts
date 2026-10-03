export type News={id:string;headline:string;thumbnail:string;destination:string;active:boolean;createdAt:string;updatedAt:string};
export type StaplePrice=News;
export type LandingContent={news:News[];prices:StaplePrice[]};
export const contentDate=(value:string)=>new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
