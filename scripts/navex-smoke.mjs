/**
 * Smoke-check Navex env without creating parcels.
 * Usage: node scripts/navex-smoke.mjs
 */
const enabled = process.env.NAVEX_ENABLED === 'true' || process.env.NAVEX_ENABLED === '1';
const base = (process.env.NAVEX_API_BASE_URL ?? '').replace(/\/$/, '');
const slug = process.env.NAVEX_CLIENT_SLUG ?? '';
const token = process.env.NAVEX_API_TOKEN ?? process.env.NAVEX_API_KEY ?? '';

console.log('NAVEX_ENABLED=', enabled);
console.log('NAVEX_API_BASE_URL=', base || '(missing)');
console.log('NAVEX_CLIENT_SLUG=', slug ? `${slug.slice(0, 4)}…` : '(missing)');
console.log('NAVEX_API_TOKEN=', token ? `(${token.length} chars)` : '(missing)');

if (!enabled) {
  console.log('OK: Navex disabled — EXTERNAL parcels stay local.');
  process.exit(0);
}

if (!base || !slug || !token) {
  console.error('FAIL: NAVEX_ENABLED=true but base/slug/token incomplete.');
  process.exit(1);
}

const url = `${base}/public/create/${encodeURIComponent(slug)}`;
try {
  const res = await fetch(url, {
    method: 'OPTIONS',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Reachability OPTIONS', url, '→', res.status);
  console.log('OK: credentials present; run a real create in staging before prod.');
  process.exit(0);
} catch (err) {
  console.error('FAIL: cannot reach Navex:', String(err));
  process.exit(1);
}
