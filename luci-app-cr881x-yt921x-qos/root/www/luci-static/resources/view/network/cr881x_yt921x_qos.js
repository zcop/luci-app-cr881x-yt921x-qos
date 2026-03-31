'use strict';
'require view';
'require rpc';
'require ui';

const NUM_PORTS = 4;
const DEFAULT_BURST_BYTES = 65536;
const RATE_KBPS_MIN = 1;
const RATE_KBPS_MAX = 2500000;
const BURST_BYTES_MIN = 64;
const BURST_BYTES_MAX = 1048512;
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

const callSetGlobal = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'set_global',
	params: [ 'enable' ],
	expect: {}
});

const callSetSoft = rpc.declare({
	object: 'luci.cr881x_yt921x_qos',
	method: 'set_soft',
	params: [ 'ifname', 'enable', 'rate_kbps', 'burst_bytes' ],
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

		.crq-main.crq-main-noside {
			grid-template-columns: 1fr;
		}

		.crq-port-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
			gap: 8px;
		}

		.crq-port-card {
			border: 1px solid var(--border-color-medium, #dfe3e8);
			border-radius: 10px;
			padding: 9px;
			background: linear-gradient(180deg, #ffffff, #fbfcfd);
		}

		.crq-port-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 6px;
		}

		.crq-port-name {
			font-size: 15px;
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
			gap: 6px;
			margin-top: 6px;
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
			margin-top: 6px;
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
			margin-top: 8px;
			flex-wrap: wrap;
		}

		.crq-fields {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 10px;
			margin-top: 10px;
		}

		.crq-port-body {
			display: grid;
			grid-template-columns: 1fr auto;
			gap: 8px;
			align-items: start;
			margin-top: 8px;
		}

		.crq-controls {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.crq-fields-compact {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.crq-field-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
		}

		.crq-field-row > label {
			margin: 0;
			font-size: 12px;
			color: var(--text-color-medium, #5f6c7b);
			flex: 1;
			min-width: 0;
		}

		.crq-num-input {
			width: 8ch;
			max-width: 100%;
			text-align: right;
			font-variant-numeric: tabular-nums;
		}

		.crq-presets-side {
			display: flex;
			flex-direction: column;
			gap: 6px;
			min-width: 58px;
		}

		.crq-presets-side .cbi-button {
			padding: 2px 7px;
			min-height: auto;
			line-height: 1.35;
			width: 100%;
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
			margin-top: 8px;
		}

		.crq-switch-master {
			display: grid;
			grid-template-columns: 1fr auto;
			gap: 8px;
			align-items: center;
			margin-top: 4px;
		}

		.crq-switch-master label {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: pointer;
			font-size: 13px;
		}

		.crq-switch-actions {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 6px;
			margin-top: 6px;
		}

		.crq-btn-block {
			width: 100%;
			text-align: center;
			min-height: 32px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}

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

		.crq-draft-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 10px;
			margin-top: 10px;
		}

		.crq-draft-muted {
			opacity: .72;
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

			.crq-port-body {
				grid-template-columns: 1fr;
			}

			.crq-presets-side {
				flex-direction: row;
				flex-wrap: wrap;
			}

			.crq-presets-side .cbi-button {
				width: auto;
			}

			.crq-switch-master {
				grid-template-columns: 1fr;
			}

			.crq-switch-actions {
				grid-template-columns: 1fr;
			}
		}
	` ]));
}

function parse_int(v, fallback) {
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : fallback;
}

function parse_uint_bounded(v, min, max, maxDigits) {
	const s = String(v == null ? '' : v).trim();
	if (!/^[0-9]+$/.test(s))
		return null;
	if (s.length > maxDigits)
		return null;

	const n = Number(s);
	if (!Number.isInteger(n) || n < min || n > max)
		return null;

	return n;
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

function status_map_by_port(ports, max_ports) {
	const map = {};
	const limit = (max_ports == null) ? NUM_PORTS : max_ports;

	if (!ports)
		return map;

	for (let i = 0; i < ports.length; i++) {
		const p = ports[i];
		if (p && p.port != null && +p.port < limit)
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

function port_card(port, st, apply_cb) {
	const enabled = !!(+st.en);
	const liveRate = Math.round(+st.rate_kbps || 0);
	const liveBurst = parse_int(st.burst_bytes, DEFAULT_BURST_BYTES);
	const rateInput = E('input', {
		type: 'text',
		inputmode: 'numeric',
		pattern: '[0-9]*',
		maxlength: '7',
		class: 'cbi-input-text crq-num-input',
		title: _('Rate in kbps') + ' (' + RATE_KBPS_MIN + '..' + RATE_KBPS_MAX + ')'
	});
	const burstInput = E('input', {
		type: 'text',
		inputmode: 'numeric',
		pattern: '[0-9]*',
		maxlength: '7',
		class: 'cbi-input-text crq-num-input',
		title: _('Burst size in bytes') + ' (' + BURST_BYTES_MIN + '..' + BURST_BYTES_MAX + ')'
	});
	const enBox = E('input', { type: 'checkbox' });
	const applyBtn = E('button', {
		type: 'button',
		class: 'cbi-button cbi-button-apply',
		title: _('Apply this port settings')
	}, [ _('Apply') ]);

	rateInput.value = String(Math.max(1, liveRate || 100000));
	burstInput.value = String(Math.max(64, liveBurst || DEFAULT_BURST_BYTES));
	enBox.checked = enabled;

	function sanitize_digits_input(input, maxDigits) {
		let v = String(input.value == null ? '' : input.value).replace(/[^0-9]/g, '');
		if (v.length > maxDigits)
			v = v.slice(0, maxDigits);
		input.value = v;
	}

	function clamp_digits_input(input, min, max, fallback, maxDigits) {
		sanitize_digits_input(input, maxDigits);
		if (!input.value) {
			input.value = String(fallback);
			return;
		}

		let n = parseInt(input.value, 10);
		if (!Number.isFinite(n))
			n = fallback;
		if (n < min)
			n = min;
		if (n > max)
			n = max;

		input.value = String(n);
	}

	rateInput.addEventListener('input', function() {
		sanitize_digits_input(rateInput, 7);
	});
	rateInput.addEventListener('blur', function() {
		clamp_digits_input(rateInput, RATE_KBPS_MIN, RATE_KBPS_MAX, Math.max(1, liveRate || 100000), 7);
	});

	burstInput.addEventListener('input', function() {
		sanitize_digits_input(burstInput, 7);
	});
	burstInput.addEventListener('blur', function() {
		clamp_digits_input(burstInput, BURST_BYTES_MIN, BURST_BYTES_MAX, Math.max(64, liveBurst || DEFAULT_BURST_BYTES), 7);
	});

	const chip = E('span', { class: 'crq-chip' + (enabled ? '' : ' off') }, [ enabled ? _('Enabled') : _('Disabled') ]);
	const meterFill = E('span', { style: 'width:' + Math.max(1, Math.min(100, Math.round((liveRate / 1000000) * 100))) + '%;' });

	function run_apply(ev) {
		ev.preventDefault();

		const enable = enBox.checked ? 1 : 0;
		const rate = parse_uint_bounded(rateInput.value, RATE_KBPS_MIN, RATE_KBPS_MAX, 7);
		const burst = parse_uint_bounded(burstInput.value, BURST_BYTES_MIN, BURST_BYTES_MAX, 7);

		if (enable && rate == null) {
			ui.addNotification(null, E('p', {}, [
				_('Rate must be numeric and in range ') + RATE_KBPS_MIN + '..' + RATE_KBPS_MAX + ' kbps'
			]), 'error');
			return;
		}

		if (enable && burst == null) {
			ui.addNotification(null, E('p', {}, [
				_('Burst must be numeric and in range ') + BURST_BYTES_MIN + '..' + BURST_BYTES_MAX + ' bytes'
			]), 'error');
			return;
		}

		applyBtn.disabled = true;
		Promise.resolve(apply_cb(port, enable, rate, burst)).finally(function() {
			applyBtn.disabled = false;
		});
	}

	applyBtn.addEventListener('click', run_apply);

	const presets = E('div', { class: 'crq-presets-side' });
	[
		[ 50000, '50M' ],
		[ 100000, '100M' ],
		[ 300000, '300M' ],
		[ 1000000, '1G' ]
	].forEach(function(preset) {
		const btn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-neutral',
			title: _('Set rate to ') + preset[1]
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
		E('div', { class: 'crq-port-body' }, [
			E('div', { class: 'crq-controls' }, [
				E('div', { class: 'crq-row', style: 'margin-top:0;' }, [
					E('label', {
						style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;'
					}, [
						enBox,
						E('span', {}, [ _('Enable shaper') ])
					])
				]),
					E('div', { class: 'crq-fields-compact' }, [
						E('div', { class: 'crq-field-row' }, [
							E('label', {}, [ _('Rate (kbps)') ]),
							rateInput
						]),
					E('div', { class: 'crq-field-row' }, [
						E('label', {}, [ _('Burst (bytes)') ]),
							burstInput
						])
					]),
					E('div', { class: 'crq-help', style: 'margin-top:6px;' }, [
						_('Rate: ') + RATE_KBPS_MIN + '..' + RATE_KBPS_MAX + ' kbps',
						' | ',
						_('Burst: ') + BURST_BYTES_MIN + '..' + BURST_BYTES_MAX + ' bytes'
					])
				]),
				E('div', {}, [
				E('div', { class: 'crq-k' }, [ _('Presets') ]),
				presets
			])
		]),
		E('div', { class: 'crq-actions' }, [ applyBtn ])
	]);
}

return view.extend({
	load: function() {
		return L.resolveDefault(callInfo(), {}).then(function(info) {
			const flood = !!(info && info.features && info.features.flood_filter);

			return Promise.all([
				info || {},
				L.resolveDefault(callStatus(), {}),
				flood ? L.resolveDefault(callGetFloodFilter(), {}) : Promise.resolve({})
			]);
		});
	},

	render: function(data) {
		ensure_style();

		const info = data[0] || {};
		const features = info.features || {};
		const floodSupported = !!features.flood_filter;
		const persistentSupported = !!features.persistent;
		const portMax = parse_int(info.port_max, NUM_PORTS - 1);
		const numPorts = Math.max(1, portMax + 1);
		let currentStatus = data[1] || {};
		let currentFlood = floodSupported ? (data[2] || {}) : {};

		const refreshBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-neutral',
			title: _('Reload status from backend')
		}, [ _('Refresh') ]);

		const updatedNode = E('span', { class: 'crq-updated' }, [ _('Last refresh: -') ]);
		const metricPorts = make_metric(_('Ports enabled'), _('of ') + numPorts);
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
			placeholder: '0x400',
			title: _('Flood filter mask (decimal or hex 0..0x7ff)')
		});
		floodMaskInput.value = fmt_mask_hex(FILTER_SAFE_DEFAULT);

		const floodForce = E('input', { type: 'checkbox' });
		const floodApplyBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-apply',
			title: _('Apply flood filter mask')
		}, [ _('Apply filter mask') ]);

		const globalEnable = E('input', { type: 'checkbox' });
		const globalApplyBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-apply',
			title: _('Apply global QoS enable state')
		}, [ _('Apply') ]);
		const softStateNow = E('code', {}, [ '-' ]);
		const softEnable = E('input', { type: 'checkbox' });
		const softIface = E('select', { class: 'cbi-input-select' }, [
			E('option', { value: 'br-guest' }, [ 'br-guest' ]),
			E('option', { value: 'wlan0-1' }, [ 'wlan0-1' ]),
			E('option', { value: 'wlan1-1' }, [ 'wlan1-1' ])
		]);
		const softRateInput = E('input', {
			type: 'text',
			inputmode: 'numeric',
			pattern: '[0-9]*',
			maxlength: '7',
			class: 'cbi-input-text crq-num-input',
			title: _('Software QoS rate in kbps')
		});
		const softBurstInput = E('input', {
			type: 'text',
			inputmode: 'numeric',
			pattern: '[0-9]*',
			maxlength: '7',
			class: 'cbi-input-text crq-num-input',
			title: _('Software QoS burst in bytes')
		});
		const softApplyBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-apply',
			title: _('Apply software QoS settings')
		}, [ _('Apply Wi-Fi/Guest QoS') ]);

		const applyFloodState = function(next) {
			if (!floodSupported) {
				floodMcastNow.textContent = '-';
				floodBcastNow.textContent = '-';
				metricFlood.set(_('N/A'), _('Unsupported by current backend'));
				return;
			}

			const mcast = (next && next.mcast != null) ? +next.mcast : null;
			const bcast = (next && next.bcast != null) ? +next.bcast : null;

			floodMcastNow.textContent = (mcast == null) ? '-' : (fmt_mask_hex(mcast) + ' (' + mcast + ')');
			floodBcastNow.textContent = (bcast == null) ? '-' : (fmt_mask_hex(bcast) + ' (' + bcast + ')');
			metricFlood.set('M ' + floodMcastNow.textContent + ' / B ' + floodBcastNow.textContent);
		};

		const applyStatusState = function(st) {
			const ports = st.ports || [];
			const byPort = status_map_by_port(ports, numPorts);
			const globalEnabled = +st.global_enabled ? 1 : 0;
			let enabledCount = 0;
			let activeRates = [];

			for (let i = 0; i < ports.length; i++) {
				if (ports[i] && +ports[i].port < numPorts && +ports[i].en) {
					enabledCount++;
					activeRates.push(Math.round(+ports[i].rate_kbps || 0));
				}
			}

			const peakRate = activeRates.length ? Math.max.apply(null, activeRates) : 0;
			const avgRate = activeRates.length ? Math.round(activeRates.reduce(function(a, b) { return a + b; }, 0) / activeRates.length) : 0;

			metricPorts.set(String(enabledCount), _('of ') + numPorts);
			metricPeak.set(fmt_rate_short(peakRate), peakRate + ' kbps');
			metricAvg.set(fmt_rate_short(avgRate), avgRate + ' kbps');
			metricBackend.set(helper_path_node(info.helper || '/usr/sbin/cr881x-yt921x-qos'));
			globalEnable.checked = !!globalEnabled;

			const soft = st.soft || {};
			const softEnabled = +soft.en ? 1 : 0;
			const softIfname = soft.ifname || 'br-guest';
			const softRate = (soft.rate_kbps != null) ? Math.max(RATE_KBPS_MIN, Math.round(+soft.rate_kbps || 0)) : 50000;
			const softBurst = (soft.burst_bytes != null) ? Math.max(BURST_BYTES_MIN, Math.round(+soft.burst_bytes || 0)) : DEFAULT_BURST_BYTES;

			softEnable.checked = !!softEnabled;
			softIface.value = softIfname;
			softRateInput.value = String(softRate);
			softBurstInput.value = String(softBurst);
			softStateNow.textContent = (softEnabled ? _('Enabled') : _('Disabled')) + ' @ ' + softIfname;

			portsWrap.innerHTML = '';
			for (let port = 0; port < numPorts; port++)
				portsWrap.appendChild(port_card(port, byPort[port] || {}, applyPort));

			updatedNode.textContent = _('Last refresh: ') + new Date().toLocaleTimeString();
		};

		const refreshState = function() {
			const req = [ L.resolveDefault(callStatus(), {}) ];
			if (floodSupported)
				req.push(L.resolveDefault(callGetFloodFilter(), {}));

			return Promise.all(req).then(function(next) {
				const nextStatus = next[0] || {};
				const nextFlood = floodSupported ? (next[1] || {}) : {};

				if (!nextStatus || !nextStatus.ok) {
					ui.addNotification(null,
						E('p', {}, [ (nextStatus && (nextStatus.error || nextStatus.output)) || _('Failed to refresh QoS status.') ]),
						'error');
				}

				if (floodSupported && (!nextFlood || !nextFlood.ok)) {
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

		const applyGlobal = function(enable) {
			return L.resolveDefault(callSetGlobal(enable), {}).then(function(res) {
				if (!res || !res.ok) {
					ui.addNotification(null,
						E('p', {}, [ (res && (res.error || res.output)) || _('Failed to apply global QoS setting.') ]),
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

		const applySoft = function(ifname, enable, rate, burst) {
			return L.resolveDefault(callSetSoft(ifname, enable, rate, burst), {}).then(function(res) {
				if (!res || !res.ok) {
					ui.addNotification(null,
						E('p', {}, [ (res && (res.error || res.output)) || _('Failed to apply Wi-Fi/Guest QoS settings.') ]),
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
			if (!floodSupported)
				return Promise.resolve();

			return L.resolveDefault(callSetFloodFilter(target, mask, force), {}).then(function(res) {
				if (!res || !res.ok) {
					ui.addNotification(null,
						E('p', {}, [ (res && (res.error || res.output)) || _('Failed to apply flood filter.') ]),
						'error');
				}

				return refreshState();
			});
		};

		const runBulk = function(entries) {
			let chain = Promise.resolve();

			for (let i = 0; i < entries.length; i++) {
				const e = entries[i];
				chain = chain.then(function() {
					return applyPort(e.port, e.enable, e.rate, e.burst);
				});
			}

			return chain.then(function() {
				return refreshState();
			});
		};

		const disableAllBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-negative crq-btn-block',
			title: _('Disable shaper on all ports')
		}, [ _('Disable all shapers') ]);

		disableAllBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			disableAllBtn.disabled = true;

			const entries = [];
			for (let p = 0; p < numPorts; p++)
				entries.push({ port: p, enable: 0, rate: 0, burst: DEFAULT_BURST_BYTES });

			runBulk(entries).finally(function() {
				disableAllBtn.disabled = false;
			});
		});

		const lan100Btn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-action crq-btn-block',
			title: _('Enable LAN1-3 shapers at 100 Mbps')
		}, [ _('LAN ports 100M') ]);

		lan100Btn.addEventListener('click', function(ev) {
			ev.preventDefault();
			lan100Btn.disabled = true;

			const entries = [];
			for (let p = 0; p < Math.min(3, numPorts); p++)
				entries.push({ port: p, enable: 1, rate: 100000, burst: DEFAULT_BURST_BYTES });

			runBulk(entries).finally(function() {
				lan100Btn.disabled = false;
			});
		});

		const wan300Btn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-action crq-btn-block',
			title: _('Enable WAN shaper at 300 Mbps')
		}, [ _('WAN 300M cap') ]);

		wan300Btn.addEventListener('click', function(ev) {
			ev.preventDefault();
			wan300Btn.disabled = true;
			runBulk([{
				port: Math.min(3, numPorts - 1),
				enable: 1,
				rate: 300000,
				burst: DEFAULT_BURST_BYTES
			}]).finally(function() {
				wan300Btn.disabled = false;
			});
		});

		const resetSafeBtn = E('button', {
			type: 'button',
			class: 'cbi-button cbi-button-neutral crq-btn-block',
			title: _('Enable global QoS, disable all shapers, and set safe flood mask')
		}, [ _('Reset safe defaults') ]);

		resetSafeBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			if (!window.confirm(_('Reset to safe defaults?')))
				return;

			resetSafeBtn.disabled = true;
			const entries = [];
			for (let p = 0; p < numPorts; p++)
				entries.push({ port: p, enable: 0, rate: 0, burst: DEFAULT_BURST_BYTES });

			let chain = Promise.resolve(applyGlobal(1)).then(function() {
				return runBulk(entries);
			});

			if (floodSupported) {
				chain = chain.then(function() {
					return applyFlood('both', fmt_mask_hex(FILTER_SAFE_DEFAULT), 0);
				});
			}

			chain.then(function() {
				return refreshState();
			}).finally(function() {
				resetSafeBtn.disabled = false;
			});
		});

		globalApplyBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			globalApplyBtn.disabled = true;
			Promise.resolve(applyGlobal(globalEnable.checked ? 1 : 0)).finally(function() {
				globalApplyBtn.disabled = false;
			});
		});

		refreshBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			refreshState();
		});

		softApplyBtn.addEventListener('click', function(ev) {
			ev.preventDefault();

			const ifname = String(softIface.value || '').trim();
			const enable = softEnable.checked ? 1 : 0;
			const rate = parse_uint_bounded(softRateInput.value, 50000, RATE_KBPS_MIN, RATE_KBPS_MAX, 7);
			const burst = parse_uint_bounded(softBurstInput.value, DEFAULT_BURST_BYTES, BURST_BYTES_MIN, BURST_BYTES_MAX, 7);

			if (!ifname) {
				ui.addNotification(null, E('p', {}, [ _('Target interface is required.') ]), 'error');
				return;
			}

			if (enable && rate == null) {
				ui.addNotification(null, E('p', {}, [ _('Rate must be numeric and in valid range.') ]), 'error');
				return;
			}

			if (enable && burst == null) {
				ui.addNotification(null, E('p', {}, [ _('Burst must be numeric and in valid range.') ]), 'error');
				return;
			}

			softApplyBtn.disabled = true;
			Promise.resolve(applySoft(ifname, enable, rate, burst)).finally(function() {
				softApplyBtn.disabled = false;
			});
		});

		floodMaskInput.addEventListener('blur', function() {
			const parsedMask = parse_mask_input(floodMaskInput.value);
			floodMaskInput.value = fmt_mask_hex(parsedMask == null ? FILTER_SAFE_DEFAULT : parsedMask);
		});

		floodApplyBtn.addEventListener('click', function(ev) {
			ev.preventDefault();
			if (!floodSupported)
				return;

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

		const subtitleText = persistentSupported
			? _('Per-port hardware shaping is stored in UCI and applied at boot.')
			: _('Per-port hardware shaping and flood-filter control. Settings are runtime-only.');

		const subtitleHint = persistentSupported
			? _('Use this page for direct control; reboot keeps configured shaper values.')
			: _('Use this page for quick tuning and diagnostics.');

		const floodAdvanced = floodSupported ? E('details', { style: 'margin-top:8px;' }, [
			E('summary', {
				style: 'cursor:pointer;font-weight:600;'
			}, [ _('Advanced flood filter') ]),
			E('div', { class: 'crq-inline', style: 'margin-top:8px;' }, [
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
		]) : null;

		const switchExtraPanelChildren = [
			E('h3', {}, [ _('Switch QoS Controls') ]),
			E('div', { class: 'crq-switch-master' }, [
				E('label', {}, [
					globalEnable,
					E('span', {}, [ _('Global QoS enable (persistent)') ])
				]),
				globalApplyBtn
			]),
				E('div', { class: 'crq-switch-actions' }, [
					disableAllBtn,
					lan100Btn,
					wan300Btn,
					resetSafeBtn
				]),
			E('div', { class: 'crq-help' }, [
				_('These shortcuts use the same hardware offload backend as per-port settings.'),
				' ',
				_('Global toggle controls boot-time apply behavior via UCI.')
			])
		];

		if (floodAdvanced)
			switchExtraPanelChildren.push(floodAdvanced);

		const switchExtraPanel = E('section', { class: 'crq-panel' }, switchExtraPanelChildren);

		const wifiDraftPanel = E('section', { class: 'crq-panel' }, [
			E('details', {}, [
				E('summary', {
					style: 'cursor:pointer;font-weight:700;'
				}, [ _('Wi-Fi / Guest QoS (Software TBF)') ]),
				E('div', { class: 'crq-help', style: 'margin-top:8px;' }, [
					_('Software shaping on selected Wi-Fi/guest interface.'),
					' ',
					_('Uses tc tbf and is independent from switch offload queues.')
				]),
				E('div', { class: 'crq-inline', style: 'margin-top:8px;' }, [
					E('span', {}, [ _('Current:'), ' ', softStateNow ])
				]),
				E('div', { class: 'crq-draft-grid' }, [
					E('div', { class: 'crq-field' }, [
						E('label', {}, [ _('Target interface') ]),
						softIface
					]),
					E('div', { class: 'crq-field' }, [
						E('label', {
							style: 'display:flex;align-items:center;gap:6px;cursor:pointer;'
						}, [
							softEnable,
							E('span', {}, [ _('Enable software shaper') ])
						])
					]),
					E('div', { class: 'crq-field' }, [
						E('label', {}, [ _('Rate (kbps)') ]),
						softRateInput
					]),
					E('div', { class: 'crq-field' }, [
						E('label', {}, [ _('Burst (bytes)') ]),
						softBurstInput
					])
				]),
				E('div', { class: 'crq-help' }, [
					_('Rate: ') + RATE_KBPS_MIN + '..' + RATE_KBPS_MAX + ' kbps',
					' | ',
					_('Burst: ') + BURST_BYTES_MIN + '..' + BURST_BYTES_MAX + ' bytes'
				]),
				E('div', { class: 'crq-actions' }, [
					softApplyBtn
				])
			])
		]);

		const mainClass = 'crq-main crq-main-noside';
		const mainChildren = [
			E('section', { class: 'crq-panel crq-ports' }, [
				E('h3', {}, [ _('Port Shapers') ]),
				portsWrap
			]),
			switchExtraPanel,
			wifiDraftPanel
		];

		return E('div', { class: 'cbi-map' }, [
			E('div', { class: 'crq-page' }, [
				E('section', { class: 'crq-panel crq-hero' }, [
					E('div', { class: 'crq-head' }, [
						E('div', {}, [
							E('h2', { class: 'crq-title' }, [ _('CR881x QoS Offload (YT921x)') ]),
							E('div', { class: 'crq-subtitle' }, [
								subtitleText,
								' ',
								subtitleHint
							]),
							updatedNode
						]),
						E('div', { class: 'cbi-page-actions' }, [ refreshBtn ])
					]),
					summaryWrap
				]),
				E('div', { class: mainClass }, mainChildren)
			])
		]);
	}
});
