/* SPDX-License-Identifier: GPL-2.0-only */
'use strict';
'require baseclass';

function uint(value, min, max) {
	return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function bit(value) { return value === 0 || value === 1; }
function limiter(row) {
	return row && bit(row.en) && (row.en === 0 ||
		uint(row.rate_kbps, 1, 2500000) && uint(row.burst_bytes, 64, 1048512));
}
function rate(value) {
	const text = String(value).trim();
	if (!/^\d+(\.\d{1,3})?$/.test(text))
		throw new Error(_('Enter a speed from 0.001 to 2500 Mbps, with at most three decimal places.'));
	const parts = text.split('.');
	const kbps = Number(parts[0]) * 1000 + Number(((parts[1] || '') + '000').slice(0, 3));
	if (!uint(kbps, 1, 2500000))
		throw new Error(_('Speed must be between 0.001 and 2500 Mbps.'));
	return kbps;
}
function burst(value) {
	const text = String(value).trim();
	if (!/^\d+$/.test(text) || !uint(Number(text), 64, 1048512))
		throw new Error(_('Burst size must be a whole number from 64 to 1048512 bytes.'));
	return Number(text);
}
function flags(row) { return row && bit(row.mcast_flood) && bit(row.bcast_flood); }

return baseclass.extend({
	status: function(data) {
		if (!data || data.ok !== true || !Array.isArray(data.ports))
			throw new Error(data && data.error || _('QoS settings are unavailable.'));
		const ports = [0, 1, 2, 3].map(port => {
			const rows = data.ports.filter(row => row && row.port === port);
			return rows.length === 1 && limiter(rows[0]) ? Object.assign({}, rows[0]) : null;
		});
		return { ports: ports, global: bit(data.global_enabled) ? data.global_enabled : null,
			soft: limiter(data.soft) && typeof data.soft.ifname === 'string' ? Object.assign({}, data.soft) : null,
			output: String(data.output || '') };
	},
	rate: rate,
	burst: burst,
	flags: flags,
	label: function(port) { return [ _('LAN 1'), _('LAN 2'), _('LAN 3'), _('WAN') ][port]; },
	speed: function(row) { return !row ? _('Unknown') : row.en ? (row.rate_kbps / 1000) + ' Mbps' : _('No limit saved'); },
	seed: function(row) {
		return { enable: !!row.en, rate: String(row.en ? row.rate_kbps / 1000 : 100),
			burst: String(row.en ? row.burst_bytes : 65536),
			mcast: row.mcast_flood === 1, bcast: row.bcast_flood === 1 };
	},
	portPayload: function(row, draft) {
		if (!row || !flags(row)) throw new Error(_('Refresh the port settings before applying changes.'));
		return [ row.port, draft.enable ? 1 : 0, draft.enable ? rate(draft.rate) : 100000,
			burst(draft.burst), draft.mcast ? 1 : 0, draft.bcast ? 1 : 0 ];
	},
	softPayload: function(draft) {
		const name = String(draft.ifname).trim();
		if (!/^[A-Za-z0-9_.:-]{1,15}$/.test(name)) throw new Error(_('Enter an existing interface name, up to 15 characters.'));
		return [ name, draft.enable ? 1 : 0, draft.enable ? rate(draft.rate) : 50000, burst(draft.burst) ];
	},
	key: function(row) {
		if (!row) return 'unknown';
		return JSON.stringify([row.port, row.ifname, row.en, row.rate_kbps, row.burst_bytes, row.mcast_flood, row.bcast_flood]);
	}
});
