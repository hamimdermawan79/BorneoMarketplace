import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './client.js';

if(process.env.NODE_ENV==='production')throw new Error('Demo seed is disabled in production. Use db:bootstrap for the first real superadmin.');
const passwordHash=await bcrypt.hash('Demo123!',12);
await withTransaction(async client=>{
  const org=async(type:string,name:string,address:string|null=null)=>{
    const found=await client.query('SELECT id FROM organizations WHERE name=$1',[name]);if(found.rowCount)return found.rows[0].id;
    return (await client.query('INSERT INTO organizations(type,name,address) VALUES($1,$2,$3) RETURNING id',[type,name,address])).rows[0].id;
  };
  const cooperative=await org('COOPERATIVE','Koperasi Borneo Mandiri','Desa Lumbang, Sambas, Kalimantan Barat');
  const kitchenNames=['Dapur Tulip','Dapur Melati','Dapur Kenanga','Dapur Cempaka','Dapur Rafflesia'];
  const kitchens:Record<string,string>={};for(const name of kitchenNames)kitchens[name]=await org('KITCHEN',name,'Sambas, Kalimantan Barat');
  for(const [index,name] of kitchenNames.entries())await client.query(`UPDATE organizations SET phone=$2,address=$3,gmaps_url=$4 WHERE id=$1`,[kitchens[name],`0812 7000 10${index+1}`,`Desa Lumbang, Sambas, Kalimantan Barat`,`https://maps.google.com/?q=${encodeURIComponent(`${name}, Desa Lumbang, Sambas, Kalimantan Barat`)}`]);
  const user=async(name:string,email:string,role:string,organizationId:string)=>{
    const result=await client.query(`INSERT INTO users(organization_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(email) DO UPDATE SET full_name=excluded.full_name RETURNING id`,[organizationId,name,email,passwordHash,role]);return result.rows[0].id;
  };
  await user('Superadmin','superadmin@borneo.local','SUPERADMIN',cooperative);
  const adminA=await user('Admin Koperasi A','admin.a@borneo.local','ADMIN',cooperative);const adminB=await user('Admin Koperasi B','admin.b@borneo.local','ADMIN',cooperative);const adminC=await user('Admin Koperasi C','admin.c@borneo.local','ADMIN',cooperative);
  await user('Dapur Tulip','tulip@borneo.local','BUYER',kitchens['Dapur Tulip']);await user('Dapur Melati','melati@borneo.local','BUYER',kitchens['Dapur Melati']);await user('Dapur Kenanga','kenanga@borneo.local','BUYER',kitchens['Dapur Kenanga']);await user('Dapur Cempaka','cempaka@borneo.local','BUYER',kitchens['Dapur Cempaka']);await user('Dapur Rafflesia','rafflesia@borneo.local','BUYER',kitchens['Dapur Rafflesia']);
  const assignments=[[adminA,kitchens['Dapur Tulip']],[adminA,kitchens['Dapur Melati']],[adminB,kitchens['Dapur Kenanga']],[adminB,kitchens['Dapur Cempaka']],[adminC,kitchens['Dapur Rafflesia']]];for(const [admin,kitchen] of assignments)await client.query('INSERT INTO admin_kitchens(admin_user_id,kitchen_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[admin,kitchen]);
  const templates=[['BR-001','Beras Medium','Bahan Pokok','/assets/produk/beras.jpg','kg','kg',false,null],['TL-002','Telur Ayam','Protein','/assets/produk/telur.jpg','pcs','kg',true,.06],['AY-003','Ayam Potong','Protein',null,'potong','kg',true,.8],['MG-004','Minyak Goreng','Bahan Pokok','/assets/produk/minyakgoreng.jpg','dus','dus',false,null],['GL-005','Gula Pasir','Bahan Pokok','/assets/produk/gula.jpg','kg','kg',false,null],['KT-006','Kentang','Sayuran','/assets/produk/kentang.jpg','kg','kg',false,null]];
  for(const row of templates)await client.query(`INSERT INTO product_templates(sku,name,category,image_path,order_unit,price_unit,weighing_required,estimated_kg_per_unit) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,image_path=excluded.image_path,order_unit=excluded.order_unit,price_unit=excluded.price_unit,weighing_required=excluded.weighing_required,estimated_kg_per_unit=excluded.estimated_kg_per_unit,active=true`,row);
  for(const admin of [adminA,adminB,adminC])await client.query(`INSERT INTO admin_products(admin_user_id,template_id,sale_price) SELECT $1,id,0 FROM product_templates WHERE active AND owner_admin_user_id IS NULL ON CONFLICT(admin_user_id,template_id) DO NOTHING`,[admin]);
  await client.query(`INSERT INTO vendors(admin_user_id,name,phone,address) SELECT $1,'Supplier Sambas','0812 3456 7800','Sambas, Kalimantan Barat' WHERE NOT EXISTS(SELECT 1 FROM vendors WHERE admin_user_id=$1 AND name='Supplier Sambas')`,[adminA]);
});
console.log('Seed selesai. Password akun demo: Demo123!');await pool.end();
