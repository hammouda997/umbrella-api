const BASE = process.env.API_URL ?? 'http://localhost:3011';

const LOGINS = {
  super: ['super@umbrella.tn', 'Super@12345'],
  admin: ['admin@umbrella.tn', 'Admin@12345'],
  expediteur: ['expediteur@umbrella.tn', 'Expediteur@12345'],
  livreur: ['livreur@umbrella.tn', 'Livreur@12345'],
  client: ['client@umbrella.tn', 'Client@12345'],
};

let failures = 0;

async function call(method, path, { token, body } = {}) {
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
  return { status: res.status, data };
}

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300));
  }
}

const health = await call('GET', '/health');
check('GET /health', health.status === 200 && health.data?.database === 'up', health);

const tokens = {};
for (const [role, [email, password]] of Object.entries(LOGINS)) {
  const res = await call('POST', '/auth/signin', { body: { email, password } });
  check(`signin ${role}`, res.status === 201 && res.data?.accessToken, res);
  tokens[role] = res.data?.accessToken;
}

const staffParcels = await call('GET', '/parcels', { token: tokens.admin });
check('admin lists 10 parcels', staffParcels.data?.length === 10, staffParcels.data?.length);
check('price is numeric', typeof staffParcels.data?.[0]?.price === 'number', staffParcels.data?.[0]?.price);

const clientParcels = await call('GET', '/parcels', { token: tokens.client });
check('client sees own parcels (7)', clientParcels.data?.length === 7, clientParcels.data?.length);

const livreurParcels = await call('GET', '/parcels', { token: tokens.livreur });
check('livreur sees assigned parcels (4)', livreurParcels.data?.length === 4, livreurParcels.data?.length);

const detail = await call('GET', '/parcels/2', { token: tokens.expediteur });
check('parcel detail has timeline', detail.data?.timeline?.length === 3, detail.data);

const created = await call('POST', '/parcels', {
  token: tokens.expediteur,
  body: {
    recipientName: 'Smoke Test',
    phone: '55123456',
    governorate: 'Tunis',
    city: 'La Marsa',
    address: 'Rue du test 1',
    price: 42.5,
    mode: 'EXTERNAL',
    allowOpen: true,
    tryProduct: true,
    liabilityAcceptedAt: new Date().toISOString(),
    lat: 36.878,
    lng: 10.324,
    deliveryWindow: 'matin',
    landmarkPhotoName: 'facade.jpg',
    addressQuality: 85,
    notes: 'Créneau: Matin',
  },
});
check('create parcel with front fields', created.status === 201 && created.data?.code, created);
const newId = created.data?.id;

const edited = await call('PATCH', `/parcels/${newId}`, {
  token: tokens.expediteur,
  body: { recipientName: 'Smoke Test Edit', price: 50 },
});
check('edit parcel', edited.status === 200 && edited.data?.recipientName === 'Smoke Test Edit', edited);

const statusUpdate = await call('PATCH', '/parcels/2/status', {
  token: tokens.livreur,
  body: { status: 'A_VERIFIER', comment: 'Client absent', actor: 'LIVREUR' },
});
check(
  'livreur status + comment',
  statusUpdate.status === 200 && statusUpdate.data?.timeline?.at(-1)?.comment === 'Client absent',
  statusUpdate,
);

const track = await call('GET', '/parcels/track/UMB-COURS-001');
check('public tracking with timeline', track.status === 200 && track.data?.timeline?.length >= 3, track);

const zones = await call('GET', '/zones', { token: tokens.admin });
check('zones list', zones.data?.length === 3, zones.data);
const zonePatch = await call('PATCH', '/zones/3', { token: tokens.admin, body: { isActive: false } });
check('zone deactivate', zonePatch.status === 200 && zonePatch.data?.isActive === false, zonePatch);
await call('PATCH', '/zones/3', { token: tokens.admin, body: { isActive: true } });

const cod = await call('GET', '/cod', { token: tokens.admin });
check('cod list', cod.status === 200 && cod.data?.summary?.openCount >= 1, cod.data?.summary);

const notifications = await call('GET', '/notifications', { token: tokens.admin });
check('notifications', notifications.status === 200 && Array.isArray(notifications.data), notifications);

const me = await call('PATCH', '/users/me', { token: tokens.client, body: { name: 'Demo Client' } });
check('update own profile', me.status === 200, me);

const tickets = await call('GET', '/tickets', { token: tokens.client });
check('client tickets (2)', tickets.data?.length === 2, tickets.data?.length);

const payments = await call('GET', '/payments', { token: tokens.expediteur });
check('expediteur payments (3)', payments.data?.length === 3, payments.data?.length);

const removed = await call('DELETE', `/parcels/${newId}`, { token: tokens.expediteur });
check('delete parcel', removed.status === 200, removed);

const forbidden = await call('GET', '/users', { token: tokens.client });
check('client cannot list users', forbidden.status === 403, forbidden.status);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
