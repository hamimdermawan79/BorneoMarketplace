import {useEffect,useRef,useState} from 'react';
import {Newspaper} from 'lucide-react';
import {api} from './api';
import {contentDate,type LandingContent} from './landing-content';
import './landing-updates.css';
import {startNewsCarousel} from './news-carousel';

function newsSource(destination:string){try{return new URL(destination).hostname.replace(/^www\./,'')}catch{return 'Sumber Berita'}}

export function LandingUpdates(){
  const [content,setContent]=useState<LandingContent>({news:[],prices:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const track=useRef<HTMLDivElement>(null);
  const [slide,setSlide]=useState(0);
  const carousel=useRef<ReturnType<typeof startNewsCarousel>|null>(null);
  const load=async()=>{setLoading(true);setError('');try{setContent(await api<LandingContent>('/website/content'))}catch{setError('Informasi terbaru belum dapat dimuat.')}finally{setLoading(false)}};
  useEffect(()=>{let current=true;const refresh=()=>{void api<LandingContent>('/website/content').then(value=>{if(current){setContent(value);setError('')}}).catch(()=>{if(current)setError('Informasi terbaru belum dapat dimuat.')}).finally(()=>{if(current)setLoading(false)})};refresh();window.addEventListener('focus',refresh);return()=>{current=false;window.removeEventListener('focus',refresh)}},[]);
  const measure=()=>{const el=track.current;if(el)setSlide(Math.round(el.scrollLeft/Math.max(el.clientWidth,1)))};
  useEffect(()=>{measure();const el=track.current;if(!el)return;const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect()},[content]);
  useEffect(()=>{const el=track.current;if(!el)return;const controller=startNewsCarousel(el,content.news.length);carousel.current=controller;return()=>{controller.destroy();carousel.current=null}},[content,loading,error]);
  const selectSlide=(index:number)=>carousel.current?.select(index);
  const move=(direction:number)=>selectSlide(Math.max(0,Math.min(content.news.length-1,slide+direction)));
  const state=(empty:string)=>loading?<p role="status" className="landing-update-empty">Memuat informasi…</p>:error?<div className="landing-update-empty"><p role="alert">{error}</p><button onClick={()=>void load()}>Coba Lagi</button></div>:<p className="landing-update-empty">{empty}</p>;
  return <div className="landing-updates-group">
    <section id="harga-bahan-pokok" className="landing-updates staple-section" aria-labelledby="staple-title">
      <div className="landing-container">
        <div className="updates-heading"><h2 id="staple-title">Harga <br/><span>Bahan Pokok</span> <br/>Terkini.</h2></div>
        {content.prices.length&&!loading&&!error?<div className="official-documents">{content.prices.slice(0,3).map(item=><article key={item.id} className="official-document"><div><h3>{item.headline}</h3><div className="document-meta"><p>Diperbarui {contentDate(item.updatedAt)}</p><a href={item.destination} target="_blank" rel="noopener noreferrer">Lihat Selengkapnya<span className="updates-sr-only">: {item.headline} (tab baru)</span></a></div></div></article>)}</div>:loading||error?state(''):null}
      </div>
    </section>
    <section id="berita" className="landing-updates news-section" aria-labelledby="news-title">
      <div className="landing-container">
        <div className="updates-heading"><h2 id="news-title">Berita Terkini</h2></div>
        {content.news.length&&!loading&&!error?<div className="news-editorial-layout"><div className="news-banner">
          <div ref={track} className="news-track" onScroll={measure} tabIndex={0} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}}} role="region" aria-roledescription="carousel" aria-label="Berita terkini">
            {content.news.map((item,index)=><article className="news-item" key={item.id} aria-label={`${index+1} dari ${content.news.length}`}><a className="news-banner-link" href={item.destination} target="_blank" rel="noopener noreferrer" aria-label={`Lihat Selengkapnya: ${item.headline} (tab baru)`}><img src={item.thumbnail} alt="" loading="lazy" width="1160" height="600" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.visibility='hidden'}}/><Newspaper className="news-fallback" aria-hidden="true"/><div className="news-banner-copy"><h3>{item.headline}</h3><span className="news-read-more">Lihat Selengkapnya</span></div></a></article>)}
          </div>
          <div className="news-pagination" aria-label="Pilih berita">{content.news.map((item,index)=><button key={item.id} type="button" aria-label={`Berita ${index+1}: ${item.headline}`} aria-current={slide===index?'true':undefined} onClick={()=>selectSlide(index)}><span/></button>)}</div>
        </div><div className="news-headline-list" aria-label="Daftar berita">{content.news.map(item=><article key={item.id}><h3>{item.headline}</h3><div className="news-list-meta"><p>Sumber: {newsSource(item.destination)}</p><a href={item.destination} target="_blank" rel="noopener noreferrer" aria-label={`Lihat Selengkapnya: ${item.headline} (tab baru)`}>Lihat Selengkapnya</a></div></article>)}</div></div>:state('Berita terbaru akan hadir di sini. Nantikan kabar dari tim kami.')}
      </div>
    </section>
  </div>;
}
