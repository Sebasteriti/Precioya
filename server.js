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
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PrecioYa' });
});

app.get('/api/sucursales', async (req, res) => {
  const lat = req.query.lat;
  const lng = req.query.lng;
  const limit = req.query.limit || 30;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Faltan lat y lng' });
  }
  try {
    const url = SEPA + '/sucursales?lat=' + lat + '&lng=' + lng + '&limit=' + limit;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) {
      throw new Error('SEPA ' + r.status);
    }
    const data = await r.json();
    const sucursales = (data.sucursales || []).map(function(s) {
      return {
        id: s.id,
        comercioRazonSocial: s.comercioRazonSocial,
        banderaDescripcion: s.banderaDescripcion,
        sucursalTipo: s.sucursalTipo,
        direccion: s.direccion,
        localidad: s.localidad,
        provincia: s.provincia,
        lat: s.lat,
        lng: s.lng,
        horario: s.horarioAtencion,
      };
    });
    res.json({ sucursales: sucursales, total: sucursales.length });
  } catch (e) {
    res.status(502).json({ error: 'Error SEPA', detalle: e.message });
  }
});

app.get('/api/productos', async (req, res) => {
  const string = req.query.string;
  const limit = req.query.limit || 5;
  if (!string) {
    return res.status(400).json({ error: 'Falta string' });
  }
  try {
    const url = SEPA + '/productos?string=' + encodeURIComponent(string) + '&limit=' + limit;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) {
      throw new Error('SEPA ' + r.status);
    }
    const data = await r.json();
    const productos = (data.productos || []).map(function(p) {
      return {
        id: p.id,
        nombre: p.nombre,
        marca: p.marca,
        presentacion: p.presentacion,
      };
    });
    res.json({ productos: productos, total: productos.length });
  } catch (e) {
    res.status(502).json({ error: 'Error SEPA', detalle: e.message });
  }
});

app.get('/api/precios', async (req, res) => {
  const sucursales = req.query.sucursales;
  const producto = req.query.producto;
  if (!sucursales || !producto) {
    return res.status(400).json({ error: 'Faltan parametros' });
  }
  try {
    const url = SEPA + '/productos-sucursales?ids_productos=' + producto + '&ids_sucursales=' + sucursales;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) {
      throw new Error('SEPA ' + r.status);
    }
    const data = await r.json();
    const precios = [];
    const prods = data.productos || [];
    for (var i = 0; i < prods.length; i++) {
      const sucs = prods[i].sucursales || [];
      for (var j = 0; j < sucs.length; j++) {
        if (sucs[j].precio != null) {
          precios.push({
            sucursalId: sucs[j].id,
            precio: parseFloat(sucs[j].precio),
            precioPromoA: sucs[j].precioPromoA ? parseFloat(sucs[j].precioPromoA) : null,
          });
        }
      }
    }
    res.json({ precios: precios, total: precios.length });
  } catch (e) {
    res.status(502).json({ error: 'Error SEPA', detalle: e.message });
  }
});

app.listen(PORT, function() {
  console.log('PrecioYa corriendo en puerto ' + PORT);
});

