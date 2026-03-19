'use strict';
'require view';
'require rpc';
'require ui';

const NUM_PORTS = 5;
const DEFAULT_BURST_BYTES = 65536;

const callInfo = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'get_info',
	expect: {}
});

const callStatus = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'status',
	expect: {}
});

const callSetPort = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'set_port',
	params: [ 'port', 'enable', 'rate_kbps', 'burst_bytes' ],
	expect: {}
});

function fmt_num(v) {
	if (v == null)
		return '-';
	return String(v);
}

function fmt_bool(v) {
	return (+v) ? _('on') : _('off');
}

function parse_int(v, fallback) {
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : fallback;
}

function status_map_by_port(ports) {
	const map = {};

	if (!ports)
		return map;

	for (let i = 0; i < ports.length; i++) {
		const p = ports[i];
		if (p && p.port != null)
			map[+p.port] = p;
	}

	return map;
}

function render_table_body(tbody, ports) {
	tbody.innerHTML = '';

	if (!ports || !ports.length) {
		tbody.appendChild(E('tr', {}, [
			E('td', { colspan: 8 }, [ _('No TBF data returned') ])
		]));
		return;
	}

	for (let i = 0; i < ports.length; i++) {
		const p = ports[i];
		tbody.appendChild(E('tr', {}, [
			E('td', {}, [ 'p' + fmt_num(p.port) ]),
			E('td', {}, [ fmt_bool(p.en) ]),
			E('td', {}, [ fmt_bool(p.meter) ]),
			E('td', {}, [ fmt_bool(p.dual_rate) ]),
			E('td', {}, [ fmt_num(p.eir) ]),
			E('td', {}, [ fmt_num(Math.round(+p.rate_kbps || 0)) ]),
			E('td', {}, [ fmt_num(p.ebs) ]),
			E('td', {}, [ fmt_num(p.burst_bytes) ])
		]));
	}
}

function update_raw_box(node, st) {
	node.value = (st && st.output) ? st.output : '';
}

function render_control_body(tbody, ports, apply_cb) {
	const by_port = status_map_by_port(ports);

	tbody.innerHTML = '';

	for (let port = 0; port < NUM_PORTS; port++) {
		const p = by_port[port] || {};
		const currentRate = parse_int(p.rate_kbps, 100000);
		const currentBurst = parse_int(p.burst_bytes, DEFAULT_BURST_BYTES);

		const enBox = E('input', {
			type: 'checkbox'
		});
		enBox.checked = !!(+p.en);

		const rateInput = E('input', {
			'class': 'cbi-input-text',
			type: 'number',
			min: '1',
			step: '1',
			style: 'width: 10em;'
		});
		rateInput.value = String(Math.max(1, currentRate));

		const burstInput = E('input', {
			'class': 'cbi-input-text',
			type: 'number',
			min: '64',
			step: '64',
			style: 'width: 10em;'
		});
		burstInput.value = String(Math.max(64, currentBurst));

		const applyBtn = E('button', {
			'class': 'cbi-button cbi-button-apply',
			type: 'button'
		}, [ _('Apply') ]);

		applyBtn.addEventListener('click', function(ev) {
			ev.preventDefault();

			const enable = enBox.checked ? 1 : 0;
			const rate = parse_int(rateInput.value, 0);
			const burst = parse_int(burstInput.value, 0);

			if (enable && rate <= 0) {
				ui.addNotification(null,
					E('p', {}, [ _('Rate must be > 0 kbps') ]),
					'error');
				return;
			}

			if (enable && burst <= 0) {
				ui.addNotification(null,
					E('p', {}, [ _('Burst must be > 0 bytes') ]),
					'error');
				return;
			}

			applyBtn.disabled = true;
			Promise.resolve(apply_cb(port, enable, rate, burst)).finally(function() {
				applyBtn.disabled = false;
			});
		});

		tbody.appendChild(E('tr', {}, [
			E('td', {}, [ 'p' + port ]),
			E('td', {}, [ enBox ]),
			E('td', {}, [ rateInput ]),
			E('td', {}, [ burstInput ]),
			E('td', {}, [ applyBtn ])
		]));
	}
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInfo(), {}),
			L.resolveDefault(callStatus(), {})
		]);
	},

	render: function(data) {
		const info = data[0] || {};
		const st = data[1] || {};

		const rawBox = E('textarea', {
			'class': 'cbi-input-textarea',
			'readonly': true,
			'rows': 7,
			'style': 'width:100%;font-family:monospace;'
		});

		const statusTbody = E('tbody');
		const statusTable = E('table', { 'class': 'table cbi-section-table' }, [
			E('thead', {}, [
				E('tr', {}, [
					E('th', {}, [ _('Port') ]),
					E('th', {}, [ _('Shaper') ]),
					E('th', {}, [ _('Meter') ]),
					E('th', {}, [ _('Dual-rate') ]),
					E('th', {}, [ _('EIR') ]),
					E('th', {}, [ _('Rate (kbps)') ]),
					E('th', {}, [ _('EBS') ]),
					E('th', {}, [ _('Burst (bytes)') ])
				])
			]),
			statusTbody
		]);

		const controlTbody = E('tbody');
		const controlTable = E('table', { 'class': 'table cbi-section-table' }, [
			E('thead', {}, [
				E('tr', {}, [
					E('th', {}, [ _('Port') ]),
					E('th', {}, [ _('Enable') ]),
					E('th', {}, [ _('Rate (kbps)') ]),
					E('th', {}, [ _('Burst (bytes)') ]),
					E('th', {}, [ _('Action') ])
				])
			]),
			controlTbody
		]);

		const refreshBtn = E('button', {
			'class': 'cbi-button cbi-button-neutral',
			type: 'button'
		}, [ _('Refresh') ]);

		const helperPath = E('code', {}, [ info.helper || '/usr/sbin/cr881x-yt921x-qos' ]);

		const applyState = function(next) {
			render_table_body(statusTbody, next.ports || []);
			render_control_body(controlTbody, next.ports || [], applyPort);
			update_raw_box(rawBox, next || {});
		};

		const refreshState = function() {
			return L.resolveDefault(callStatus(), {}).then(function(next) {
				if (!next || !next.ok) {
					ui.addNotification(null,
						E('p', {}, [ (next && (next.error || next.output)) || _('Failed to refresh QoS status.') ]),
						'error');
				}

				applyState(next || {});
			});
		};

		const applyPort = function(port, enable, rate, burst) {
			return L.resolveDefault(callSetPort(port, enable, rate, burst), {}).then(function(res) {
				if (!res || !res.ok) {
					ui.addNotification(null,
						E('p', {}, [ (res && (res.error || res.output)) || _('Failed to apply port setting.') ]),
						'error');
				}

				if (res && res.status)
					applyState(res.status);
				else
					return refreshState();
			});
		};

		applyState(st);

		refreshBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			refreshState();
		});

		return E('div', {}, [
			E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, [ _('CR881x QoS Offload (YT921x)') ]),
				E('div', { 'class': 'cbi-section-descr' }, [
					_('Hardware TBF status and per-port runtime controls via YT921x debugfs.'),
					' ',
					_('Settings are runtime-only for now.'),
					' ',
					_('Helper: '),
					helperPath
				]),
				E('div', { 'class': 'cbi-section' }, [
					controlTable,
					E('hr'),
					statusTable,
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ _('Raw output') ]),
						E('div', { 'class': 'cbi-value-field' }, [ rawBox ])
					]),
					E('div', { 'class': 'cbi-page-actions' }, [
						refreshBtn
					])
				])
			])
		]);
	}
});
