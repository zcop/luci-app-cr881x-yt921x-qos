# luci-app-cr881x-yt921x-qos

Hardware QoS status and runtime control page for CR881x + YT921x.

## Features
- Reads YT921x TBF status from debugfs
- Applies runtime per-port TBF settings via debugfs
- Reads/writes YT921x flood egress drop masks (`0x180510`/`0x180514`) with `0x7ff` safety guard
- Exposes status and controls via rpcd/ubus (`luci.cr881x_yt921x_qos`)
- LuCI view under `Network` menu

## Buildroot usage
- Place this directory under an OpenWrt feed
- `./scripts/feeds update <feed>`
- `./scripts/feeds install luci-app-cr881x-yt921x-qos`
