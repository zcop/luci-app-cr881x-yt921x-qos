include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-cr881x-yt921x-qos
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0
PKG_MAINTAINER:=zcop

LUCI_TITLE:=CR881x port speed limits and QoS controls
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode +ip-full

define Package/luci-app-cr881x-yt921x-qos/conffiles
/etc/config/cr881x_yt921x_qos
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
