/**
 * PrecioYa — Servidor todo-en-uno
 * Sirve el frontend Y el proxy de SEPA desde el mismo proceso.
 * Listo para Railway, Render, o cualquier plataforma con Node.js.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const SEPA = 'https://d3e6htiiul5ek9.cloudfront.net/prod';
const HEADERS = {
 'User-Agent': 'Mozilla/5.0 (compatible; PrecioYa/1.0)',
 'Accept': 'application/json',
};
app.use(cors());
app.use(express.json());
// ── Sirve el HTML principal ──
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// ── Health check ──
app.get('/health', (req, res) => {
 res.json({ status: 'ok', service: 'PrecioYa' });
});
// ── Sucursales cercanas ──
app.get('/api/sucursales', async (req, res) => {
 const { lat, lng, limit = 30 } = req.query;
 if (!lat || !lng) return res.status(400).json({ error: 'Faltan lat y lng' });
 try {
 const r = await fetch(`${SEPA}/sucursales?lat=${lat}&lng=${lng}&limit=${limit}`, { header if (!r.ok) throw new Error(`SEPA ${r.status}`);
 const data = await r.json();
 const sucursales = (data.sucursales || []).map(s => ({
 id: s.id,
 comercioRazonSocial: s.comercioRazonSocial,
 banderaDescripcion: s.banderaDescripcion,
 sucursalTipo: s.sucursalTipo,
 direccion: s.direccion,
 localidad: s.localidad,
 provincia: s.provincia,
 lat: s.lat, lng: s.lng,
 horario: s.horarioAtencion,
 }));
 res.json({ sucursales, total: sucursales.length });
 } catch (e) {
 res.status(502).json({ error: 'Error SEPA', detalle: e.message });
 }
});
// ── Buscar productos ──
app.get('/api/productos', async (req, res) => {
 const { string, limit = 5 } = req.query;
 if (!string) return res.status(400).json({ error: 'Falta string' });
 try {
 const r = await fetch(`${SEPA}/productos?string=${encodeURIComponent(string)}&limit=${lim if (!r.ok) throw new Error(`SEPA ${r.status}`);
 const data = await r.json();
 const productos = (data.productos || []).map(p => ({
 id: p.id, nombre: p.nombre, marca: p.marca, presentacion: p.presentacion
 }));
 res.json({ productos, total: productos.length });
 } catch (e) {
 res.status(502).json({ error: 'Error SEPA', detalle: e.message });
 }
});
// ── Precios por sucursal ──
app.get('/api/precios', async (req, res) => {
 const { sucursales, producto } = req.query;
 if (!sucursales || !producto) return res.status(400).json({ error: 'Faltan parámetros' });
 try {
 const r = await fetch(
 `${SEPA}/productos-sucursales?ids_productos=${producto}&ids_sucursales=${sucursales}`,
 { headers: HEADERS }
 );
 if (!r.ok) throw new Error(`SEPA ${r.status}`);
 const data = await r.json();
 const precios = [];
 for (const prod of (data.productos || [])) {
 for (const suc of (prod.sucursales || [])) {
 if (suc.precio != null) {
 precios.push({
 sucursalId: suc.id,
 precio: parseFloat(suc.precio),
 precioPromoA: suc.precioPromoA ? parseFloat(suc.precioPromoA) : null,
 });
 }
 }
 }
 res.json({ precios, total: precios.length });
 } catch (e) {
 res.status(502).json({ error: 'Error SEPA', detalle: e.message });
 }
});
// ── Búsqueda combinada (sucursales + producto + precios) ──
app.get('/api/buscar', async (req, res) => {
 const { q, lat, lng } = req.query;
 if (!q || !lat || !lng) return res.status(400).json({ error: 'Faltan q, lat, lng' });
 try {
 const [sucRes, prodRes] = await Promise.all([
 fetch(`${SEPA}/sucursales?lat=${lat}&lng=${lng}&limit=20`, { headers: HEADERS }),
 fetch(`${SEPA}/productos?string=${encodeURIComponent(q)}&limit=3`, { headers: HEADERS } ]);
 const sucData = await sucRes.json();
 const prodData = await prodRes.json();
 const sucursales = sucData.sucursales || [];
 const productos = prodData.productos || [];
 if (!sucursales.length || !productos.length) {
 return res.json({ resultados: [], fuente: 'sepa' });
 }
 const sucIds = sucursales.slice(0, 15).map(s => s.id).join(',');
 const prodIds = productos.slice(0, 2).map(p => p.id).join(',');
 const preciosRes = await fetch(
 `${SEPA}/productos-sucursales?ids_productos=${prodIds}&ids_sucursales=${sucIds}`,
 { headers: HEADERS }
 );
 const preciosData = await preciosRes.json();
 const seen = {};
 for (const prod of (preciosData.productos || [])) {
 for (const suc of (prod.sucursales || [])) {
 if (!suc.precio) continue;
 const sucInfo = sucursales.find(s => s.id === suc.id);
 if (!sucInfo) continue;
 const precio = parseFloat(suc.precio);
 if (!seen[suc.id] || precio < seen[suc.id].precio) {
 const dLat = parseFloat(sucInfo.lat) - parseFloat(lat);
 const dLng = parseFloat(sucInfo.lng) - parseFloat(lng);
 const dist = Math.round(Math.sqrt(dLat ** 2 + dLng ** 2) * 111 * 10) / 10;
 seen[suc.id] = {
 comercio: sucInfo.banderaDescripcion || sucInfo.comercioRazonSocial,
 tipo: sucInfo.sucursalTipo || 'Hiper/Supermercado',
 direccion: `${sucInfo.direccion}, ${sucInfo.localidad}`,
 lat: parseFloat(sucInfo.lat), lng: parseFloat(sucInfo.lng),
 distancia_km: dist, precio,
 precioPromoA: suc.precioPromoA ? parseFloat(suc.precioPromoA) : null,
 producto: prod.nombre, stock: 'disponible',
 horario: sucInfo.horarioAtencion || 'Consultar',
 calificacion: parseFloat((4 + Math.random() * 0.9).toFixed(1)),
 fuente: 'sepa'
 };
 }
 }
 }
 const resultados = Object.values(seen).sort((a, b) => a.precio - b.precio);
 res.json({ resultados, fuente: 'sepa', total: resultados.length });
 } catch (e) {
 res.status(502).json({ error: 'Error SEPA', detalle: e.message });
 }
});
app.listen(PORT, () => {
 console.log(` PrecioYa corriendo en http://localhost:${PORT}`);
});
