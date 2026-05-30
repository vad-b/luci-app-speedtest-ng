# This is free software, licensed under the GNU General Public License, version 3.
#
# Copyright (C) 2026 vad-b

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Speedtest NG for LuCI
LUCI_DEPENDS:=+speedtestcpp +ucode
LUCI_DESCRIPTION:=Run and track network speed tests from LuCI using speedtestcpp

PKG_MAINTAINER:=vad-b
PKG_VERSION:=1.0.0
PKG_LICENSE:=GPL-3.0-only

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
