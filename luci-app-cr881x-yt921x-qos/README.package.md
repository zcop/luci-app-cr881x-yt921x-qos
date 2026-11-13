# `luci-app-cr881x-yt921x-qos`

A compact QoS interface for CR881x + YT921x. Open **Traffic control → QoS**
with the Zcop theme, or **Network → QoS** in standard LuCI.

## Everyday controls

The main table shows the four physical sockets and their **saved** speed limits.
Choose **Edit**, select a preset or a custom speed in Mbps, then **Apply & save**.
A limit applies to traffic leaving that socket. It does not describe Internet
upload or download independently of the socket's configured role.

**Set several ports** applies one speed and burst setting to selected sockets,
while retaining each socket's multicast and broadcast forwarding flags.
Operations run in sequence. If one fails, the UI stops, reports partial
completion and requires a refresh before another attempt.

**Advanced** in each editor contains burst size and forwarding controls.
Broadcast restrictions can disrupt ARP and discovery; keep their defaults unless
you specifically need to restrict them. A forwarding-only edit uses the separate
backend method, preserving the existing limiter.

## Profile and software shaping

- **Profile & startup** controls the saved profile. Applying it immediately
  restores all saved port/software limits and forwarding settings, and enables
  startup restore. Stopping it removes current limiters and disables startup
  restore, keeping saved values. Saved forwarding settings are reapplied in
  either case. Direct port edits still apply immediately when startup restore
  is off.
- **Software interface limiter** optionally applies CPU software TBF to an
  existing Linux interface. Accelerated traffic may bypass it. Disable an active
  software limiter before choosing another interface.
- **Diagnostics** exposes helper output on request.

Settings persist in `/etc/config/cr881x_yt921x_qos`. The existing init script
restores them at boot. The app uses `tc`, `bridge` and UCI via rpcd; it does not
require debugfs or patch LuCI core. Driver support determines hardware offload.
The UI makes no claim that a configured rate is the achieved throughput or that
a saved setting proves the running qdisc state.

## UI behavior and validation

Version 1.1 replaces the old card layout and removes the empirical throughput
formula, duplicate meters, and per-port calibration controls from the UI.
The command-line backend and its legacy calibration commands are unchanged.

There is no background polling, daemon, traffic probe or persistent history.
Refresh is manual. Failed reads retain the last snapshot with a stale warning;
missing ports are Unknown. Read-only users cannot edit. Before a write, the UI
reads the relevant settings again and rejects changes to a different baseline.

Rates accept 0.001–2500 Mbps with at most three decimal places. Burst size accepts
64–1048512 whole bytes. The UI uses the existing RPC signatures without changing
backend or driver policy.

Synthetic tests exercise rate conversion, exact payloads, cancel, preservation
of forwarding flags, forwarding-only updates, external changes, partial bulk
failure, profile semantics, software interface validation, read-only/stale
states, theme palettes and responsive containment. Positive apply tests use fake
RPCs; live preview tests only inspect settings and cancel editors.

```sh
node tests/model.cjs
PLAYWRIGHT_MODULE=/path/to/playwright \
ZCOP_THEME_ROOT=/path/to/luci-theme-zcop \
LUCI_BOOTSTRAP_CSS=/path/to/luci-theme-bootstrap/htdocs/luci-static/bootstrap/cascade.css \
node tests/browser.cjs
```

Run these from the feed repository root. Browser output is generated under
`test-results/` and should not be committed.

## Buildroot

Add the feed, run `./scripts/feeds update zcopapp` and
`./scripts/feeds install luci-app-cr881x-yt921x-qos`, then select the package.

The package includes an init script. A normal package upgrade can restart it
and reapply QoS. For a UI-only live upgrade, preserve configuration and use the
installed package manager's verified script-suppression option, then clear LuCI
caches manually. Compare configurations and qdisc settings before and after;
never assume an ordinary package upgrade is presentation-only.
