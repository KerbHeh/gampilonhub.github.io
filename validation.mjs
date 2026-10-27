export function validateRoute(data) {
  const fail = message => { throw new Error(message); };
  const keys = (v, allowed) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => allowed.includes(k));
  if (!keys(data, ['version','fps','frames']) || data.version !== 1) fail('Use um objeto com version: 1, fps e frames. Campos extras não são aceitos.');
  if (!Number.isInteger(data.fps) || data.fps < 1 || data.fps > 240) fail('fps deve ser um inteiro entre 1 e 240.');
  if (!Array.isArray(data.frames) || data.frames.length < 2 || data.frames.length > 10000) fail('A rota precisa ter entre 2 e 10.000 frames.');
  let previous = -1;
  for (const [i, f] of data.frames.entries()) {
    if (!keys(f, ['t','position','rotation']) || !Number.isFinite(f.t) || f.t < 0 || f.t > 3600 || f.t <= previous) fail(`Frame ${i + 1}: t deve crescer, entre 0 e 3600 segundos.`);
    for (const field of ['position','rotation']) if (!Array.isArray(f[field]) || f[field].length !== 3 || !f[field].every(n => Number.isFinite(n) && Math.abs(n) <= 1000000)) fail(`Frame ${i + 1}: ${field} precisa de três números finitos, até ±1.000.000.`);
    previous = f.t;
  }
  if (new TextEncoder().encode(JSON.stringify(data)).length > 2000000) fail('O JSON excede 2 MB.');
  return data;
}
export function parseId(raw) {
  if (!/^#?\d{1,15}$/.test(raw.trim())) throw new Error('Digite um ID válido, como #00001.');
  const id = Number(raw.trim().replace('#',''));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('O ID deve ser maior que zero.');
  return id;
}
export const formatId = id => '#' + String(id).padStart(5,'0');
