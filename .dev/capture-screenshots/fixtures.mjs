export const identity = {
  hostname: 'openwrt-home-main',
  ipv4: '203.0.113.25',
  isp: 'Acme Telecom',
  city: 'Amsterdam',
  serverHost: 'speedtest.example.net:8080'
};

export const configs = {
  luci: {
    main: { '.name': 'main', '.type': 'core', '.anonymous': false, '.index': 0, lang: 'en', mediaurlbase: '/luci-static/bootstrap-light' },
    apply: { '.name': 'apply', '.type': 'internal', '.anonymous': false, '.index': 1, rollback: '90', holdoff: '4', timeout: '5', display: '1.5' }
  },
  'speedtest-ng': {
    display: { '.name': 'display', '.type': 'speedtest', '.anonymous': false, '.index': 0, time_format: '24h' },
    schedule: {
      '.name': 'schedule', '.type': 'speedtest', '.anonymous': false, '.index': 1,
      enable: '1', days: ['1', '3', '5'], start: '4', stop: '7', frequency: '15', test: 'latency'
    }
  }
};

// Reconstructed from the existing screenshots; no router results are imported.
const measurements = [
  [1, '04:00', 'scheduled', 'latency', 20, 1, null, null, ''],
  [2, '04:15', 'scheduled', 'latency', 20, 0, null, null, ''],
  [3, '19:49', 'manual', 'all', 21, 0, 472.16, 496.03, 'via repeater'],
  [4, '19:50', 'manual', 'download', 21, 0, 546.86, null, ''],
  [5, '19:51', 'manual', 'all', 20, 2, 471.06, 459.09, 'Evening peak'],
  [6, '00:16', 'manual', 'upload', 21, 0, null, 541.71, ''],
  [7, '00:32', 'manual', 'all', 21, 0, 494.76, 444.23, 'VPN on (WireGuard)'],
  [8, '00:45', 'manual', 'all', 20, 0, 512.46, 462.76, 'VPN off for comparison'],
  [9, '00:46', 'manual', 'all', 20, 0, 596.1, 480.44, ''],
  [10, '10:48', 'manual', 'all', 21, 2, 533.88, 454.55, ''],
  [11, '11:00', 'manual', 'all', 21, 0, 622.09, 473.46, '']
];

export const records = measurements.map(([seq, time, trigger, test, ping, jitter, download, upload, note]) => ({
  id: `sample-run-${String(seq).padStart(4, '0')}`,
  seq,
  timestamp: `2026-01-${seq <= 5 ? '14' : '15'}T${time}:00+00:00`,
  trigger, test, provider: 'speedtestcpp',
  server: { id: '12345', host: identity.serverHost, name: identity.city, sponsor: 'Acme Telecom', distance_km: 7 },
  client: { ip: identity.ipv4, isp: identity.isp, lat: 52.37, lon: 4.9 },
  ping_ms: ping, jitter_ms: jitter, latency_ms: ping,
  download_mbit: download, upload_mbit: upload, note
}));

export const detailRecord = records.find(record => record.seq === 10);

export function rpcReply(object, method, args) {
  if (object === 'uci' && method === 'get' && configs[args.config])
    return { values: structuredClone(configs[args.config]) };
  if (object === 'uci' && method === 'changes') return { changes: {} };
  if (object === 'session' && method === 'access')
    return args.object ? { access: true } : {
      'access-group': { 'luci-base': ['read', 'write'], 'luci-app-speedtest-ng': ['read', 'write'] },
      uci: { 'speedtest-ng': ['read', 'write'] }
    };
  if (object === 'luci' && method === 'getFeatures') return {};
  if (object === 'file' && method === 'list' && args.path === '/www/luci-static/resources/preload')
    return { entries: [] };
  if (object === 'file' && method === 'exec' && args.command === '/usr/share/speedtest-ng/helper' &&
      Array.isArray(args.params) && args.params.length === 1 && args.params[0] === 'list')
    return { code: 0, stdout: JSON.stringify(records), stderr: '' };
  throw new Error(`Unmapped RPC: ${object}.${method} (${object === 'uci' ? args.config : object === 'file' && method === 'list' ? args.path : Object.keys(args || {}).sort().join(',')})`);
}

export const menu = {
  admin: {
    title: 'Administration', order: 10, action: { type: 'firstchild' }, children: {
      status: { title: 'Status', order: 10, action: { type: 'firstchild' }, children: { overview: { title: 'Overview', action: { type: 'view', path: 'status/overview' } } } },
      system: { title: 'System', order: 20, action: { type: 'firstchild' }, children: { system: { title: 'System', action: { type: 'view', path: 'system/system' } } } },
      network: { title: 'Network', order: 30, action: { type: 'firstchild' }, children: {
        network: { title: 'Interfaces', action: { type: 'view', path: 'network/interfaces' } },
        'speedtest-ng': { title: 'Speedtest NG', action: { type: 'view', path: 'speedtest-ng/speedtest' } }
      } },
      logout: { title: 'Log out', order: 90, action: { type: 'call' } }
    }
  }
};

function satisfy(nodes) {
  for (const node of Object.values(nodes)) {
    node.satisfied = true;
    if (node.children) satisfy(node.children);
  }
}
satisfy(menu);
