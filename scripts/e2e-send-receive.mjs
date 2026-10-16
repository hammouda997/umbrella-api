#!/usr/bin/env node
/**
 * Smoke E2E: signup → approve → create INTERNAL → pickup to AU_DEPOT → LIVRES → track.
 * Usage: node scripts/e2e-send-receive.mjs [baseUrl]
 * Requires API running with seed admin + pickup.
 */
const BASE = process.argv[2] ?? 'http://localhost:3011';

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const stamp = Date.now().toString(36);
  const email = `e2e.${stamp}@umbrella.test`;
  const phone = String(20000000 + (Date.now() % 79999999)).slice(0, 8);

  console.log('1) Signup expediteur…');
  await req('/auth/signup', {
    method: 'POST',
    body: {
      name: `E2E ${stamp}`,
      email,
      phone,
      password: 'E2eTest99',
      role: 'EXPEDITEUR',
      governorate: 'Tunis',
      city: 'Tunis',
      address: '12 Avenue Habib Bourguiba',
      productTypes: ['Accessoires'],
    },
  });

  console.log('2) Admin approve…');
  const admin = await req('/auth/signin', {
    method: 'POST',
    body: { email: 'admin@umbrella.tn', password: 'Admin@12345' },
  });
  const pending = await req('/users', { token: admin.accessToken });
  const user = pending.find((u) => u.email === email);
  if (!user) throw new Error('Pending user not found');
  await req(`/users/${user.id}/approval`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { status: 'APPROVED' },
  });

  console.log('3) Expediteur login + create parcel…');
  const exp = await req('/auth/signin', {
    method: 'POST',
    body: { email, password: 'E2eTest99' },
  });
  const parcel = await req('/parcels', {
    method: 'POST',
    token: exp.accessToken,
    body: {
      recipientName: 'Client E2E',
      phone: '51926850',
      governorate: 'Tunis',
      city: 'Tunis',
      address: 'Rue de la Kasbah 1',
      price: 45.5,
      mode: 'INTERNAL',
      articleCount: 1,
    },
  });
  const code = parcel.code;
  if (!code) throw new Error('Parcel code missing');
  console.log('   code', code);

  console.log('4) Pickup scan ENLEVES → AU_DEPOT…');
  const pickup = await req('/auth/signin', {
    method: 'POST',
    body: { email: 'pickup@umbrella.tn', password: 'Pickup@12345' },
  });
  await req('/parcels/scan', {
    method: 'POST',
    token: pickup.accessToken,
    body: { code, status: 'ENLEVES' },
  });
  await req('/parcels/scan', {
    method: 'POST',
    token: pickup.accessToken,
    body: { code, status: 'AU_DEPOT' },
  });

  console.log('5) Admin advance to LIVRES…');
  const steps = [
    'EXPEDIE_DESTINATION',
    'ARRIVE_DESTINATION',
    'AFFECTE_LIVREUR',
    'EN_COURS',
    'LIVRES',
  ];
  let current = await req(`/parcels/by-code/${encodeURIComponent(code)}`, {
    token: admin.accessToken,
  });
  for (const status of steps) {
    if (current.status === 'LIVRES') break;
    const drivers = await req('/users/livreurs', { token: admin.accessToken }).catch(
      () => [],
    );
    const driverId = drivers[0]?.id;
    current = await req(`/parcels/${current.id}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: {
        status,
        ...(status === 'AFFECTE_LIVREUR' && driverId ? { driverId } : {}),
      },
    });
    console.log('   →', current.status);
  }

  console.log('6) Public track…');
  const track = await req(`/parcels/track/${encodeURIComponent(code)}`);
  if (track.status !== 'LIVRES') {
    throw new Error(`Expected LIVRES, got ${track.status}`);
  }
  const hasLivres = (track.timeline ?? []).some(
    (e) => e.status === 'LIVRES' || /livré/i.test(e.label ?? ''),
  );
  if (!hasLivres) throw new Error('Timeline missing LIVRES receive event');

  console.log('OK — send→receive E2E passed for', code);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
