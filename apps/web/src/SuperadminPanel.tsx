import {ProductImage} from './ProductImage';
import {AccountEditor} from './AccountSettings';
import {uploadProductImage} from './product-images';
import {PhotoUpload} from './PhotoUpload';
import {DeleteAccountDialog} from './DeleteAccountDialog';
import { ResetData } from './ResetData';
import { WebsiteManagement } from './WebsiteManagement';
import { ReportsView } from './ReportsView';
import { useEffect,useRef,useState,type FormEvent } from 'react';
import { AlertTriangle,Building2,CheckCircle2,CircleDollarSign,ClipboardList,History,MapPin } from 'lucide-react';
import { api,type User } from './api';

type Summary={activeAdmins:number;activeKitchens:number;activeOrders:number;completedThisMonth:number;salesThisMonth:number;unassignedKitchens:number};
type AdminPerformance={id:string;name:string;email:string;active:boolean;kitchens:number;products:number;activeOrders:number;salesThisMonth:number};
type Overview={summary:Summary;statuses:{status:string;count:number}[];admins:AdminPerformance[]};
type ManagedUser={id:string;name:string;username:string;email:string|null;role:'SUPERADMIN'|'ADMIN'|'BUYER';active:boolean;organizationId:string;organization:string;phone:string|null;address:string|null;gmapsUrl:string|null;managerId:string|null;manager:string|null};
type Kitchen={id:string;name:string;phone:string|null;address:string|null;gmapsUrl:string|null;active:boolean;managerId:string|null;manager:string|null};
type Cluster={adminId:string;admin:string;email:string;active:boolean;kitchens:Kitchen[]};
type OrderItem={id:string;name:string;quantity:number;orderUnit:string;actualWeightKg:number|null};
type Order={id:string;orderNo:string;status:string;neededDate:string;kitchen:string;estimatedTotal:number;finalTotal:number|null;items:OrderItem[]};
type Organization={id:string;type:'COOPERATIVE'|'KITCHEN';name:string;phone:string|null;address:string|null;gmapsUrl:string|null;active:boolean;userCount:number;managerId:string|null;manager:string|null};
type AuditLog={id:string;action:string;entityType:string;entityId:string|null;changes:Record<string,unknown>;createdAt:string;actor:string|null;actorEmail:string|null};
type ProductTemplate={id:string;sku:string;name:string;category:string;image:string|null;orderUnit:string;priceUnit:string;weighingRequired:boolean;estimatedKgPerUnit:number|null;stockSource:'COOPERATIVE'|'VENDOR';active:boolean};

const money=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const statusLabel:Record<string,string>={SUBMITTED:'Pesanan masuk',PREPARING:'Disiapkan',SHIPPED:'Dalam pengiriman',AWAITING_KITCHEN:'Menunggu dapur',COMPLETED:'Selesai',CANCELLED:'Dibatalkan'};

export function SuperadminPanel({page,currentUser}:{page:string;currentUser:User}){
  const[overview,setOverview]=useState<Overview|null>(null);const[users,setUsers]=useState<ManagedUser[]>([]);const[clusters,setClusters]=useState<Cluster[]>([]);const[kitchens,setKitchens]=useState<Kitchen[]>([]);const[orders,setOrders]=useState<Order[]>([]);const[organizations,setOrganizations]=useState<Organization[]>([]);const[auditLogs,setAuditLogs]=useState<AuditLog[]>([]);const[templates,setTemplates]=useState<ProductTemplate[]>([]);const[error,setError]=useState('');
  const load=async()=>{setError('');try{const[dataOverview,dataUsers,dataClusters,dataKitchens,dataOrders,dataOrganizations,dataAuditLogs,dataTemplates]=await Promise.all([api<Overview>('/management/overview'),api<ManagedUser[]>('/users'),api<Cluster[]>('/clusters'),api<Kitchen[]>('/kitchens'),api<Order[]>('/orders'),api<Organization[]>('/organizations'),api<AuditLog[]>('/audit-logs'),api<ProductTemplate[]>('/templates')]);setOverview(dataOverview);setUsers(dataUsers);setClusters(dataClusters);setKitchens(dataKitchens);setOrders(dataOrders);setOrganizations(dataOrganizations);setAuditLogs(dataAuditLogs);setTemplates(dataTemplates)}catch(reason){setError((reason as Error).message)}};
  useEffect(()=>{load()},[]);
  if(error)return <ManagementPage title="Dashboard Perusahaan" dashboard><div className="management-alert error">{error}<button onClick={load}>Coba lagi</button></div></ManagementPage>;
  if(!overview)return <div className="management-loading">Memuat data perusahaan…</div>;
  if(page==='settings')return <ResetData/>;
  if(page==='website')return <WebsiteManagement/>;
  if(page==='users')return <UserManagement users={users} admins={users.filter(user=>user.role==='ADMIN')} currentUser={currentUser} reload={load}/>;
  if(page==='products')return <ProductMaster templates={templates} reload={load}/>;
  if(page==='clusters')return <ClusterManagement clusters={clusters} kitchens={kitchens} reload={load}/>;
  if(page==='organizations')return <OrganizationDirectory organizations={organizations}/>;
  if(page==='orders')return <AllOrders orders={orders}/>;
  if(page==='audit')return <AuditActivity logs={auditLogs}/>;
  if(page==='reports')return <ManagementReports/>;
  return <ExecutiveDashboard overview={overview} auditLogs={auditLogs}/>;
}

export function ExecutiveDashboard({overview,auditLogs}:{overview:Overview;auditLogs:AuditLog[]}){
  const summary=overview.summary;const statusMap=Object.fromEntries(overview.statuses.map(row=>[row.status,row.count]));
  return <ManagementPage title="Dashboard Perusahaan" dashboard>
    {Number(summary.unassignedKitchens)>0&&<div className="management-alert"><AlertTriangle size={18}/><span><strong>{summary.unassignedKitchens} dapur belum memiliki admin pengelola.</strong> Atur melalui menu Cluster Admin–Dapur.</span></div>}
    <section className="executive-metrics" aria-label="Indikator utama perusahaan">
      <ExecutiveMetric icon={<CircleDollarSign/>} label="Penjualan bulan ini" value={money(Number(summary.salesThisMonth))}/>
      <ExecutiveMetric icon={<ClipboardList/>} label="Pesanan aktif" value={summary.activeOrders}/>
      <ExecutiveMetric icon={<CheckCircle2/>} label="Selesai bulan ini" value={summary.completedThisMonth}/>
      <ExecutiveMetric icon={<Building2/>} label="Dapur aktif" value={summary.activeKitchens}/>
    </section>
    <div className="dashboard-content-sheet"><div className="management-grid">
      <section className="panel management-table-panel"><div className="panel-heading"><h2>Kinerja admin koperasi</h2></div><div className="table-scroll"><table className="management-table"><thead><tr><th>Admin</th><th>Dapur</th><th>Produk</th><th>Pesanan aktif</th><th>Penjualan bulan ini</th></tr></thead><tbody>{overview.admins.map(admin=><tr key={admin.id}><td data-label="Admin"><strong>{admin.name}</strong><small>{admin.email}</small></td><td data-label="Dapur">{admin.kitchens}</td><td data-label="Produk">{admin.products}</td><td data-label="Pesanan aktif">{admin.activeOrders}</td><td data-label="Penjualan bulan ini">{money(Number(admin.salesThisMonth))}</td></tr>)}</tbody></table></div></section>
      <section className="panel pipeline-panel"><div className="panel-heading"><h2>Status operasional</h2></div><div className="pipeline-list">{Object.entries(statusLabel).map(([status,label])=><div key={status}><span>{label}</span><strong>{statusMap[status]||0}</strong></div>)}</div></section>
    </div>
    <section className="panel recent-audit"><div className="panel-heading"><h2>Aktivitas terbaru</h2></div><AuditRows logs={auditLogs.slice(0,5)}/></section></div>
  </ManagementPage>
}

function ExecutiveMetric({icon,label,value}:{icon:React.ReactNode;label:string;value:string|number}){return <article className="executive-metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></article>}

export function UserManagement({users,admins,currentUser,reload}:{users:ManagedUser[];admins:ManagedUser[];currentUser:User;reload:()=>Promise<void>}){
  const[role,setRole]=useState<'ADMIN'|'BUYER'>('BUYER');const[notice,setNotice]=useState('');const[saving,setSaving]=useState(false);const[editing,setEditing]=useState<ManagedUser|null>(null);
  const[deleteTarget,setDeleteTarget]=useState<ManagedUser|null>(null);const[deleting,setDeleting]=useState(false);const[deleteError,setDeleteError]=useState('');
  const remove=async()=>{if(!deleteTarget||deleting)return;setDeleting(true);setDeleteError('');try{await api(`/accounts/${deleteTarget.id}`,{method:'DELETE'});setDeleteTarget(null);setNotice('Akun dihapus dari daftar. Histori transaksi tetap disimpan.');await reload()}catch(reason){setDeleteError((reason as Error).message)}finally{setDeleting(false)}};
  const create=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setNotice('');const form=event.currentTarget;const data=new FormData(form);const body=role==='ADMIN'?{role,fullName:data.get('fullName'),username:data.get('username'),email:data.get('email'),password:data.get('password')}:{role,fullName:data.get('fullName'),username:data.get('username'),email:data.get('email'),password:data.get('password'),kitchen:{name:data.get('kitchenName'),phone:data.get('phone'),address:data.get('address'),gmapsUrl:data.get('gmapsUrl'),adminId:data.get('adminId')||null}};try{await api('/users',{method:'POST',body:JSON.stringify(body)});setNotice('Akun berhasil dibuat dan siap digunakan.');form.reset();setRole('BUYER');await reload()}catch(reason){setNotice((reason as Error).message)}finally{setSaving(false)}};
  const update=async(id:string,changes:Record<string,unknown>)=>{setNotice('');try{await api(`/users/${id}`,{method:'PATCH',body:JSON.stringify(changes)});setNotice('Perubahan akun berhasil disimpan.');await reload()}catch(reason){setNotice((reason as Error).message)}};
  const loadEdited=async()=>{await reload();setNotice('Informasi akun berhasil diperbarui.');};
  return <ManagementPage title="Manajemen Pengguna" subtitle="Buat akun admin koperasi dan dapur, serta kendalikan akses pengguna.">
    {notice&&<div className="management-alert" role="status">{notice}</div>}
    <div className="account-layout account-layout-single">
      <form className="panel account-form" onSubmit={create}>
        <div className="account-form-head"><h2>Buat akun</h2><div className="role-switch" aria-label="Pilih jenis akun"><button type="button" className={role==='BUYER'?'active':''} onClick={()=>setRole('BUYER')}>Buyer / Dapur</button><button type="button" className={role==='ADMIN'?'active':''} onClick={()=>setRole('ADMIN')}>Admin Koperasi</button></div></div>
        <div className="form-grid"><label>Nama lengkap *<input name="fullName" required minLength={2}/></label><label>Username *<input name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" autoCapitalize="none" autoComplete="off"/></label><label>Email (opsional)<input name="email" type="email" autoComplete="off"/></label><label>Password awal *<input name="password" type="password" minLength={8} autoComplete="new-password" required/></label>{role==='BUYER'&&<><label>Nama dapur *<input name="kitchenName" required/></label><label>Nomor HP *<input name="phone" type="tel" required/></label><label>Admin pengelola<select name="adminId"><option value="">Belum ditentukan</option>{admins.filter(admin=>admin.active).map(admin=><option value={admin.id} key={admin.id}>{admin.name}</option>)}</select></label><label className="account-address">Alamat dapur *<textarea name="address" rows={2} required/></label><label className="account-maps">Link Google Maps (opsional)<input name="gmapsUrl" type="url" placeholder="https://maps.google.com/..."/></label></>}</div>
        <button className="primary" disabled={saving}>{saving?'Menyimpan…':`Buat akun ${role==='BUYER'?'dapur':'admin'}`}</button>
      </form>
    </div>
    <section className="panel management-table-panel"><div className="panel-heading"><h2>Daftar pengguna</h2></div><div className="table-scroll"><table className="management-table users-management-table"><thead><tr><th>Pengguna</th><th>Role</th><th>Organisasi</th><th>Pengelola</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td data-label="Pengguna"><strong>{user.name}</strong><small>{user.username}</small>{user.email&&<small>{user.email}</small>}</td><td data-label="Role">{user.role==='BUYER'?<span className="role-label">Buyer</span>:<select className="inline-select" aria-label={`Role ${user.name}`} value={user.role} disabled={user.id===currentUser.id||deleting} onChange={event=>update(user.id,{role:event.target.value})}><option value="ADMIN">Admin</option><option value="SUPERADMIN">Superadmin</option></select>}</td><td data-label="Organisasi">{user.organization||'—'}</td><td data-label="Pengelola">{user.manager||'—'}</td><td data-label="Status"><span className={user.active?'state-text active':'state-text'}>{user.active?'Aktif':'Nonaktif'}</span></td><td data-label="Aksi"><button type="button" className="table-action" disabled={user.id===currentUser.id||deleting} onClick={()=>setEditing(user)}>Edit akun</button><button type="button" className="table-action" disabled={user.id===currentUser.id||deleting} onClick={()=>update(user.id,{active:!user.active})}>{user.active?'Nonaktifkan':'Aktifkan'}</button>{!user.active&&user.id!==currentUser.id&&<button type="button" className="table-action table-action-danger" disabled={deleting} onClick={()=>{setDeleteError('');setDeleteTarget(user)}}>Hapus akun</button>}</td></tr>)}</tbody></table></div></section>
    {editing&&<AccountEditor account={editing} admins={admins} superadmin onClose={()=>setEditing(null)} onSaved={loadEdited}/> }
    {deleteTarget&&<DeleteAccountDialog name={deleteTarget.name} busy={deleting} error={deleteError} cancel={()=>setDeleteTarget(null)} confirm={()=>void remove()}/>}
  </ManagementPage>
}

export function ProductMaster({templates,reload}:{templates:ProductTemplate[];reload:()=>Promise<void>}){
  const[deleteTarget,setDeleteTarget]=useState<ProductTemplate|null>(null);const[deleting,setDeleting]=useState(false);const[deleteError,setDeleteError]=useState('');const[sourceBusy,setSourceBusy]=useState('');const[weighing,setWeighing]=useState(false);const[notice,setNotice]=useState('');const[saving,setSaving]=useState(false);const[image,setImage]=useState('');const[imageBusy,setImageBusy]=useState(false);
  const selectPhoto=async(file?:File)=>{if(!file)return;setImageBusy(true);setImage('');setNotice('');try{setImage(await uploadProductImage(file))}catch(error){setNotice((error as Error).message)}finally{setImageBusy(false)}};
  const create=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(imageBusy||saving)return;setSaving(true);setNotice('');const form=event.currentTarget;const data=new FormData(form);try{await api('/templates',{method:'POST',body:JSON.stringify({name:data.get('name'),category:data.get('category'),stockSource:data.get('stockSource'),image:image||null,orderUnit:data.get('orderUnit'),priceUnit:data.get('priceUnit'),weighingRequired:weighing,estimatedKgPerUnit:weighing?data.get('estimatedKgPerUnit'):null})});setNotice('Produk Pokok berhasil ditambahkan.');form.reset();setImage('');setWeighing(false);await reload()}catch(reason){setNotice((reason as Error).message)}finally{setSaving(false)}};
  const remove=async()=>{if(!deleteTarget||deleting)return;setDeleting(true);setDeleteError('');try{await api(`/templates/${deleteTarget.id}`,{method:'DELETE'});setDeleteTarget(null);setNotice('Produk berhasil dihapus.');await reload()}catch(reason){setDeleteError((reason as Error).message)}finally{setDeleting(false)}};
  const toggle=async(template:ProductTemplate)=>{setNotice('');try{await api(`/templates/${template.id}`,{method:'PATCH',body:JSON.stringify({active:!template.active})});setNotice(`${template.name} ${template.active?'dinonaktifkan':'diaktifkan'}.`);await reload()}catch(reason){setNotice((reason as Error).message)}};
  const changeSource=async(template:ProductTemplate,stockSource:string)=>{if(sourceBusy)return;setSourceBusy(template.id);setNotice('');try{await api(`/templates/${template.id}`,{method:'PATCH',body:JSON.stringify({stockSource})});await reload();setNotice(`Sumber ${template.name} diperbarui untuk penambahan stok berikutnya.`)}catch(reason){setNotice((reason as Error).message)}finally{setSourceBusy('')}};
  return <ManagementPage title="Produk Pokok" subtitle="Produk standar yang tersedia untuk seluruh Admin Koperasi.">{notice&&<div className="management-alert" role="status">{notice}</div>}<div className="product-master-layout">
    <form className="panel master-product-form" onSubmit={create}>
      <div className="panel-heading"><h2>Tambah Produk Pokok</h2></div>
      <div className="master-entry-layout">
        <div className="master-entry-fields">
          <div className="form-grid">
            <label>Nama barang *<input name="name" required minLength={2}/></label>
            <label>Kategori *<input name="category" required placeholder="Bahan Pokok"/></label>
            <label>Satuan pemesanan *<input name="orderUnit" required placeholder="kg, pcs, potong, dus"/></label>
            <label>Satuan harga & stok *<input name="priceUnit" required placeholder="kg, dus" defaultValue="kg"/></label>
          </div>
          <label>Sumber barang<select name="stockSource" defaultValue="COOPERATIVE"><option value="COOPERATIVE">Koperasi</option><option value="VENDOR">Vendor</option></select></label>
          <label className="weighing-toggle"><input type="checkbox" checked={weighing} onChange={event=>setWeighing(event.target.checked)}/><span><strong>Konversi berat</strong><small>Pesan per pcs atau potong, harga berdasarkan kg aktual.</small></span></label>
          {weighing&&<label className="estimated-weight">Estimasi kilogram per satuan *<input name="estimatedKgPerUnit" type="number" min="0.001" step="0.001" required/></label>}
        </div>
      </div>
      <PhotoUpload centered value={image} busy={imageBusy} disabled={saving} onSelect={file=>void selectPhoto(file)} onClear={()=>setImage('')}/>
      <div className="master-form-actions"><button className="primary" disabled={saving||imageBusy}>{saving?'Menyimpan…':'Tambah produk'}</button></div>
    </form>
  </div><section className="panel management-table-panel"><div className="panel-heading"><div><h2>Daftar Produk Pokok</h2><p>{templates.length} produk terdaftar.</p></div></div><div className="table-scroll"><table className="management-table product-master-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Sumber</th><th>Satuan pesan</th><th>Satuan stok/harga</th><th>Perlakuan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{templates.map(template=><tr key={template.id}><td data-label="Produk"><span className="template-product">{template.image?<ProductImage src={template.image} alt=""/>:<span/>}<span><strong>{template.name}</strong><small>{template.sku}</small></span></span></td><td data-label="Kategori">{template.category}</td><td data-label="Sumber"><select className="inline-select" aria-label={`Sumber ${template.name}`} value={template.stockSource} disabled={Boolean(sourceBusy)} onChange={event=>void changeSource(template,event.target.value)}><option value="COOPERATIVE">Koperasi</option><option value="VENDOR">Vendor</option></select></td><td data-label="Satuan pesan">{template.orderUnit}</td><td data-label="Satuan stok/harga">{template.priceUnit}</td><td data-label="Perlakuan">{template.weighingRequired?`Timbang · ± ${template.estimatedKgPerUnit} kg`:'Normal'}</td><td data-label="Status"><span className={template.active?'state-text active':'state-text'}>{template.active?'Aktif':'Nonaktif'}</span></td><td data-label="Aksi"><button className="table-action" type="button" onClick={()=>toggle(template)}>{template.active?'Nonaktifkan':'Aktifkan'}</button><button className="table-action table-action-danger" type="button" onClick={()=>{setDeleteError('');setDeleteTarget(template)}}>Hapus</button></td></tr>)}</tbody></table></div></section>{deleteTarget&&<DeleteProductDialog name={deleteTarget.name} busy={deleting} error={deleteError} cancel={()=>setDeleteTarget(null)} confirm={remove}/>}</ManagementPage>
}

function ClusterManagement({clusters,kitchens,reload}:{clusters:Cluster[];kitchens:Kitchen[];reload:()=>Promise<void>}){
  const[selected,setSelected]=useState<Record<string,string[]>>({});const[notice,setNotice]=useState('');const[saving,setSaving]=useState('');
  useEffect(()=>{setSelected(Object.fromEntries(clusters.map(cluster=>[cluster.adminId,cluster.kitchens.map(kitchen=>kitchen.id)])))},[clusters]);
  const toggle=(adminId:string,kitchenId:string,checked:boolean)=>setSelected(current=>({...current,[adminId]:checked?[...(current[adminId]||[]),kitchenId]:(current[adminId]||[]).filter(id=>id!==kitchenId)}));
  const save=async(adminId:string)=>{setSaving(adminId);setNotice('');try{await api(`/clusters/${adminId}/kitchens`,{method:'PUT',body:JSON.stringify({kitchenIds:[...new Set(selected[adminId]||[])]})});setNotice('Cluster berhasil diperbarui.');await reload()}catch(reason){setNotice((reason as Error).message)}finally{setSaving('')}};
  return <ManagementPage title="Cluster Admin–Dapur" subtitle="Tentukan admin koperasi yang bertanggung jawab atas setiap dapur.">
    {notice&&<div className="management-alert" role="status">{notice}</div>}<p className="cluster-note">Satu dapur hanya dapat dikelola oleh satu admin. Memilih dapur yang sudah memiliki pengelola akan memindahkan tanggung jawabnya.</p>
    <div className="cluster-management-grid">{clusters.map(cluster=><article className="panel cluster-manager" key={cluster.adminId}><div className="cluster-manager-head"><div><h2>{cluster.admin}</h2><p>{cluster.email}</p></div><span>{(selected[cluster.adminId]||[]).length} dapur</span></div><div className="kitchen-checks">{kitchens.map(kitchen=><label key={kitchen.id}><input type="checkbox" checked={(selected[cluster.adminId]||[]).includes(kitchen.id)} onChange={event=>toggle(cluster.adminId,kitchen.id,event.target.checked)}/><span><strong>{kitchen.name}</strong><small>{kitchen.managerId&&kitchen.managerId!==cluster.adminId?`Saat ini: ${kitchen.manager}`:kitchen.address}</small></span></label>)}</div><button className="primary" disabled={saving===cluster.adminId} onClick={()=>save(cluster.adminId)}>{saving===cluster.adminId?'Menyimpan…':'Simpan cluster'}</button></article>)}</div>
  </ManagementPage>
}

function OrganizationDirectory({organizations}:{organizations:Organization[]}){
  const cooperative=organizations.find(item=>item.type==='COOPERATIVE');const kitchens=organizations.filter(item=>item.type==='KITCHEN');
  return <ManagementPage title="Direktori Organisasi" subtitle="Identitas koperasi dan seluruh dapur mitra dalam jaringan.">
    <section className="organization-summary"><article className="panel organization-primary"><Building2/><div><span>Koperasi induk</span><h2>{cooperative?.name||'Koperasi Borneo Mandiri'}</h2><p>{cooperative?.address||'Desa Lumbang, Sambas, Kalimantan Barat'}</p></div></article><article className="panel organization-count"><strong>{kitchens.length}</strong><span>Dapur mitra</span><small>{kitchens.filter(item=>item.active).length} organisasi aktif</small></article></section>
    <section className="panel management-table-panel"><div className="panel-heading"><div><h2>Dapur mitra</h2><p>Informasi pengelola dan kontak setiap organisasi.</p></div></div><div className="table-scroll"><table className="management-table"><thead><tr><th>Organisasi</th><th>Admin pengelola</th><th>Kontak</th><th>Alamat</th><th>Status</th></tr></thead><tbody>{kitchens.map(item=><tr key={item.id}><td data-label="Organisasi"><strong>{item.name}</strong><small>{item.userCount} akun</small></td><td data-label="Admin pengelola">{item.manager||'Belum ditentukan'}</td><td data-label="Kontak">{item.phone||'—'}</td><td data-label="Alamat"><span className="address-cell">{item.address||'—'}{item.gmapsUrl&&<a href={item.gmapsUrl} target="_blank" rel="noreferrer"><MapPin size={13}/>Peta</a>}</span></td><td data-label="Status"><span className={item.active?'state-text active':'state-text'}>{item.active?'Aktif':'Nonaktif'}</span></td></tr>)}</tbody></table></div></section>
  </ManagementPage>
}

function AuditActivity({logs}:{logs:AuditLog[]}){return <ManagementPage title="Audit Aktivitas"><section className="panel audit-panel"><div className="panel-heading"><h2>Aktivitas terbaru</h2><History size={20}/></div><AuditRows logs={logs}/></section></ManagementPage>}

function AuditRows({logs}:{logs:AuditLog[]}){
  const descriptions:Record<string,string>={
    'UPDATE:ADMIN_PRODUCT':'memperbarui harga jual dan stok',
    'CREATE:USER':'membuat akun baru','UPDATE:USER':'memperbarui akun','CREATE:PARTNER':'membuat akun mitra','UPDATE:PARTNER':'memperbarui akun mitra',
    'ASSIGN:ADMIN_CLUSTER':'mengatur pembagian dapur','CREATE:PRODUCT_TEMPLATE':'membuat produk baru','UPDATE:PRODUCT_TEMPLATE':'memperbarui produk',
    'CREATE:INVENTORY_BATCH':'menambahkan stok','UPDATE:INVENTORY_BATCH':'memperbarui stok','RESET:SYSTEM':'membersihkan data uji coba','UPDATE:WEBSITE':'memperbarui kontak dan alamat website'
  };
  const actions:Record<string,string>={CREATE:'membuat',UPDATE:'memperbarui',ASSIGN:'mengatur',RESET:'membersihkan',DELETE:'menghapus'};
  const entities:Record<string,string>={USER:'akun',PARTNER:'akun mitra',ADMIN_CLUSTER:'pembagian dapur',PRODUCT_TEMPLATE:'produk',INVENTORY_BATCH:'stok',SYSTEM:'data sistem'};
  const describe=(log:AuditLog)=>descriptions[`${log.action}:${log.entityType}`]||`${actions[log.action]||'melakukan perubahan pada'} ${entities[log.entityType]||'data operasional'}`;
  return <div className="audit-list">{logs.map(log=><article key={log.id}><span className="audit-mark"><History size={15}/></span><div><strong>{log.actor||'Sistem'} {describe(log)}</strong><small>{log.actorEmail||'Aktivitas sistem'} · {new Date(log.createdAt).toLocaleString('id-ID')}</small></div></article>)}{logs.length===0&&<div className="management-empty">Belum ada aktivitas.</div>}</div>
}

function AllOrders({orders}:{orders:Order[]}){return <ManagementPage title="Semua Pesanan" subtitle="Pantau aktivitas pengadaan dari seluruh dapur dan admin koperasi."><section className="panel management-table-panel"><div className="panel-heading"><div><h2>Riwayat lintas cluster</h2><p>{orders.length} pesanan tercatat.</p></div></div><div className="table-scroll"><table className="management-table"><thead><tr><th>Pesanan</th><th>Dapur</th><th>Dibutuhkan</th><th>Item</th><th>Status</th><th>Nilai</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td data-label="Pesanan"><strong>{order.orderNo}</strong></td><td data-label="Dapur">{order.kitchen}</td><td data-label="Dibutuhkan">{new Date(order.neededDate).toLocaleDateString('id-ID')}</td><td data-label="Item">{order.items.length} jenis</td><td data-label="Status"><span className="state-text active">{statusLabel[order.status]}</span></td><td data-label="Nilai">{money(Number(order.finalTotal??order.estimatedTotal))}</td></tr>)}</tbody></table></div>{orders.length===0&&<div className="management-empty">Belum ada pesanan pada sistem.</div>}</section></ManagementPage>}

function ManagementReports(){return <ReportsView/>}

function ManagementPage({title,children,dashboard=false}:{title:string;subtitle?:string;children:React.ReactNode;dashboard?:boolean}){return <div className={`management-page${dashboard?' superadmin-dashboard-home':''}`}><header className="management-title"><h1>{title}</h1></header>{children}</div>}

function DeleteProductDialog({name,busy,error,cancel,confirm}:{name:string;busy:boolean;error:string;cancel:()=>void;confirm:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="modal-card product-delete-dialog" aria-labelledby="delete-product-title" aria-describedby="delete-product-description" onCancel={event=>{event.preventDefault();if(!busy)cancel()}}><header><h2 id="delete-product-title">Hapus Produk Pokok?</h2></header><div><p id="delete-product-description">Produk <strong>{name}</strong> akan dihapus dari daftar Produk Pokok.</p>{error&&<p className="notice" role="alert">{error}</p>}<div className="modal-actions"><button type="button" autoFocus disabled={busy} onClick={cancel}>Batal</button><button type="button" className="product-delete-confirm" disabled={busy} onClick={confirm}>{busy?'Menghapus…':'Hapus produk'}</button></div></div></dialog>;
}
