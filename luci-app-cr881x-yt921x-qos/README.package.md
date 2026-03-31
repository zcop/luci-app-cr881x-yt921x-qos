# `luci-app-cr881x-yt921x-qos`

Hardware QoS status and control page for CR881x + YT921x.

## Features
- Uses a release-safe backend (`tc` + UCI), no debugfs dependency
- Applies per-port TBF on `lan1`, `lan2`, `lan3`, `wan`
- Persists QoS settings in `/etc/config/cr881x_yt921x_qos`
- Auto-applies saved QoS settings at boot via init script
- Global QoS master toggle (persistent) to enable/disable boot-time apply
- Input hardening across UI/rpcd/helper:
  - `rate_kbps`: `1..2500000`
  - `burst_bytes`: `64..1048512`
- Exposes status and controls via rpcd/ubus (`luci.cr881x_yt921x_qos`)
- LuCI view under `Network` menu
- Capability-aware UI:
  - Flood filter controls are hidden/disabled when backend does not support them

## Buildroot usage
- Place this directory under an OpenWrt feed
- `./scripts/feeds update <feed>`
- `./scripts/feeds install luci-app-cr881x-yt921x-qos`
