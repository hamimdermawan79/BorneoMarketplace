-- Setiap master produk aktif tersedia bagi seluruh Admin Koperasi.
INSERT INTO admin_products(admin_user_id,template_id,sale_price)
SELECT admin.id,template.id,0
FROM users admin
CROSS JOIN product_templates template
WHERE admin.role='ADMIN' AND admin.active AND template.active
ON CONFLICT(admin_user_id,template_id) DO NOTHING;
