#!/bin/sh
#
# This is free software, licensed under the GNU General Public License, version 3.
#
# Copyright (C) 2026 vad-b

set -eu

PKG_NAME="luci-app-speedtest-ng"
REPO="vad-b/luci-app-speedtest-ng"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

log() {
	echo "[install.sh] $*"
}

fail() {
	echo "[install.sh] ERROR: $*" >&2
	exit 1
}

command -v wget >/dev/null 2>&1 || fail "wget is required but not found"

if command -v apk >/dev/null 2>&1; then
	PKG_EXT="apk"
	PKG_MGR="apk"
elif command -v opkg >/dev/null 2>&1; then
	PKG_EXT="ipk"
	PKG_MGR="opkg"
else
	fail "no supported package manager found (apk/opkg)"
fi

TMP_JSON="/tmp/${PKG_NAME}-latest.json"

cleanup() {
	rm -f "${TMP_JSON}"
}

trap cleanup EXIT

log "Detected package manager: ${PKG_MGR} (expecting .${PKG_EXT})"
log "Fetching latest release metadata"
wget -qO "${TMP_JSON}" "${API_URL}" || fail "failed to fetch release metadata"

DOWNLOAD_URL="$(tr ',' '\n' < "${TMP_JSON}" \
	| sed -n 's/.*"browser_download_url":[[:space:]]*"\([^"]*\)".*/\1/p' \
	| grep -E "/${PKG_NAME}[^/]*\.${PKG_EXT}$" \
	| head -n 1 || true)"

[ -n "${DOWNLOAD_URL}" ] || fail "no .${PKG_EXT} asset found in latest release"

PKG_FILE="/tmp/$(basename "${DOWNLOAD_URL}")"

log "Downloading ${PKG_FILE}"
wget -qO "${PKG_FILE}" "${DOWNLOAD_URL}" || fail "failed to download package"

log "Installing ${PKG_FILE}"
if [ "${PKG_MGR}" = "apk" ]; then
	apk add --allow-untrusted --upgrade "${PKG_FILE}" || fail "apk install failed"
else
	opkg update || fail "opkg update failed"
	opkg install "${PKG_FILE}" || fail "opkg install failed"
fi

log "Done"
