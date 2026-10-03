import {useEffect,useState,type FormEvent} from 'react';
import {api} from './api';
import {uploadProductImage,productImageAccept} from './product-images';
import {contentDate,type LandingContent,type News} from './landing-content';
import './landing-content-management.css';

type Kind='prices'|'news';
const empty={headline:'',thumbnail:'',destination:'',active:true};
export function LandingContentManagement(){
  const [content,setContent]=useState<LandingContent>({news:[],prices:[]});
  const [kind,setKind]=useState<Kind>('news');
  const [draft,setDraft]=useState(empty),[editing,setEditing]=useState<string|null>(null);
  const [thumbnailChanged,setThumbnailChanged]=useState(false);
  const [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setContent(await api<LandingContent>('/management/content'));setLoaded(true)}catch(reason){setError((reason as Error).message)}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const reset=()=>{setDraft(empty);setEditing(null);setThumbnailChanged(false)};
  const changeKind=(value:Kind)=>{if((draft.headline||draft.destination||editing)&&!confirm('Ganti bagian dan batalkan perubahan yang belum disimpan?'))return;setKind(value);reset();setError('');setNotice('')};
  const edit=async(item:News)=>{setBusy(true);setError('');try{const image=await api<{thumbnail:string}>(`/management/content/${kind}/${item.id}/thumbnail`);setDraft({headline:item.headline,thumbnail:image.thumbnail,destination:item.destination,active:item.active});setEditing(item.id);setThumbnailChanged(false);document.getElementById('content-editor')?.scrollIntoView({block:'start',behavior:'instant'});document.getElementById('content-headline')?.focus()}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}};
  const save=async(event:FormEvent)=>{
    event.preventDefault();if(busy||uploading||!loaded)return;setBusy(true);setError('');setNotice('');
    try{
      const payload={headline:draft.headline,destination:draft.destination,active:draft.active,...(!editing||thumbnailChanged?(draft.thumbnail||kind==='prices'?{thumbnail:draft.thumbnail}:{}):{})};
      await api(`/management/content/${kind}${editing?`/${editing}`:''}`,{method:editing?'PUT':'POST',body:JSON.stringify(payload)});
      reset();await load();setNotice(kind==='news'?'Berita berhasil disimpan di bagian Berita Terkini.':'Dokumen disimpan. Landing page menampilkan maksimal 3 dokumen aktif terbaru.');
    }catch(reason){setError((reason as Error).message)}finally{setBusy(false)}
  };
  const remove=async(item:News)=>{if(!confirm(`Hapus “${item.headline}”?`))return;setBusy(true);setError('');try{await api(`/management/content/${kind}/${item.id}`,{method:'DELETE'});if(editing===item.id)reset();await load();setNotice('Konten dihapus.')}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}};
  const upload=async(file:File)=>{setUploading(true);setError('');try{const image=await uploadProductImage(file);if(image.length>700000)throw new Error('Thumbnail terlalu besar. Pilih gambar lebih kecil.');setDraft(current=>({...current,thumbnail:image}));setThumbnailChanged(true)}catch(reason){setError((reason as Error).message)}finally{setUploading(false)}};
  return <section className="landing-content-management">
    <header className="content-management-header"><div><h2>Konten Landing Page</h2><p>Kelola dokumen resmi dan berita untuk pengunjung website.</p></div></header>
    <p className="content-category-hint">Kategori aktif: <strong>{kind==='news'?'Berita Terkini':'Harga Bahan Pokok'}</strong>. {kind==='prices'?'Landing page menampilkan maksimal 3 dokumen aktif terbaru.':'Konten yang disimpan akan masuk ke bagian Berita Terkini.'}</p>
    <div className="content-kind-tabs" role="group" aria-label="Bagian konten"><button aria-pressed={kind==='prices'} disabled={busy||uploading} onClick={()=>changeKind('prices')}>Harga Bahan Pokok</button><button aria-pressed={kind==='news'} disabled={busy||uploading} onClick={()=>changeKind('news')}>Berita</button></div>
    {error&&<p role="alert" className="notice">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
    {!loaded&&loading?<p role="status">Memuat konten…</p>:!loaded?<button onClick={()=>void load()}>Coba Lagi</button>:<div className="content-management-grid">
      <form id="content-editor" className="panel content-editor" onSubmit={save}><fieldset disabled={busy||uploading||loading}>
        <legend>{editing?'Edit':'Tambah'} {kind==='news'?'Berita':'Dokumen Harga Bahan Pokok'}</legend>
        <label htmlFor="content-headline">{kind==='news'?'Headline':'Judul Dokumen'}<input id="content-headline" required minLength={3} maxLength={180} value={draft.headline} onChange={event=>setDraft({...draft,headline:event.target.value})}/></label>
        <label>Link Tujuan<input type="url" required maxLength={2048} placeholder={kind==='prices'?'https://drive.google.com/…':'https://…'} value={draft.destination} onChange={event=>setDraft({...draft,destination:event.target.value})}/><small>{kind==='prices'?'Gunakan link dokumen resmi kementerian. Pastikan pengunjung memiliki izin melihatnya.':'Gunakan tautan HTTPS ke halaman berita.'}</small></label>
        <label className="content-upload">Thumbnail {kind==='prices'?'(Opsional)':''}<input type="file" accept={productImageAccept} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.target.value=''}}/><small>PNG, JPG, WebP, HEIC · Maks. 8 MB</small></label>
        <details className="content-image-url"><summary>Gunakan URL Gambar</summary><label>URL Gambar<input type="url" maxLength={2048} placeholder="https://…" value={draft.thumbnail.startsWith('data:')?'':draft.thumbnail} onChange={event=>{setDraft({...draft,thumbnail:event.target.value});setThumbnailChanged(true)}}/></label></details>
        {draft.thumbnail&&<><img className="content-thumbnail-preview" src={draft.thumbnail} alt="Preview thumbnail" referrerPolicy="no-referrer"/>{kind==='prices'&&<button type="button" onClick={()=>{setDraft({...draft,thumbnail:''});setThumbnailChanged(true)}}>Hapus Thumbnail</button>}</>}
        <label className="content-publish"><input type="checkbox" checked={draft.active} onChange={event=>setDraft({...draft,active:event.target.checked})}/> Tampilkan di Landing Page</label>
        <div className="content-editor-actions">{editing&&<button type="button" onClick={reset}>Batal Edit</button>}<button className="primary" disabled={kind==='news'&&!draft.thumbnail} type="submit">{uploading?'Memproses Gambar…':busy?'Menyimpan…':editing?'Simpan Perubahan':kind==='news'?'Tambah Berita':'Tambah Dokumen Harga Bapok'}</button></div>
      </fieldset></form>
      <div className="panel content-entry-list"><h3>{kind==='news'?'Daftar Berita':'Dokumen Harga Bahan Pokok'}</h3>{loading?<p role="status">Memuat…</p>:content[kind].length?content[kind].map(item=><article key={item.id}><div><h4>{item.headline}</h4><p>{item.active?'Ditampilkan':'Disembunyikan'} · {contentDate(item.updatedAt)}</p><a href={item.destination} target="_blank" rel="noopener noreferrer">Buka Link Tujuan</a></div><div className="content-row-actions"><button disabled={busy||uploading} onClick={()=>void edit(item)}>Edit</button><button className="danger" disabled={busy||uploading} onClick={()=>void remove(item)}>Hapus</button></div></article>):<p>Belum ada konten. Tambahkan melalui formulir.</p>}</div>
    </div>}
  </section>;
}
