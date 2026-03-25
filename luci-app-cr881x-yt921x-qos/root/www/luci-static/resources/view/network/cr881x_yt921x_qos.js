'use strict';
'require view';
'require rpc';
'require ui';

const NUM_PORTS = 4;
const DEFAULT_BURST_BYTES = 65536;
const FILTER_MASK_MAX = 0x7ff;
const FILTER_MASK_DANGEROUS = 0x7ff;
const FILTER_SAFE_DEFAULT = 0x400;
const STYLE_ID = 'cr881x-yt921x-qos-style';

function port_label(port) {
	switch (port) {
	case 0:
		return _('LAN 1');
	case 1:
		return _('LAN 2');
	case 2:
		return _('LAN 3');
	case 3:
		return _('WAN');
	case 4:
		return _('Internal (CPU/MCU)');
	default:
		return _('Port ') + port;
	}
}

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

const callGetFloodFilter = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'get_flood_filter',
	expect: {}
});

const callSetFloodFilter = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'set_flood_filter',
	params: [ 'target', 'mask', 'force' ],
	expect: {}
});

function ensure_style() {
	if (document.getElementById(STYLE_ID))
		return;

	document.head.appendChild(E('style', { id: STYLE_ID }, [ `
		.crq-page {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.crq-panel {
			border: 1px solid var(--border-color-medium, #dfe3e8);
			border-radius: 12px;
			background: var(--panel-bg, #fff);
			padding: 14px;
			box-shadow: 0 1px 1px rgba(0, 0, 0, .03);
		}

		.crq-hero {
			background: linear-gradient(140deg, #f7fbff 0%, #ffffff 58%, #f4f9ff 100%);
		}

		.crq-head {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 10px;
		}

		.crq-title {
			margin: 0;
			font-size: 20px;
			line-height: 1.2;
		}

		.crq-subtitle {
			margin-top: 6px;
			color: var(--text-color-medium, #5f6c7b);
		}

		.crq-updated {
			display: inline-block;
			margin-top: 8px;
			font-size: 12px;
			color: var(--text-color-medium, #5f6c7b);
		}

		.crq-metrics {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 10px;
		}

		.crq-metric {
			border: 1px solid var(--border-color-medium, #dfe3e8);
			border-radius: 10px;
			background: linear-gradient(180deg, #ffffff, #fafbfd);
			padding: 10px;
			min-height: 88px;
		}

		.crq-metric-title {
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: .05em;
			color: var(--text-color-medium, #5f6c7b);
		}

		.crq-metric-value {
			margin-top: 8px;
			font-size: 22px;
			font-weight: 700;
			line-height: 1.1;
			word-break: break-word;
		}

		.crq-metric-hint {
			margin-top: 6px;
			font-size: 12px;
			color: var(--text-color-medium, #5f6c7b);
		}

		.crq-main {
			display: grid;
			grid-template-columns: 2fr 1fr;
			gap: 12px;
		}

		.crq-port-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 10px;
		}

		.crq-port-card {
			border: 1px solid var(--border-color-medium, #dfe3e8);
			border-radius: 10px;
			padding: 12px;
			background: linear-gradient(180deg, #ffffff, #fbfcfd);
		}

		.crq-port-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 8px;
		}

		.crq-port-name {
			font-size: 18px;
			font-weight: 700;
		}

		.crq-chip {
			display: inline-block;
			padding: 3px 10px;
			border-radius: 999px;
			font-size: 12px;
			font-weight: 600;
			border: 1px solid #cfe3d3;
			background: #ecf8ee;
			color: #1f6b37;
		}

		.crq-chip.off {
			border-color: #efc5bf;
			background: #fdecea;
			color: #962d1f;
		}

		.crq-port-live {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 8px;
			margin-top: 10px;
		}

		.crq-k {
			font-size: 12px;
			color: var(--text-color-medium, #5f6c7b);
		}

		.crq-v {
			margin-top: 3px;
			font-weight: 600;
		}

		.crq-meter {
			height: 7px;
			border-radius: 999px;
			background: #e9edf2;
			overflow: hidden;
			margin-top: 8px;
		}

		.crq-meter > span {
			display: block;
			height: 100%;
			background: linear-gradient(90deg, #0ea5e9, #2563eb);
		}

		.crq-row {
			display: flex;
			gap: 8px;
			align-items: center;
			margin-top: 10px;
			flex-wrap: wrap;
		}

		.crq-fields {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 10px;
			margin-top: 10px;
		}

		.crq-field label {
			display: block;
			font-size: 12px;
			margin-bottom: 4px;
			color: var(--text-color-medium, #5f6c7b);
		}

		.crq-presets {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-top: 8px;
		}

		.crq-actions {
			display: flex;
			justify-content: flex-end;
			margin-top: 12px;
		}

		.crq-side {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.crq-side h3,
		.crq-ports h3 {
			margin: 0 0 8px;
		}

		.crq-inline {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: wrap;
		}

		.crq-help {
			margin-top: 8px;
			font-size: 12px;
			color: var(--text-color-medium, #5f6c7b);
			line-height: 1.45;
		}

		.crq-raw textarea {
			min-height: 160px;
		}

		@media (max-width: 1100px) {
			.crq-main {
				grid-template-columns: 1fr;
			}
		}

		@media (max-width: 640px) {
			.crq-head {
				flex-direction: column;
				align-items: stretch;
			}

			.crq-fields {
				grid-template-columns: 1fr;
			}
		}
	` ]));
}

function parse_int(v, fallback) {
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : fallback;
}

function parse_mask_input(v) {
	const s = String(v == null ? '' : v).trim();
	let n = NaN;

	if (/^0x[0-9a-f]+$/i.test(s))
		n = parseInt(s, 16);
	else if (/^[0-9]+$/.test(s))
		n = parseInt(s, 10);

	if (!Number.isInteger(n) || n < 0 || n > FILTER_MASK_MAX)
		return null;

	return n;
}

function fmt_mask_hex(v) {
	if (v == null || v < 0)
		return '-';

	let s = Number(v).toString(16);
	while (s.length < 3)
		s = '0' + s;
	return '0x' + s;
}

function fmt_rate_short(kbps) {
	const n = Math.max(0, Math.round(+kbps || 0));
	if (n >= 1000000)
		return (n / 1000000).toFixed(2).replace(/\.00$/, '') + ' Gbps';
	if (n >= 1000)
		return (n / 1000).toFixed(1).replace(/\.0$/, '') + ' Mbps';
	return n + ' kbps';
}

function fmt_bytes_short(bytes) {
	const n = Math.max(0, Math.round(+bytes || 0));
	if (n >= 1024 * 1024)
		return (n / (1024 * 1024)).toFixed(2).replace(/\.00$/, '') + ' MiB';
	if (n >= 1024)
		return (n / 1024).toFixed(1).replace(/\.0$/, '') + ' KiB';
	return n + ' B';
}

function status_map_by_port(ports) {
	const map = {};

	if (!ports)
		return map;

	for (let i = 0; i < ports.length; i++) {
		const p = ports[i];
		if (p && p.port != null && +p.port < NUM_PORTS)
			map[+p.port] = p;
	}

	return map;
}

function helper_path_node(path) {
	return E('code', {
		style: 'font-size:12px;display:block;overflow-wrap:anywhere;'
	}, [ path || '/usr/sbin/cr881x-yt921x-qos' ]);
}

function make_metric(title, hint) {
	const valueNode = E('div', { class: 'crq-metric-value' }, [ '-' ]);
	const hintNode = E('div', { class: 'crq-metric-hint' }, [ hint || '' ]);

	return {
		node: E('div', { class: 'crq-metric' }, [
			E('div', { class: 'crq-metric-title' }, [ title ]),
			valueNode,
			hintNode
		]),
		set: function(value, nextHint) {
			if (value && value.nodeType)
				valueNode.replaceChildren(value);
			else
				valueNode.textContent = value == null ? '-' : String(value);

			if (nextHint != null)
				hintNode.textContent = String(nextHint);
		}
	};
}

function set_raw_output(node, st) {
	node.value = (st && st.output) ? st.output : '';
}

function port_card(port, st, apply_cb) {
	const enabled = !!(+st.en);
	const liveRate = Math.round(+st.rate_kbps || 0);
	const liveBurst = parse_int(st.burst_bytes, DEFAULT_BURST_BYTES);
	const rateInput = E('input', {
		type: 'number',
		min: '1',
		step: '1',
		class: 'cbi-input-text',
		style: 'width:100%;'
	});
	const burstInput = E('input', {
		type: 'number',
		min: '64',
		step: '64',
		class: 'cbi-input-text',
		style: 'width:100%;'
	});
	const enBox = E('input', { type: 'checkbox' });
	const applyBtn = E('button', {
		type: 'button',
		class: 'cbi-button cbi-button-apply'
	}, [ _('Apply') ]);

	rateInput.value = String(Math.max(1, liveRate || 100000));
	burstInput.value = String(Math.max(64, liveBurst || DEFAULT_BURST_BYTES));
	enBox.checked = enabled;

	const chip = E('span', { class: 'crq-chip' + (enabled ? '' : ' off') }, [ enabled ? _('Enabled') : _('Disabled') ]);
	const meterFill = E('span', { style: 'width:' + Math.max(1, Math.min(100, Math.round((liveRate / 1000000) * 100))) + '%;' });

	function run_apply(ev) {
		ev.preventDefault();

		const enable = enBox.checked ? 1 : 0;
		const rate = parse_int(rateInput.value, 0);
		const burst = parse_int(burstInput.value, 0);

		if (enable && rate <= 0) {
			ui.addNotification(null, E('p', {}, [ _('Rate must be > 0 kbps') ]), 'error');
			return;
		}

		if (enable && burst <= 0) {
			ui.addNotification(null, E('p', {}, [ _('Burst must be > 0 bytes') ]), 'error');
			return;
		}

		applyBtn.disabled = true;
		Promise.resolve(apply_cb(port, enable, rate, burst)).finally(function() {
			applyBtn.disabled = false;
		});
	}

	applyBtn.addEventListener('click', run_apply);

	const presets = E('div', { class: 'crq-presets' });
	[
		[ 50000, '50M' ],
		[ 100000, '100M' ],
		[ 300000, '300M' ],
		[ 1000000, '1G' ]
	].forEach(function(preset) {
		const btn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-neutral',
			style: 'padding:2px 9px;min-height:auto;line-height:1.35;'
		}, [ preset[1] ]);

		btn.addEventListener('click', function(ev) {
			ev.preventDefault();
			rateInput.value = String(preset[0]);
		});

		presets.appendChild(btn);
	});

	return E('div', { class: 'crq-port-card' }, [
		E('div', { class: 'crq-port-header' }, [
			E('div', { class: 'crq-port-name' }, [ port_label(port) ]),
			chip
		]),
		E('div', { class: 'crq-port-live' }, [
			E('div', {}, [
				E('div', { class: 'crq-k' }, [ _('Live rate') ]),
				E('div', { class: 'crq-v' }, [ fmt_rate_short(liveRate) ])
			]),
			E('div', {}, [
				E('div', { class: 'crq-k' }, [ _('Live burst') ]),
				E('div', { class: 'crq-v' }, [ fmt_bytes_short(liveBurst) ])
			])
		]),
		E('div', { class: 'crq-meter' }, [ meterFill ]),
		E('div', { class: 'crq-row' }, [
			E('label', {
				style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;'
			}, [
				enBox,
				E('span', {}, [ _('Enable shaper') ])
			])
		]),
		E('div', { class: 'crq-fields' }, [
			E('div', { class: 'crq-field' }, [
				E('label', {}, [ _('Rate (kbps)') ]),
				rateInput
			]),
			E('div', { class: 'crq-field' }, [
				E('label', {}, [ _('Burst (bytes)') ]),
				burstInput
			])
		]),
		E('div', { class: 'crq-k', style: 'margin-top:8px;' }, [ _('Quick presets') ]),
		presets,
		E('div', { class: 'crq-actions' }, [ applyBtn ])
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInfo(), {}),
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callGetFloodFilter(), {})
		]);
	},

	render: function(data) {
		ensure_style();

		const info = data[0] || {};
		let currentStatus = data[1] || {};
		let currentFlood = data[2] || {};

		const refreshBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-neutral'
		}, [ _('Refresh') ]);

		const updatedNode = E('span', { class: 'crq-updated' }, [ _('Last refresh: -') ]);
		const metricPorts = make_metric(_('Ports enabled'), _('of ') + NUM_PORTS);
		const metricPeak = make_metric(_('Peak rate'), _('Highest active shaper'));
		const metricAvg = make_metric(_('Average rate'), _('Across enabled ports'));
		const metricFlood = make_metric(_('Flood mask'), _('Multicast / Broadcast'));
		const metricBackend = make_metric(_('Backend helper'), '');

		const summaryWrap = E('div', { class: 'crq-metrics' }, [
			metricPorts.node,
			metricPeak.node,
			metricAvg.node,
			metricFlood.node,
			metricBackend.node
		]);

		const portsWrap = E('div', { class: 'crq-port-grid' });
		const floodMcastNow = E('code', {}, [ '-' ]);
		const floodBcastNow = E('code', {}, [ '-' ]);
		const floodTarget = E('select', { class: 'cbi-input-select' }, [
			E('option', { value: 'both' }, [ _('Both (mcast+bcast)') ]),
			E('option', { value: 'mcast' }, [ _('Multicast only') ]),
			E('option', { value: 'bcast' }, [ _('Broadcast only') ])
		]);
		const floodMaskInput = E('input', {
			class: 'cbi-input-text',
			type: 'text',
			style: 'width: 10em;',
			placeholder: '0x400'
		});
		floodMaskInput.value = fmt_mask_hex(FILTER_SAFE_DEFAULT);

		const floodForce = E('input', { type: 'checkbox' });
		const floodApplyBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-apply'
		}, [ _('Apply filter mask') ]);

		const rawBox = E('textarea', {
			class: 'cbi-input-textarea',
			readonly: true,
			rows: 7,
			style: 'width:100%;font-family:monospace;'
		});

		const applyFloodState = function(next) {
			const mcast = (next && next.mcast != null) ? +next.mcast : null;
			const bcast = (next && next.bcast != null) ? +next.bcast : null;

			floodMcastNow.textContent = (mcast == null) ? '-' : (fmt_mask_hex(mcast) + ' (' + mcast + ')');
			floodBcastNow.textContent = (bcast == null) ? '-' : (fmt_mask_hex(bcast) + ' (' + bcast + ')');
			metricFlood.set('M ' + floodMcastNow.textContent + ' / B ' + floodBcastNow.textContent);
		};

		const applyStatusState = function(st) {
			const ports = st.ports || [];
			const byPort = status_map_by_port(ports);
			let enabledCount = 0;
			let activeRates = [];

			for (let i = 0; i < ports.length; i++) {
				if (ports[i] && +ports[i].port < NUM_PORTS && +ports[i].en) {
					enabledCount++;
					activeRates.push(Math.round(+ports[i].rate_kbps || 0));
				}
			}

			const peakRate = activeRates.length ? Math.max.apply(null, activeRates) : 0;
			const avgRate = activeRates.length ? Math.round(activeRates.reduce(function(a, b) { return a + b; }, 0) / activeRates.length) : 0;

			metricPorts.set(String(enabledCount), _('of ') + NUM_PORTS);
			metricPeak.set(fmt_rate_short(peakRate), peakRate + ' kbps');
			metricAvg.set(fmt_rate_short(avgRate), avgRate + ' kbps');
			metricBackend.set(helper_path_node(info.helper || '/usr/sbin/cr881x-yt921x-qos'));

			portsWrap.innerHTML = '';
			for (let port = 0; port < NUM_PORTS; port++)
				portsWrap.appendChild(port_card(port, byPort[port] || {}, applyPort));

			set_raw_output(rawBox, st);
			updatedNode.textContent = _('Last refresh: ') + new Date().toLocaleTimeString();
		};

		const refreshState = function() {
			return Promise.all([
				L.resolveDefault(callStatus(), {}),
				L.resolveDefault(callGetFloodFilter(), {})
			]).then(function(next) {
				const nextStatus = next[0] || {};
				const nextFlood = next[1] || {};

				if (!nextStatus || !nextStatus.ok) {
					ui.addNotification(null,
						E('p', {}, [ (nextStatus && (nextStatus.error || nextStatus.output)) || _('Failed to refresh QoS status.') ]),
						'error');
				}

				if (!nextFlood || !nextFlood.ok) {
					ui.addNotification(null,
						E('p', {}, [ (nextFlood && (nextFlood.error || nextFlood.output)) || _('Failed to refresh flood filter state.') ]),
						'error');
				}

				currentStatus = nextStatus;
				currentFlood = nextFlood;
				applyFloodState(currentFlood);
				applyStatusState(currentStatus);
			});
		};

		const applyPort = function(port, enable, rate, burst) {
			return L.resolveDefault(callSetPort(port, enable, rate, burst), {}).then(function(res) {
				if (!res || !res.ok) {
					ui.addNotification(null,
						E('p', {}, [ (res && (res.error || res.output)) || _('Failed to apply port setting.') ]),
						'error');
				}

				if (res && res.status) {
					currentStatus = res.status;
					applyStatusState(currentStatus);
					return;
				}

				return refreshState();
			});
		};

		const applyFlood = function(target, mask, force) {
			return L.resolveDefault(callSetFloodFilter(target, mask, force), {}).then(function(res) {
				if (!res || !res.ok) {
					ui.addNotification(null,
						E('p', {}, [ (res && (res.error || res.output)) || _('Failed to apply flood filter.') ]),
						'error');
				}

				return refreshState();
			});
		};

		refreshBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			refreshState();
		});

		floodApplyBtn.addEventListener('click', function(ev) {
			ev.preventDefault();

			const parsedMask = parse_mask_input(floodMaskInput.value);
			const force = floodForce.checked ? 1 : 0;
			const target = floodTarget.value || 'both';

			if (parsedMask == null) {
				ui.addNotification(null,
					E('p', {}, [ _('Mask must be decimal or hex in range 0..0x7ff') ]),
					'error');
				return;
			}

			if (parsedMask === FILTER_MASK_DANGEROUS && !force) {
				ui.addNotification(null,
					E('p', {}, [ _('0x7ff drops all egress flood traffic. Check force to apply.') ]),
					'error');
				return;
			}

			floodApplyBtn.disabled = true;
			Promise.resolve(applyFlood(target, fmt_mask_hex(parsedMask), force)).finally(function() {
				floodApplyBtn.disabled = false;
			});
		});

		applyFloodState(currentFlood);
		applyStatusState(currentStatus);

		return E('div', { class: 'cbi-map' }, [
			E('div', { class: 'crq-page' }, [
				E('section', { class: 'crq-panel crq-hero' }, [
					E('div', { class: 'crq-head' }, [
						E('div', {}, [
							E('h2', { class: 'crq-title' }, [ _('CR881x QoS Offload (YT921x)') ]),
							E('div', { class: 'crq-subtitle' }, [
								_('Per-port hardware shaping and flood-filter control. Settings are runtime-only.'),
								' ',
								_('Use this page for quick tuning and diagnostics.')
							]),
							updatedNode
						]),
						E('div', { class: 'cbi-page-actions' }, [ refreshBtn ])
					]),
					summaryWrap
				]),
				E('div', { class: 'crq-main' }, [
					E('section', { class: 'crq-panel crq-ports' }, [
						E('h3', {}, [ _('Port Shapers') ]),
						portsWrap
					]),
					E('div', { class: 'crq-side' }, [
						E('section', { class: 'crq-panel' }, [
							E('h3', {}, [ _('Flood Filter') ]),
							E('div', { class: 'crq-inline' }, [
								E('span', {}, [ _('MCAST:'), ' ', floodMcastNow ]),
								E('span', {}, [ _('BCAST:'), ' ', floodBcastNow ])
							]),
							E('div', { class: 'crq-row' }, [
								floodTarget,
								floodMaskInput,
								E('label', {
									style: 'display:flex;align-items:center;gap:4px;'
								}, [
									floodForce,
									E('span', {}, [ _('Force 0x7ff') ])
								]),
								floodApplyBtn
							]),
							E('div', { class: 'crq-help' }, [
								_('Safe default is 0x400 (drop flood to internal MCU only).'),
								' ',
								_('0x7ff can blackhole ARP/ND and break LAN reachability.')
							])
						]),
						E('section', { class: 'crq-panel crq-raw' }, [
							E('h3', {}, [ _('Raw Helper Output') ]),
							rawBox,
							E('div', { class: 'crq-help' }, [
								_('Helper path: '),
								helper_path_node(info.helper || '/usr/sbin/cr881x-yt921x-qos')
							])
						])
					])
				])
			])
		]);
	}
});
