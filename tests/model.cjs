/* SPDX-License-Identifier: GPL-2.0-only */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');global._=s=>s;
const model=new Function('baseclass',fs.readFileSync(path.join(__dirname,'../luci-app-cr881x-yt921x-qos/root/www/luci-static/resources/cr881x/qos.js'),'utf8'))({extend:o=>o});
const row={port:0,en:1,rate_kbps:123456,burst_bytes:123456,mcast_flood:0,bcast_flood:1};
assert.deepEqual(model.portPayload(row,model.seed(row)),[0,1,123456,123456,0,1]);
assert.equal(model.rate('0.001'),1);assert.equal(model.rate('2500'),2500000);assert.equal(model.rate('1.001'),1001);
for(const rate of ['0','-1','1.0001','2e3','1,2','2500.001','','Infinity'])assert.throws(()=>model.rate(rate));
for(const burst of ['63','1048513','1e3','65536.5',''])assert.throws(()=>model.burst(burst));
assert.equal(model.burst('1048512'),1048512);assert.equal(model.burst('64'),64);
assert.deepEqual(model.softPayload({ifname:'br-guest',enable:false,rate:'bad',burst:'65536'}),['br-guest',0,50000,65536]);
for(const name of ['','x'.repeat(16),'br;true','foo/bar','`id`'])assert.throws(()=>model.softPayload({ifname:name,enable:true,rate:'50',burst:'65536'}));
assert.throws(()=>model.status({ok:false,ports:[]}));assert.throws(()=>model.portPayload({...row,mcast_flood:undefined},model.seed(row)));
const status=model.status({ok:true,ports:[row],global_enabled:1,soft:{ifname:'br-guest',en:0}});
assert.equal(status.ports[1],null);assert.equal(model.speed(status.ports[1]),'Unknown');assert.equal(model.speed({...row,en:0}),'No limit saved');
assert.equal(model.status({ok:true,ports:[row,row]}).ports[0],null);
assert.equal(model.status({ok:true,ports:[{...row,rate_kbps:-1}]}).ports[0],null);
assert.notEqual(model.key(row),model.key({...row,mcast_flood:1}));
console.log('PASS: precise Mbps conversion, backend ranges and payloads, preservation of forwarding flags, unknown/duplicate ports and software interface validation');
