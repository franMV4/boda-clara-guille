// Confirmaciones de la boda: la web guarda y edita su respuesta, los novios la descargan para Excel.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (datos, status = 200) => Response.json(datos, { status, headers: CORS });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const texto = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const MENUS = ['celiaquia', 'embarazada', 'vegetariano', 'vegano'];
const COLUMNAS = ['nombre', 'asiste', 'acompanante', 'autobus_ida', 'autobus_vuelta', 'menus', 'alergias', 'cancion', 'cancion_enlace', 'creado', 'actualizado'];

async function guardar(request, env) {
  if (Number(request.headers.get('content-length') || 0) > 8000) return json({ error: 'Demasiado grande' }, 413);
  let d;
  try { d = await request.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  const nombre = texto(d.nombre, 120);
  if (!UUID.test(d.id) || !UUID.test(d.token) || !nombre || !['si', 'no'].includes(d.asiste)) return json({ error: 'Faltan datos' }, 400);
  const si = d.asiste === 'si';
  const enlace = texto(d.cancion_enlace, 300);
  const ahora = new Date().toISOString();
  // Solo quien tiene el token de esa respuesta puede cambiarla
  const r = await env.DB.prepare(
    `INSERT INTO respuestas (id, token, nombre, asiste, acompanante, autobus_ida, autobus_vuelta, menus, alergias, cancion, cancion_enlace, creado, actualizado)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
     ON CONFLICT(id) DO UPDATE SET nombre = ?3, asiste = ?4, acompanante = ?5, autobus_ida = ?6, autobus_vuelta = ?7,
       menus = ?8, alergias = ?9, cancion = ?10, cancion_enlace = ?11, actualizado = ?12
     WHERE respuestas.token = ?2`
  ).bind(
    d.id, d.token, nombre, d.asiste,
    si ? texto(d.acompanante, 120) : '',
    si && d.autobus_ida ? 1 : 0, si && d.autobus_vuelta ? 1 : 0,
    si && Array.isArray(d.menus) ? d.menus.filter(m => MENUS.includes(m)).join(', ') : '',
    si ? texto(d.alergias, 500) : '',
    si ? texto(d.cancion, 200) : '',
    si && enlace.startsWith('https://music.apple.com/') ? enlace : '',
    ahora
  ).run();
  if (!r.meta.changes) return json({ error: 'Esta respuesta no es tuya' }, 403);
  return json({ ok: true });
}

// CSV con ; y BOM para que Excel en español lo abra con acentos y columnas bien
async function exportar(url, env) {
  if (!env.CLAVE || url.searchParams.get('clave') !== env.CLAVE) return new Response('No autorizado', { status: 403 });
  const { results } = await env.DB.prepare(`SELECT ${COLUMNAS.join(', ')} FROM respuestas ORDER BY asiste DESC, nombre`).all();
  const celda = v => {
    const s = String(v ?? '');
    const seguro = /^[=+\-@]/.test(s) ? "'" + s : s; // que Excel no lo tome por fórmula
    return '"' + seguro.replace(/"/g, '""') + '"';
  };
  const filas = [COLUMNAS.join(';'), ...results.map(r => COLUMNAS.map(c => celda(c.startsWith('autobus') ? (r[c] ? 'sí' : '') : r[c])).join(';'))];
  return new Response('\uFEFF' + filas.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="confirmaciones-boda.csv"', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/rsvp' && request.method === 'POST') return guardar(request, env);
    if (url.pathname === '/respuestas.csv' && request.method === 'GET') return exportar(url, env);
    return json({ error: 'No encontrado' }, 404);
  },
};
