import {ProductImage} from './ProductImage';
import { memo,useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type FormEvent } from 'react';
import { Boxes,Building2,ClipboardCheck,Eye,EyeOff,FileDown,History,LayoutDashboard,LogOut,Menu,PackagePlus,Plus,ShoppingBasket,Users,X } from 'lucide-react';
import { api,download,session,type User } from './api';
import { Landing } from './Landing';
import { IosGuide } from './IosGuide';
import { SuperadminPanel } from './SuperadminPanel';
import { BuyerPanel } from './BuyerPanel';
import './login.css';
import {cropSquareImage,uploadProductImage} from './product-images';
import {PhotoUpload} from './PhotoUpload';
import {StockChoice} from './StockChoice';
import {StockSelect} from './StockSelect';
import {OrderCard} from './OrderCard';
import {OrderEdits,type ChangeOrder,type Order} from './admin-order-updates';
import {UserBadge} from './UserBadge';
import {ManagedBuyerAccounts} from './AccountSettings';
import {StockEditor} from './StockEditor';
import {Toast} from './Toast';
import './stock-modal.css';

type Catalog={id:string;sku:string;name:string;category:string;image:string|null;orderUnit:string;priceUnit:string;weighingRequired:boolean;estimatedKgPerUnit:number|null;stockSource:'COOPERATIVE'|'VENDOR';isMaster:boolean;salePrice:number;removed?:boolean;hasStock?:boolean;availableStock:number;cooperativeStock:number;vendorStock:number};
type SpecialRequest={id:string;requestNo:string;name:string;quantity:number;unit:string;note:string|null;status:'PENDING'|'APPROVED'|'REJECTED';orderId:string|null;createdAt:string;kitchen:string};
const money=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const statusLabel:Record<string,string>={SUBMITTED:'Pesanan masuk',PREPARING:'Sedang disiapkan',SHIPPED:'Dikirim',AWAITING_KITCHEN:'Menunggu dapur',COMPLETED:'Selesai',CANCELLED:'Dibatalkan'};
function Login({onLogin}:{onLogin:(user:User)=>void}){
  const[error,setError]=useState('');
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[showPassword,setShowPassword]=useState(false);
  const[loading,setLoading]=useState(false);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if(loading)return;
    setError('');setLoading(true);
    try{
      const result=await api<{token:string;user:User}>('/auth/login',{method:'POST',body:JSON.stringify({identifier:email.trim(),password})});
      session.set(result.token);onLogin(result.user);
    }catch(err){setError((err as Error).message)}
    finally{setLoading(false)}
  };
  return <main className="login-shell production-login">
    <div className="login-stack">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-identity"><div className="login-brand"><img src="/assets/logo/logo.webp" width="160" height="160" alt=""/><span>Borneo <br/>Marketplace</span></div></div>
        <div className="login-form-side"><div className="login-heading"><h1 id="login-title">Masuk ke akun</h1></div>
        <form onSubmit={submit} aria-busy={loading}>
          <label htmlFor="login-email">Username atau email</label>
          <input id="login-email" name="identifier" type="text" required maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} disabled={loading}/>
          <label htmlFor="login-password">Password</label>
          <div className="login-password-field">
            <input id="login-password" name="password" type={showPassword?'text':'password'} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading}/>
            <button className="login-password-toggle" type="button" aria-label={showPassword?'Sembunyikan password':'Tampilkan password'} aria-controls="login-password" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
          </div>
          {error&&<p className="form-error" role="alert">{error}</p>}
          <button className="primary login-submit" type="submit" disabled={loading}>{loading?'Memeriksa akun…':'Masuk'}</button>
        </form>
        <p className="login-help">Kendala akses? Hubungi admin pengelola Anda.</p>
        </div>
      </section>
      <a className="login-back" href="/">Kembali ke beranda</a>
    </div>
  </main>
}

export function Shell({user,onLogout}:{user:User;onLogout:()=>void}){
  const[page,setPage]=useState('dashboard');const[menuOpen,setMenuOpen]=useState(false);const mainRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const animation=mainRef.current?.animate?.([{opacity:.55},{opacity:1}],{duration:220,easing:'cubic-bezier(.2,.65,.3,1)'});return()=>animation?.cancel()},[page]);
  const nav=user.role==='BUYER'?[['dashboard','Beranda',LayoutDashboard],['orders','Pesanan',ClipboardCheck],['catalog','Katalog',ShoppingBasket],['request','Pesan Barang',Plus],['profile','Profil',Users]]:user.role==='ADMIN'?[['dashboard','Dashboard',LayoutDashboard],['orders','Pesanan',ClipboardCheck],['inventory','Produk & Stok',PackagePlus],['partners','Akun Mitra',Users],['reports','Laporan',FileDown]]:[['dashboard','Ringkasan',LayoutDashboard],['users','Pengguna & Role',Users],['products','Produk Pokok',PackagePlus],['clusters','Cluster Admin–Dapur',Boxes],['organizations','Organisasi',Building2],['orders','Semua Pesanan',ClipboardCheck],['audit','Audit Aktivitas',History],['reports','Laporan',FileDown],['website','Kelola Website',Building2],['settings','Pengaturan',Boxes]];
  const topbar:Record<string,string>={dashboard:user.role==='BUYER'?'Ruang Pengadaan Dapur':user.role==='ADMIN'?'Operasional Koperasi':'Kontrol Borneo Marketplace',catalog:'Katalog Koperasi',request:'Pesan Barang',orders:user.role==='BUYER'?'Pesanan Saya':user.role==='ADMIN'?'Manajemen Pesanan':'Pengawasan Pesanan',profile:'Identitas Mitra',inventory:'Produk & Persediaan',partners:'Manajemen Mitra',users:'Manajemen Pengguna',products:'Produk Pokok',clusters:'Manajemen Cluster',organizations:'Direktori Organisasi',audit:'Audit Aktivitas',settings:'Pengaturan',website:'Kelola Website',reports:'Laporan Perusahaan'};
  const mobileIds=user.role==='ADMIN'?['dashboard','orders','inventory','reports']:['dashboard','users','clusters','reports'];
  const mobileLabels:Record<string,string>={dashboard:'Beranda',orders:'Pesanan',inventory:'Stok',reports:'Laporan',users:'Pengguna',clusters:'Cluster'};
  const activeMobileIndex=user.role==='BUYER'?Math.max(0,nav.findIndex(item=>item[0]===page)):menuOpen||!mobileIds.includes(page)?4:mobileIds.indexOf(page);
  const mobileNavStyle={'--nav-index':activeMobileIndex} as CSSProperties;
  const go=(next:string)=>{setPage(next);setMenuOpen(false);window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
  return <div className={`app-shell role-${user.role.toLowerCase()}${menuOpen?' mobile-menu-open':''}`} data-page={page}>
    <aside aria-label="Navigasi utama"><button className="mobile-sidebar-close" aria-label="Tutup menu" onClick={()=>setMenuOpen(false)}><X size={20}/></button><div className="brand"><img src="/assets/logo/logo.webp" alt=""/><span><b>Borneo</b> Marketplace</span></div><nav>{nav.map(([id,label,Icon])=><button key={id as string} className={`${page===id?'active':''}${mobileIds.includes(id as string)?' mobile-primary-link':''}`} onClick={()=>go(id as string)}><Icon size={18}/>{label as string}</button>)}</nav><button className="logout" onClick={onLogout}><LogOut size={18}/>Keluar</button></aside>
    {user.role!=='BUYER'&&<button className="mobile-nav-backdrop" aria-label="Tutup menu" aria-hidden={!menuOpen} disabled={!menuOpen} tabIndex={menuOpen?0:-1} onClick={()=>setMenuOpen(false)}/>}
<section className="workspace"><header><a className="mobile-app-brand" href="/" aria-label="Borneo Marketplace — beranda"><img src="/assets/logo/logo.webp" width="40" height="40" alt=""/><span><b>Borneo</b><span>Marketplace</span></span></a>{user.role!=='BUYER'&&<button className="mobile-menu-toggle" aria-label="Buka menu" onClick={()=>setMenuOpen(true)}><Menu size={20}/></button>}<strong className="topbar-title">{topbar[page]}</strong><UserBadge user={user}/></header><main ref={mainRef}>{user.role==='BUYER'?<BuyerPanel page={page} user={user} go={go} onLogout={onLogout}/>:user.role==='ADMIN'?<Admin page={page} go={go} user={user}/>:<SuperadminPanel page={page} currentUser={user}/>}</main></section>
    {user.role==='BUYER'&&<nav className="buyer-bottom-nav" aria-label="Navigasi buyer" style={mobileNavStyle}><span className="nav-glass-indicator" aria-hidden="true"/>{nav.map(([id,label,Icon])=><button key={id as string} className={page===id?'active':''} onClick={()=>go(id as string)} aria-current={page===id?'page':undefined}><span className="nav-icon"><Icon size={19}/></span><span className="nav-label">{label as string}</span></button>)}</nav>}
    {user.role!=='BUYER'&&<nav className="buyer-bottom-nav staff-bottom-nav" aria-label="Navigasi mobile" style={mobileNavStyle}><span className="nav-glass-indicator" aria-hidden="true"/>{mobileIds.map(id=>{const entry=nav.find(item=>item[0]===id)!;const Icon=entry[2];return <button key={id} className={page===id&&!menuOpen?'active':''} aria-current={page===id?'page':undefined} onClick={()=>go(id)}><span className="nav-icon"><Icon size={19}/></span><span className="nav-label">{mobileLabels[id]}</span></button>})}<button className={menuOpen||!mobileIds.includes(page)?'active':''} aria-label="Menu lainnya" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}><span className="nav-icon"><Menu size={19}/></span><span className="nav-label">Lainnya</span></button></nav>}
  </div>
}

function Buyer({page}:{page:string}){const[catalog,setCatalog]=useState<Catalog[]>([]);const[orders,setOrders]=useState<Order[]>([]);const[quantities,setQuantities]=useState<Record<string,number>>({});const[notice,setNotice]=useState('');const load=()=>Promise.all([api<Catalog[]>('/catalog').then(setCatalog),api<Order[]>('/orders').then(setOrders)]);useEffect(()=>{load()},[]);const checkout=async()=>{const items=Object.entries(quantities).filter(([,qty])=>qty>0).map(([adminProductId,quantity])=>({adminProductId,quantity}));if(!items.length)return setNotice('Pilih minimal satu barang.');try{await api('/orders',{method:'POST',body:JSON.stringify({neededDate:new Date(Date.now()+86400000).toISOString().slice(0,10),idempotencyKey:crypto.randomUUID(),items})});setQuantities({});setNotice('Pesanan dikirim ke admin koperasi.');await load();}catch(e){setNotice((e as Error).message)}};const action=async(order:Order,status:string)=>{await api(`/orders/${order.id}/status`,{method:'PATCH',body:JSON.stringify({status})});load()};if(page==='orders')return <Page title="Pesanan Saya"><div className="order-stack">{orders.map(order=><OrderCard key={order.id} order={order} buyerAction={order.status==='AWAITING_KITCHEN'?()=>action(order,'COMPLETED'):undefined}/>)}</div></Page>;return <Page title="Katalog Dapur" action={<button className="primary" onClick={checkout}>Buat pesanan</button>}>{notice&&<p className="notice">{notice}</p>}<div className="product-grid">{catalog.map(product=><article className="product-card" key={product.id}><ProductImage src={product.image||'/assets/logo/logo.webp'} alt={product.name}/><div><small>{product.category}</small><h2>{product.name}</h2><p>{money(Number(product.salePrice))} / {product.priceUnit}</p><p className="stock">Tersedia {Number(product.availableStock).toLocaleString('id-ID')} {product.priceUnit}</p><label>Jumlah ({product.orderUnit})<input type="number" min="0" value={quantities[product.id]||''} onChange={e=>setQuantities(q=>({...q,[product.id]:Number(e.target.value)}))}/></label>{product.weighingRequired&&<small>Perkiraan {product.estimatedKgPerUnit} kg per {product.orderUnit}; berat final ditimbang saat pengiriman.</small>}</div></article>)}</div></Page>}

function Admin({page,go,user}:{page:string;go:(page:string)=>void;user:User}){
  const[catalog,setCatalog]=useState<Catalog[]>([]);const[orders,setOrders]=useState<Order[]>([]);const[vendors,setVendors]=useState<any[]>([]);const[kitchens,setKitchens]=useState<any[]>([]);const[requests,setRequests]=useState<SpecialRequest[]>([]);const[message,setMessage]=useState('');
  const[edits]=useState(()=>new OrderEdits());
  const changeOrder=useCallback<ChangeOrder>((id,update)=>setOrders(current=>current.map(order=>order.id===id?update(order):order)),[]);
  const reloadStock=useCallback(()=>{void api<Catalog[]>('/catalog').then(setCatalog).catch(error=>setMessage((error as Error).message));},[]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(edits.hasPending()){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[edits]);
  const load=()=>Promise.all([api<Catalog[]>('/catalog').then(setCatalog),api<Order[]>('/orders').then(setOrders),api<any[]>('/vendors').then(setVendors),api<any[]>('/my-kitchens').then(setKitchens),api<SpecialRequest[]>('/special-requests').then(setRequests)]);useEffect(()=>{load()},[]);
  if(page==='inventory')return <Inventory catalog={catalog} vendors={vendors} reload={load} notify={setMessage} message={message}/>;
  if(page==='orders')return <AdminOrders orders={orders} edits={edits} onOrderChange={changeOrder} onStockChanged={reloadStock}/>;
  if(page==='partners')return <AdminPartners kitchens={kitchens} reload={load}/>;
  if(page==='reports')return <Reports/>;
  const active=orders.filter(order=>!['COMPLETED','CANCELLED'].includes(order.status));const completed=orders.filter(order=>order.status==='COMPLETED');const stockedCatalog=catalog.filter(product=>!product.removed&&Number(product.availableStock)>0);const lowStock=stockedCatalog.filter(product=>Number(product.availableStock)<15);
return <div className="admin-dashboard-home"><h1 className="mobile-dashboard-name">{user.name}</h1><Page title="Dashboard admin" action={<span className="heading-actions"><button onClick={()=>go('partners')}>Buat akun mitra</button><button className="primary" onClick={()=>go('inventory')}>Tambah stok</button></span>}><div className="metrics admin-metrics compact-admin-metrics"><AdminMetric label="Pesanan baru" value={orders.filter(order=>order.status==='SUBMITTED').length} note="Perlu dikonfirmasi"/><AdminMetric label="Semua pesanan" value={orders.length} note="Lintas seluruh status"/><AdminMetric label="Stok kritis" value={lowStock.length} note="Di bawah 15 unit"/><AdminMetric label="Mitra dapur" value={kitchens.length} note="Akun Buyer aktif"/></div><div className="dashboard-content-sheet"><section className="panel dashboard-section preparation-focus"><div className="panel-heading"><h2>Persiapan barang</h2></div><AdminOrderGroups orders={active} edits={edits} onOrderChange={changeOrder} onStockChanged={reloadStock}/></section><SpecialRequests requests={requests.filter(request=>request.status==='PENDING')} vendors={vendors} reload={load}/><section className="panel dashboard-section"><div className="panel-heading"><h2>Pesanan selesai</h2><span>{completed.length} pesanan</span></div><div className="completed-orders">{completed.map(order=><details key={order.id}><summary><time>{new Date(order.neededDate).toLocaleDateString('id-ID')}</time><strong>{order.kitchen}</strong><span>{order.items.length} jenis barang</span></summary><div>{order.items.map(item=><p key={item.id}><span>{item.name}</span><b>{item.quantity} {item.orderUnit}</b></p>)}</div></details>)}{!completed.length&&<DashboardEmpty text="Belum ada pesanan selesai."/>}</div></section><section className="panel dashboard-section"><div className="panel-heading"><h2>Produk dan persediaan</h2></div>{stockedCatalog.map(product=><div className="simple-row" key={product.id}><span><strong>{product.name}</strong><small>{money(Number(product.salePrice))}/{product.priceUnit}</small></span><b>{Number(product.availableStock).toLocaleString('id-ID')} {product.priceUnit}</b></div>)}{!stockedCatalog.length&&<DashboardEmpty text="Belum ada stok yang dicatat."/>}</section></div></Page></div>
}

function AdminMetric({label,value,note}:{label:string;value:number;note:string}){return <article className="metric"><div className="metric-label">{label}</div><strong>{value}</strong><small>{note}</small></article>}
function DashboardEmpty({text}:{text:string}){return <div className="dashboard-empty">{text}</div>}

export function AdminOrders({orders,...mutations}:{orders:Order[]}&OrderMutations){const[filter,setFilter]=useState('active');const visible=orders.filter(order=>filter==='active'?!['COMPLETED','CANCELLED'].includes(order.status):filter==='COMPLETED'?order.status==='COMPLETED':order.status===filter);return <Page title="Pesanan"><div className="metrics admin-metrics"><AdminMetric label="Perlu dikonfirmasi" value={orders.filter(order=>order.status==='SUBMITTED').length} note="Menunggu tindakan"/><AdminMetric label="Sedang diproses" value={orders.filter(order=>['PREPARING','SHIPPED','AWAITING_KITCHEN'].includes(order.status)).length} note="Disiapkan sampai diterima"/><AdminMetric label="Selesai" value={orders.filter(order=>order.status==='COMPLETED').length} note="Pesanan tuntas"/><AdminMetric label="Semua pesanan" value={orders.length} note="Lintas seluruh status"/></div><section className="panel dashboard-section orders-list-panel"><div className="panel-heading"><h2>Daftar pesanan</h2><div className="filter-row">{[['active','Pesanan aktif'],['SUBMITTED','Menunggu'],['PREPARING','Disiapkan'],['SHIPPED','Dikirim'],['AWAITING_KITCHEN','Konfirmasi dapur'],['COMPLETED','Riwayat selesai']].map(([value,label])=><button className={filter===value?'active':''} aria-pressed={filter===value} key={value} onClick={()=>setFilter(value)}>{label}</button>)}</div></div><AdminOrderGroups orders={visible} {...mutations}/></section></Page>}

type OrderMutations={reload?:()=>Promise<unknown>;edits?:OrderEdits;onOrderChange?:ChangeOrder;onStockChanged?:()=>void};

function AdminOrderGroups({orders,...mutations}:{orders:Order[]}&OrderMutations){
  const groups=useMemo(()=>{const result=new Map<string,Order[]>();for(const order of orders){const key=`${order.kitchen}|${order.neededDate.slice(0,10)}`;result.set(key,[...(result.get(key)||[]),order])}return [...result.values()]},[orders]);
  if(!groups.length)return <DashboardEmpty text="Tidak ada pesanan pada status ini."/>;
  return <div className="admin-order-groups">{groups.map(group=><AdminOrderGroup key={`${group[0].kitchen}|${group[0].neededDate.slice(0,10)}`} group={group} {...mutations}/>)}</div>
}

const AdminOrderGroup=memo(function AdminOrderGroup({group,...mutations}:{group:Order[]}&OrderMutations){
  const first=group[0];
  const statuses=[...new Set(group.map(order=>statusLabel[order.status]))];
  const combined=useMemo<Order>(()=>({...first,status:group.some(order=>order.status==='SUBMITTED')?'SUBMITTED':group.some(order=>order.status==='PREPARING')?'PREPARING':first.status,items:group.flatMap(order=>order.items),estimatedTotal:group.reduce((sum,order)=>sum+Number(order.finalTotal??order.estimatedTotal),0),finalTotal:null}),[group]);
  return <section className="admin-kitchen-day"><header><div className="kitchen-title"><h3>{first.kitchen}</h3><details className="invoice-info"><summary aria-label={`Informasi invoice ${first.kitchen}`}>i</summary><div className="invoice-tooltip"><strong>No. invoice</strong>{group.map(order=><span key={order.id}>{order.orderNo}</span>)}</div></details></div><div className="kitchen-order-meta"><time>{new Date(first.neededDate).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</time><div className="group-statuses">{statuses.map(value=><span key={value}>{value}</span>)}</div></div></header><div className="admin-day-orders"><OrderCard order={combined} groupedOrders={group} admin embedded {...mutations}/></div></section>;
},(before,after)=>before.edits===after.edits&&before.onOrderChange===after.onOrderChange&&before.onStockChanged===after.onStockChanged&&before.reload===after.reload&&before.group.length===after.group.length&&before.group.every((order,index)=>order===after.group[index]));

function SpecialRequests({requests,vendors,reload}:{requests:SpecialRequest[];vendors:any[];reload:()=>Promise<any>}){
  const[notice,setNotice]=useState('');
  const groups=Array.from(new Set(requests.map(request=>request.kitchen)));
  return <section className="panel dashboard-section"><div className="panel-heading"><h2>Permintaan di luar katalog</h2><span>{requests.length} permintaan</span></div>{notice&&<div className="notice" role="status">{notice}</div>}<div className="special-kitchen-list">{groups.map(kitchen=><section className="special-kitchen" key={kitchen}><h3>{kitchen}</h3>{requests.filter(request=>request.kitchen===kitchen).map(request=><SpecialRequestForm key={request.id} request={request} vendors={vendors} reload={reload} notify={setNotice}/>)}</section>)}{!requests.length&&<DashboardEmpty text="Belum ada permintaan barang."/>}</div></section>
}
function SpecialRequestForm({request,vendors,reload,notify}:{request:SpecialRequest;vendors:any[];reload:()=>Promise<any>;notify:(message:string)=>void}){
  const[source,setSource]=useState('COOPERATIVE');const[vendorName,setVendorName]=useState('');const[busy,setBusy]=useState(false);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);setBusy(true);try{await api(`/special-requests/${request.id}/approve`,{method:'PATCH',body:JSON.stringify({source,vendorName:source==='VENDOR'?vendorName.trim():null,unit:data.get('unit'),salePrice:data.get('salePrice')})});notify('Permintaan disetujui dan masuk ke pesanan aktif.');await reload()}catch(reason){notify((reason as Error).message)}finally{setBusy(false)}};
  const reject=async()=>{setBusy(true);try{await api(`/special-requests/${request.id}/reject`,{method:'PATCH',body:'{}'});notify('Permintaan ditolak.');await reload()}catch(reason){notify((reason as Error).message)}finally{setBusy(false)}};
  return <form className="special-item-form" onSubmit={submit}><div className="special-item-title"><strong>{request.name}</strong><span>{Number(request.quantity).toLocaleString('id-ID')} {request.unit}</span>{request.note&&<p>{request.note}</p>}</div><div className="special-item-fields"><label>Satuan<input name="unit" required maxLength={40} defaultValue={request.unit}/></label><label>Harga jual per satuan<input name="salePrice" type="number" min="0" step="0.01" required/></label><label>Sumber<select value={source} onChange={event=>setSource(event.target.value)}><option value="COOPERATIVE">Koperasi</option><option value="VENDOR">Vendor</option></select></label>{source==='VENDOR'&&<label>Nama vendor<input required minLength={2} maxLength={120} list={`vendors-${request.id}`} value={vendorName} placeholder="Ketik nama vendor" onChange={event=>setVendorName(event.target.value)}/><datalist id={`vendors-${request.id}`}>{vendors.map(vendor=><option key={vendor.id} value={vendor.name}/>)}</datalist></label>}<div className="special-item-actions"><button type="button" disabled={busy} onClick={reject}>Tolak</button><button className="primary" disabled={busy}>{busy?'Memproses…':'Setujui'}</button></div></div></form>
}

function AdminPartners({kitchens,reload}:{kitchens:any[];reload:()=>Promise<any>}){const[notice,setNotice]=useState('');const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;const data=new FormData(form);try{const result=await api<{username:string;temporaryPassword:string}>('/partners',{method:'POST',body:JSON.stringify({username:data.get('username'),email:data.get('email'),name:data.get('name'),phone:data.get('phone'),address:data.get('address'),gmapsUrl:data.get('gmapsUrl')})});setNotice(`Akun dibuat: ${result.username} · password awal ${result.temporaryPassword}`);form.reset();reload()}catch(reason){setNotice((reason as Error).message)}};return <Page title="Akun mitra"><div className="partner-admin-stack">{notice&&<div className="notice" role="status">{notice}</div>}<ManagedBuyerAccounts key={kitchens.length}/><section className="panel partner-form-panel"><div className="panel-heading"><h2>Tambah akun dapur</h2></div><form className="partner-form" onSubmit={submit}><label>Username *<input name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" autoCapitalize="none"/></label><label>Email (opsional)<input name="email" type="email"/></label><label>Nama dapur *<input name="name" required/></label><label>Nomor HP *<input name="phone" type="tel" minLength={6} required/></label><label>Alamat lengkap *<textarea name="address" rows={4} required/></label><label>Link Google Maps lokasi dapur (opsional)<input name="gmapsUrl" type="url" placeholder="https://maps.app.goo.gl/..."/></label><button className="primary">Buat akun mitra</button></form></section></div></Page>}

export function Inventory({catalog,vendors,reload,notify,message}:{catalog:Catalog[];vendors:any[];reload:()=>Promise<any>;notify:(v:string)=>void;message:string}){
  const[editingStock,setEditingStock]=useState<Catalog|null>(null);
  const[modalOpen,setModalOpen]=useState(false);const[productMode,setProductMode]=useState<'TEMPLATE'|'CUSTOM'>('TEMPLATE');const[selectedProduct,setSelectedProduct]=useState('');const[source,setSource]=useState<'COOPERATIVE'|'VENDOR'>('COOPERATIVE');const[salePrice,setSalePrice]=useState('');const[vendorName,setVendorName]=useState('');const[suggestionsOpen,setSuggestionsOpen]=useState(false);const[saving,setSaving]=useState(false);const[customImage,setCustomImage]=useState('');const[imageX,setImageX]=useState(50);const[imageY,setImageY]=useState(50);const[imageZoom,setImageZoom]=useState(1);const[imageBusy,setImageBusy]=useState(false);
  const dismissNotice=useCallback(()=>notify(''),[notify]);
  const selected=catalog.find(product=>product.id===selectedProduct);
  const masterCatalog=catalog.filter(product=>product.isMaster);
  const customCatalog=catalog.filter(product=>!product.isMaster);
  const isNewCustom=productMode==='CUSTOM'&&!selectedProduct;
  const effectiveSource=productMode==='TEMPLATE'?(selected?.stockSource??'COOPERATIVE'):source;const stockedCatalog=catalog.filter(product=>!product.removed&&(product.hasStock||Number(product.availableStock)>0));
  const vendorSuggestions=vendorName.trim()?vendors.filter(vendor=>vendor.name.toLocaleLowerCase('id-ID').includes(vendorName.trim().toLocaleLowerCase('id-ID'))).slice(0,6):[];
  const reset=()=>{setProductMode('TEMPLATE');setSelectedProduct('');setSalePrice('');setSource('COOPERATIVE');setVendorName('');setSuggestionsOpen(false);setCustomImage('');setImageX(50);setImageY(50);setImageZoom(1)};
  const close=()=>{if(saving||imageBusy)return;setModalOpen(false);reset()};
  const addStock=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(imageBusy||saving)return;const d=new FormData(e.currentTarget);setSaving(true);try{const image=isNewCustom&&customImage?await cropSquareImage(customImage,imageX,imageY,imageZoom):null;await api('/stock',{method:'POST',body:JSON.stringify({adminProductId:selectedProduct||null,customProduct:isNewCustom?{name:d.get('customName'),category:d.get('customCategory'),unit:d.get('customUnit'),image}:null,salePrice:d.get('salePrice'),source:effectiveSource,vendorName:effectiveSource==='VENDOR'?vendorName.trim():null,quantity:d.get('quantity')})});notify(isNewCustom?'Produk baru dan stok berhasil ditambahkan.':'Stok berhasil ditambahkan.');setModalOpen(false);reset();await reload()}catch(err){notify((err as Error).message)}finally{setSaving(false)}};
  const selectImage=async(file?:File)=>{if(!file)return;setImageBusy(true);setCustomImage('');try{setCustomImage(await uploadProductImage(file));setImageX(50);setImageY(50);setImageZoom(1)}catch(error){notify((error as Error).message)}finally{setImageBusy(false)}};
  return <Page title="Produk & Stok" action={<button className="primary" onClick={()=>setModalOpen(true)}><Plus size={16}/>Tambah stok</button>}>
    <Toast message={message} onDismiss={dismissNotice}/>
    <section className="panel stock-list-panel"><div className="panel-heading"><div><h2>Daftar Produk & Stok</h2><p>Kelola informasi produk, harga, dan persediaan Anda.</p></div><span className="stock-product-count">{stockedCatalog.length} Produk</span></div>{stockedCatalog.length?<div className="stock-table-wrap"><table className="stock-table"><thead><tr><th scope="col">Produk</th><th scope="col">Harga Jual</th><th scope="col">Koperasi</th><th scope="col">Vendor</th><th scope="col">Total Stok</th><th scope="col">Aksi</th></tr></thead><tbody>{stockedCatalog.map(p=><tr key={p.id}><td><div className="stock-product-cell"><div className="stock-product-thumb">{p.image?<ProductImage src={p.image} alt=""/>:<PackagePlus size={22} aria-hidden="true"/>}</div><div><strong>{p.name}</strong><small>{p.category} · {p.priceUnit}</small></div></div></td><td data-label="Harga jual">{money(Number(p.salePrice))}</td><td data-label="Koperasi">{Number(p.cooperativeStock).toLocaleString('id-ID')} {p.priceUnit}</td><td data-label="Vendor">{Number(p.vendorStock).toLocaleString('id-ID')} {p.priceUnit}</td><td data-label="Total stok"><strong className="stock-total">{Number(p.availableStock).toLocaleString('id-ID')} {p.priceUnit}</strong></td><td data-label="Aksi"><button type="button" aria-label={`Edit Produk & Stok ${p.name}`} onClick={()=>setEditingStock(p)}>Edit Produk & Stok</button></td></tr>)}</tbody></table></div>:<div className="stock-empty"><PackagePlus size={26}/><strong>Belum ada stok</strong><span>Gunakan tombol Tambah stok untuk mencatat persediaan pertama.</span></div>}</section>
{editingStock&&<StockEditor product={editingStock} onClose={()=>setEditingStock(null)} onSaved={async(action)=>{try{await reload();notify(action==='deleted'?'Produk berhasil dihapus dari katalog Anda.':'Produk dan stok berhasil diperbarui.')}catch{notify(action==='deleted'?'Produk sudah dihapus, tetapi daftar belum dapat diperbarui. Muat ulang halaman.':'Perubahan sudah tersimpan, tetapi daftar belum dapat diperbarui. Muat ulang halaman.')}}}/>}
    {modalOpen&&<div className="modal-backdrop stock-modal-backdrop"><section className="modal-card stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title"><header><h2 id="stock-modal-title">Tambah stok</h2><button type="button" aria-label="Tutup" onClick={close}><X size={19}/></button></header><form className="stock-modal-form" onSubmit={addStock}><div className="stock-form-fields">
      <div className={productMode==='TEMPLATE'?'stock-setup-grid master-mode':'stock-setup-grid'}>
        <StockChoice name="productMode" label="Jenis produk" value={productMode} disabled={saving||imageBusy} options={[{value:'TEMPLATE',label:'Pokok'},{value:'CUSTOM',label:'Baru'}]} onChange={value=>{setProductMode(value);setSelectedProduct('');setSalePrice('');setVendorName('');setSuggestionsOpen(false)}}/>
        {productMode==='CUSTOM'&&<StockChoice name="source" label="Sumber barang" value={source} disabled={saving||imageBusy} options={[{value:'COOPERATIVE',label:'Koperasi'},{value:'VENDOR',label:'Vendor'}]} onChange={value=>{setSource(value);if(value==='COOPERATIVE'){setVendorName('');setSuggestionsOpen(false)}}}/>}
      </div>
      {effectiveSource==='VENDOR'&&<label className="vendor-combobox">Nama vendor *<input value={vendorName} minLength={2} maxLength={120} required autoComplete="off" aria-autocomplete="list" aria-expanded={suggestionsOpen&&vendorSuggestions.length>0} onFocus={()=>setSuggestionsOpen(true)} onChange={event=>{setVendorName(event.target.value);setSuggestionsOpen(true)}} placeholder="Contoh: Toko Lili"/>{suggestionsOpen&&vendorSuggestions.length>0&&<div className="vendor-suggestions" role="listbox" aria-label="Vendor tersimpan">{vendorSuggestions.map(vendor=><button type="button" role="option" key={vendor.id} onMouseDown={event=>event.preventDefault()} onClick={()=>{setVendorName(vendor.name);setSuggestionsOpen(false)}}>{vendor.name}</button>)}</div>}<small>Ketik nama baru atau pilih vendor yang pernah digunakan.</small></label>}
      {productMode==='TEMPLATE'?<>
        <div className="stock-modal-grid"><label>Nama barang *<StockSelect name="adminProductId" required disabled={saving||imageBusy} value={selectedProduct} onChange={event=>{const id=event.target.value;setSelectedProduct(id);setVendorName('');setSuggestionsOpen(false);const product=masterCatalog.find(item=>item.id===id);setSalePrice(product&&Number(product.salePrice)>0?String(product.salePrice):'')}}><option value="">Pilih produk</option>{masterCatalog.map(p=><option value={p.id} key={p.id}>{p.name}{p.removed?' (Tambah stok untuk aktifkan kembali)':''}</option>)}</StockSelect></label><label>Satuan stok<input readOnly value={selected?.priceUnit||'—'} aria-label="Satuan stok"/></label></div>
        {selected&&<p className="stock-source-fixed">Sumber: <strong>{effectiveSource==='VENDOR'?'Vendor':'Koperasi'}</strong></p>}
      </>:<>
        {customCatalog.length>0&&<label>Produk tambahan<StockSelect disabled={saving||imageBusy} value={selectedProduct} onChange={event=>{const id=event.target.value;setSelectedProduct(id);const product=customCatalog.find(item=>item.id===id);setSalePrice(product&&Number(product.salePrice)>0?String(product.salePrice):'')}}><option value="">Buat produk baru</option>{customCatalog.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</StockSelect></label>}
        {isNewCustom&&<div className="stock-modal-grid"><label>Nama produk *<input name="customName" minLength={2} maxLength={120} required/></label><label>Kategori *<input name="customCategory" minLength={2} maxLength={80} required placeholder="Contoh: Bahan pokok"/></label></div>}
      </>}
      <div className={productMode==='CUSTOM'?'stock-modal-grid stock-quantity-grid':'stock-modal-grid'}>{productMode==='CUSTOM'&&<label>Satuan *{isNewCustom?<input name="customUnit" maxLength={30} required placeholder="kg, dus, liter"/>:<input readOnly value={selected?.priceUnit||'—'}/>}</label>}<label>Jumlah stok *<input name="quantity" type="number" min="0.001" step="0.001" required/></label><label>Harga jual per satuan *<input name="salePrice" type="number" min="0" required value={salePrice} onChange={event=>setSalePrice(event.target.value)}/></label></div>
      {isNewCustom&&<div className="stock-photo-section"><PhotoUpload centered value={customImage} busy={imageBusy} disabled={saving} onSelect={file=>void selectImage(file)} onClear={()=>setCustomImage('')}/>{customImage&&<div className="crop-editor"><div className="crop-preview"><img src={customImage} alt="Pratinjau potongan produk" style={{objectPosition:`${imageX}% ${imageY}%`,transform:`scale(${imageZoom})`,transformOrigin:`${imageX}% ${imageY}%`}}/></div><div className="crop-controls"><label>Posisi horizontal<input type="range" min="0" max="100" value={imageX} onChange={event=>setImageX(Number(event.target.value))}/></label><label>Posisi vertikal<input type="range" min="0" max="100" value={imageY} onChange={event=>setImageY(Number(event.target.value))}/></label><label>Zoom<input type="range" min="1" max="2" step="0.05" value={imageZoom} onChange={event=>setImageZoom(Number(event.target.value))}/></label></div></div>}</div>}
      </div>
      <div className="modal-actions"><button type="button" onClick={close}>Batal</button><button className="primary" disabled={saving||imageBusy}>{saving?'Menyimpan…':'Simpan stok'}</button></div>
    </form></section></div>}
  </Page>
}


function Reports(){return <ReportsView/>}
function Page({title,action,children}:{title:string;action?:React.ReactNode;children:React.ReactNode}){return <><div className="page-title"><h1>{title}</h1>{action}</div>{children}</>}
function Metric({label,value}:{label:string;value:number}){return <article className="metric"><small>{label}</small><strong>{value}</strong></article>}
export function App(){
  const[user,setUser]=useState<User|null>(null);const[checking,setChecking]=useState(true);const[path,setPath]=useState(window.location.pathname);
  const navigate=(next:string,replace=false)=>{window.history[replace?'replaceState':'pushState']({},'',next);setPath(next)};
  useEffect(()=>{const onPop=()=>setPath(window.location.pathname);window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);
  useEffect(()=>{if(!session.token){setChecking(false);return}api<User>('/auth/me').then(setUser).catch(()=>session.clear()).finally(()=>setChecking(false))},[]);
  if(path==='/')return <Landing signedIn={Boolean(user)}/>;
  if(path==='/panduan-ios')return <IosGuide/>;
  if(checking)return <div className="loading">Memuat…</div>;
  if(path==='/login'&&!user)return <Login onLogin={account=>{setUser(account);navigate('/app',true)}}/>;
  if(!user)return <Login onLogin={account=>{setUser(account);navigate('/app',true)}}/>;
  return <Shell user={user} onLogout={()=>{session.clear();setUser(null);navigate('/login',true)}}/>
}
import { ReportsView } from './ReportsView';
