# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2026 vad-b
# Based on https://github.com/animegasan/luci-app-speedtest

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for Speedtest (NG)
LUCI_DESCRIPTION:=Run and track network speed tests from LuCI using speedtestcpp
LUCI_DEPENDS:=+speedtestcpp +ucode
LUCI_PKGARCH:=all
LUCI_MAINTAINER:=vad-b

PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
PKG_LICENSE:=GPL-3.0-only

define Build/Prepare/luci-app-speedtest-ng
	$(SED) 's/@APP_VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/htdocs/luci-static/resources/view/speedtest-ng/speedtest.js
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
