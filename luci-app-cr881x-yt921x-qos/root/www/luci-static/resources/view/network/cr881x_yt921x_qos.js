/* SPDX-License-Identifier: GPL-2.0-only */
'use strict';
'require view';
'require rpc';
'require ui';
'require cr881x.qos as model';

const callInfo = rpc.declare({ object: 'luci.cr881x_yt921x_qos', method: 'get_info', expect: {}, reject: true });
const callStatus = rpc.declare({ object: 'luci.cr881x_yt921x_qos', method: 'status', expect: {}, reject: true });
const callPort = rpc.declare({ object: 'luci.cr881x_yt921x_qos', method: 'set_port',
	params: ['port', 'enable', 'rate_kbps', 'burst_bytes', 'mcast_flood', 'bcast_flood'], expect: {}, reject: true });
const callFlood = rpc.declare({ object: 'luci.cr881x_yt921x_qos', method: 'set_port_flood',
	params: ['port', 'mcast_flood', 'bcast_flood'], expect: {}, reject: true });
const callGlobal = rpc.declare({ object: 'luci.cr881x_yt921x_qos', method: 'set_global', params: ['enable'], expect: {}, reject: true });
const callSoft = rpc.declare({ object: 'luci.cr881x_yt921x_qos', method: 'set_soft',
	params: ['ifname', 'enable', 'rate_kbps', 'burst_bytes'], expect: {}, reject: true });
const presets = ['25', '50', '100', '300', '1000'];

function button(label, action, primary) {
	return E('button', { 'class': 'cbi-button ' + (primary ? 'cbi-button-action' : ''), type: 'button', click: action }, label);
}
function field(label, control, hint) {
	return E('label', { 'class': 'crq-field' }, [E('span', {}, label), E('span', {}, [control,
		hint ? E('small', {}, hint) : null])]);
}
function details(title, summary, content) {
	return E('details', { 'class': 'crq-section' }, [E('summary', {}, [E('strong', {}, title),
		E('span', { 'class': 'crq-summary' }, summary)]), E('div', { 'class': 'crq-section-body' }, content)]);
}
function input(value, attrs) { return E('input', Object.assign({ type: 'text', value: value }, attrs || {})); }
function failure(result) {
	if (!result || result.ok !== true) throw new Error(result && (result.error || result.output) || _('The operation failed.'));
}

return view.extend({
	load: function() {
		return Promise.allSettled([callInfo(), callStatus()]);
	},
	render: function(data) {
		if (!document.getElementById('crq-style')) document.head.appendChild(E('link', {
			id: 'crq-style', rel: 'stylesheet', href: L.resource('cr881x/qos.css') }));
		this.info = data[0].status === 'fulfilled' ? data[0].value : {};
		this.writable = L.hasViewPermission() === true;
		this.infoFailed = !this.info.features;
		this.features = this.info.features || {};
		try { this.state = model.status(data[1].status === 'fulfilled' ? data[1].value : null); this.updated = new Date(); }
		catch (error) { this.failed = error.message; }
		this.notice = E('div', { 'class': 'crq-notice', role: 'status', hidden: '' });
		this.body = E('div');
		this.root = E('div', { 'class': 'crq-page' }, [this.notice, this.body]);
		this.update();
		return this.root;
	},
	update: function() {
		const opened = Array.from(this.body.querySelectorAll('details[open]')).map(d => d.querySelector('summary strong').textContent);
		const state = this.state, available = state && !this.failed && !this.infoFailed;
		this.notice.hidden = !this.message && !this.failed && !this.infoFailed;
		this.notice.textContent = this.failed ? _('Could not refresh. Last-read settings may be stale. ') + this.failed : this.infoFailed ? _('Controls are unavailable. Refresh to try again.') : this.message || '';
		const refresh = button(_('Refresh status'), () => this.refresh());
		refresh.disabled = !!this.busy;
		const bulk = button(_('Set several ports'), () => this.editPorts([0, 1, 2, 3], true));
		bulk.disabled = !available || !!this.busy || !this.features.port_tbf || !state.ports.some(p => p && model.flags(p));
		const rows = [0, 1, 2, 3].map(port => {
			const row = state && state.ports[port];
			const edit = button(_('Edit'), () => this.editPorts([port], false));
			edit.setAttribute('aria-label', _('Edit ') + model.label(port));
			edit.disabled = !available || !row || !model.flags(row) || !!this.busy || !this.features.port_tbf;
			return E('tr', {}, [E('th', { scope: 'row' }, [E('span', { 'class': 'crq-socket', 'aria-hidden': 'true' }),
				E('span', {}, [model.label(port), E('small', {}, ['lan1', 'lan2', 'lan3', 'wan'][port])])]),
				E('td', { 'class': row && row.en ? 'crq-rate crq-limited' : 'crq-rate' }, model.speed(row)),
				E('td', { 'class': 'crq-forward' }, !row || !model.flags(row) ? _('Unknown') :
					row.mcast_flood && row.bcast_flood ? _('Default forwarding') :
					[row.mcast_flood ? null : _('Multicast restricted'), row.bcast_flood ? null : _('Broadcast restricted')].filter(Boolean).join(' · ')),
				this.writable ? E('td', { 'class': 'crq-row-action' }, edit) : null]);
		});
		const profile = state && state.global != null ? state.global ? _('Restore at startup: on') : _('Restore at startup: off') : _('Startup state unknown');
		const globalButton = button(state && state.global ? _('Stop saved profile') : _('Apply saved profile'), () => this.editGlobal());
		globalButton.disabled = !available || state.global == null || state.ports.some(p => !p || !model.flags(p)) || !state.soft || !!this.busy;
		const soft = state && state.soft;
		const softButton = button(_('Edit software limit'), () => this.editSoft());
		softButton.disabled = !available || !soft || !!this.busy;
		this.body.replaceChildren(
			E('div', { 'class': 'crq-heading' }, [E('div', {}, [E('h2', {}, _('Port speed limits')),
				E('p', {}, _('Limit traffic leaving each socket.'))]), E('div', { 'class': 'crq-actions' }, refresh)]),
			E('div', { 'class': 'crq-table-wrap' }, E('table', { 'class': 'crq-table' }, [
				E('thead', {}, E('tr', {}, [E('th', {}, _('Socket')), E('th', {}, _('Saved limit')),
					E('th', {}, _('Forwarding')), this.writable ? E('th', {}, E('span', { 'class': 'crq-sr' }, _('Actions'))) : null])), E('tbody', {}, rows)])),
			E('div', { 'class': 'crq-table-footer' }, [E('span', {}, _('Saved limits are settings, not measured traffic speeds.')),
				this.writable ? bulk : E('span', {}, _('Read-only access'))]),
			state && state.global === 0 ? E('p', { 'class': 'crq-hint' }, _('Direct edits apply now. Startup restore is off.')) : E('span'),
			this.features.persistent ? details(_('Profile & startup'), profile, [
				E('p', {}, _('Applying the profile restores all saved port and software limits, including forwarding settings. Stopping it removes the running limits and turns startup restore off. Your saved settings are kept.')),
				this.writable ? E('div', { 'class': 'crq-actions' }, globalButton) : null]) : E('span'),
			this.features.soft_tbf ? details(_('Software interface limiter'), soft ? (soft.en ? soft.ifname + ' · ' + model.speed(soft) : _('No limit saved')) : _('Unknown'), [
				E('p', {}, _('An optional CPU-based egress limit on an existing Linux interface. Accelerated traffic may bypass it.')),
				this.writable ? E('div', { 'class': 'crq-actions' }, softButton) : null]) : E('span'),
			details(_('Diagnostics'), _('Helper output'), E('pre', { 'class': 'crq-output' }, state && state.output || _('No response available.'))),
			E('div', { 'class': 'crq-footnote' }, [this.updated ? _('Last read: ') + this.updated.toLocaleTimeString() : _('Not yet read'),
				' · ', _('Refresh on demand')])
		);
		this.body.querySelectorAll('details').forEach(d => { d.open = opened.includes(d.querySelector('summary strong').textContent); });
	},
	refresh: async function() {
		if (this.busy) return;
		this.busy = true; this.update();
		try {
			const data = await Promise.allSettled([callInfo(), callStatus()]);
			this.info = data[0].status === 'fulfilled' ? data[0].value : {};
			this.features = this.info.features || {}; this.infoFailed = !this.info.features;
			this.state = model.status(data[1].status === 'fulfilled' ? data[1].value : null);
			this.failed = null; this.updated = new Date();
		}
		catch (error) { this.failed = error.message; }
		finally { this.busy = false; this.update(); }
	},
	/* Refresh immediately before a write; never overwrite a different saved configuration. */
	fresh: async function(ports, soft, global) {
		const next = model.status(await callStatus());
		if ((ports || []).some(port => model.key(next.ports[port]) !== model.key(this.state.ports[port])) ||
			soft && model.key(next.soft) !== model.key(this.state.soft) || global && JSON.stringify(next) !== JSON.stringify(this.state))
			throw new Error(_('Settings changed since this page was read. Cancel, refresh and review your changes.'));
		return next;
	},
	limitFields: function(seed) {
		const select = E('select', { 'aria-label': _('Speed limit') }, [E('option', { value: 'off' }, _('No limit')),
			...presets.map(value => E('option', { value: value }, value + ' Mbps')), E('option', { value: 'custom' }, _('Custom'))]);
		select.value = seed.enable ? (presets.includes(seed.rate) ? seed.rate : 'custom') : 'off';
		const custom = input(seed.rate, { inputmode: 'decimal', 'aria-label': _('Custom speed (Mbps)') });
		const customField = field(_('Custom speed (Mbps)'), custom);
		select.addEventListener('change', () => customField.hidden = select.value !== 'custom');
		customField.hidden = select.value !== 'custom';
		const burst = input(seed.burst, { inputmode: 'numeric', 'aria-label': _('Burst size (bytes)') });
		return { nodes: [field(_('Speed limit'), select), customField], burst: burst,
			read: () => ({ enable: select.value !== 'off', rate: select.value === 'custom' ? custom.value : select.value, burst: burst.value }) };
	},
	modal: function(title, nodes, apply) {
		const error = E('p', { 'class': 'crq-error', role: 'alert', hidden: '' });
		const cancel = button(_('Cancel'), () => ui.hideModal());
		const save = button(_('Apply & save'), async () => {
			if (this.busy || !this.writable) return;
			this.busy = true; cancel.disabled = save.disabled = true; error.hidden = true;
			try { await apply(); ui.hideModal(); }
			catch (e) { error.textContent = e.message; error.hidden = false; }
			finally { this.busy = false; cancel.disabled = false; save.disabled = !!this.failed; this.update(); }
		}, true);
		ui.showModal(title, E('div', { 'class': 'crq-editor' }, [...(Array.isArray(nodes) ? nodes : [nodes]), error, E('div', { 'class': 'crq-actions crq-modal-actions' }, [cancel, save])]));
	},
	accept: function(result) {
		failure(result);
		this.state = model.status(result.status); this.updated = new Date();
	},
	editPorts: function(ports, bulk) {
		if (!this.writable || this.busy || this.failed || !this.state) return;
		ports = ports.filter(port => this.state.ports[port] && model.flags(this.state.ports[port]));
		if (!ports.length) return;
		const original = this.state, seed = model.seed(original.ports[ports[0]]);
		if (bulk) { seed.enable = true; seed.rate = '100'; }
		const fields = this.limitFields(seed), chosen = [];
		const content = [E('p', { 'class': 'crq-hint' }, bulk ? _('Choose the sockets that should share this speed limit. Forwarding settings are kept for each port.') : _('Applies to traffic leaving this socket, toward its connected device.'))];
		if (bulk) content.push(E('div', { 'class': 'crq-port-pick' }, ports.map(port => {
			const check = E('input', { type: 'checkbox', checked: '', 'aria-label': model.label(port) });
			chosen.push({ port: port, check: check });
			return E('label', {}, [check, model.label(port)]);
		})));
		content.push(...fields.nodes);
		const mcast = E('input', { type: 'checkbox', 'aria-label': _('Allow unknown multicast') }); mcast.checked = seed.mcast;
		const bcast = E('input', { type: 'checkbox', 'aria-label': _('Allow broadcast') }); bcast.checked = seed.bcast;
		const advanced = [field(_('Burst size (bytes)'), fields.burst, _('Leave the default 65536 unless you need different burst handling.'))];
		if (!bulk && this.features.port_flood_flags) advanced.push(field(_('Allow unknown multicast'), mcast), field(_('Allow broadcast'), bcast),
			E('p', { 'class': 'crq-hint' }, _('Restricting forwarding can disrupt discovery and address resolution.')));
		content.push(details(_('Advanced'), _('Burst size') + (!bulk && this.features.port_flood_flags ? ' · ' + _('Forwarding') : ''), advanced));
		if (original.global === 0) content.push(E('p', { 'class': 'crq-hint' }, _('Applies now; startup restore is off.')));
		this.modal(bulk ? _('Set several ports') : model.label(ports[0]), content, async () => {
			const selected = bulk ? chosen.filter(x => x.check.checked).map(x => x.port) : ports;
			if (!selected.length) throw new Error(_('Choose at least one socket.'));
			const draft = fields.read();
			const payloads = selected.map(port => model.portPayload(original.ports[port], Object.assign({}, draft, {
				mcast: bulk ? original.ports[port].mcast_flood === 1 : mcast.checked,
				bcast: bulk ? original.ports[port].bcast_flood === 1 : bcast.checked })));
			await this.fresh(selected);
			let completed = 0;
			try {
				for (const payload of payloads) {
					const before = original.ports[payload[0]];
					const sameLimit = before.en === payload[1] && (!before.en || before.rate_kbps === payload[2] && before.burst_bytes === payload[3]);
					const sameFlood = before.mcast_flood === payload[4] && before.bcast_flood === payload[5];
					if (!sameLimit) this.accept(await callPort.apply(null, payload));
					else if (!sameFlood) this.accept(await callFlood(payload[0], payload[4], payload[5]));
					completed++;
				}
				this.message = _('Port settings saved.');
			} catch (error) {
				this.failed = _('An operation may have partly applied. Refresh before trying again.');
				throw new Error(completed + '/' + selected.length + ' ' + _('ports completed. ') + error.message + ' ' + this.failed);
			}
		});
	},
	editGlobal: function() {
		if (!this.writable || this.busy || this.failed || !this.state || this.state.global == null) return;
		const enable = this.state.global ? 0 : 1;
		this.modal(enable ? _('Apply saved profile?') : _('Stop saved profile?'), [
			E('p', {}, enable ? _('This immediately reapplies all saved port and software limits and forwarding settings, and restores them at startup.') :
				_('This removes the running port and software limits and disables startup restore. Saved limits are kept. Saved forwarding settings are reapplied.'))
		], async () => {
			await this.fresh([0, 1, 2, 3], true, true);
			try { this.accept(await callGlobal(enable)); this.message = _('Profile updated.'); }
			catch (error) { this.failed = _('The profile may have partly applied. Refresh before trying again.'); throw error; }
		});
	},
	editSoft: function() {
		if (!this.writable || this.busy || this.failed || !this.state || !this.state.soft) return;
		const soft = this.state.soft, fields = this.limitFields(model.seed(soft));
		const name = input(soft.ifname, { 'aria-label': _('Existing interface'), maxlength: '15', placeholder: 'br-guest' });
		this.modal(_('Software interface limiter'), [
			E('p', { 'class': 'crq-hint' }, _('Uses CPU software shaping; accelerated traffic may bypass this limit.')),
			field(_('Existing interface'), name), ...fields.nodes,
			details(_('Advanced'), _('Burst size'), field(_('Burst size (bytes)'), fields.burst))
		], async () => {
			const payload = model.softPayload(Object.assign(fields.read(), { ifname: name.value }));
			if (soft.en && payload[0] !== soft.ifname) throw new Error(_('Disable the current software limit before choosing a different interface.'));
			await this.fresh([], true);
			try { this.accept(await callSoft.apply(null, payload)); this.message = _('Software limit saved.'); }
			catch (error) { this.failed = _('The software limit may have partly applied. Refresh before trying again.'); throw error; }
		});
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
