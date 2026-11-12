/* This is free software, licensed under the GNU General Public License, version 3.
 *
 * Copyright (C) 2026 vad-b
 */

'use strict';
'require view';
'require fs';
'require form';
'require ui';
'require uci';

const APP_VERSION = '@APP_VERSION@';

var page = 1;
var sortKey = 'timestamp';
var sortDir = 'desc';
var suppressDetailReset = false;
var SVG_NS = 'http://www.w3.org/2000/svg';

var COLUMNS = [
	{key: 'seq',            naturalDir: 'asc',  sortable: true, numeric: true},
	{key: 'timestamp',      naturalDir: 'desc', sortable: true},
	{key: 'trigger',        naturalDir: 'asc',  sortable: true},
	{key: 'test',           naturalDir: 'asc',  sortable: true},
	{key: 'server',         naturalDir: 'asc',  sortable: true},
	{key: 'ping_ms',        naturalDir: 'asc',  sortable: true, numeric: true},
	{key: 'jitter_ms',      naturalDir: 'asc',  sortable: true, numeric: true},
	{key: 'latency_ms',     naturalDir: 'asc',  sortable: true, numeric: true},
	{key: 'download_mbit',  naturalDir: 'desc', sortable: true, numeric: true},
	{key: 'upload_mbit',    naturalDir: 'desc', sortable: true, numeric: true},
	{key: 'note',           naturalDir: 'asc',  sortable: true},
	{key: null,             sortable: false}
];

function svgEl(tag, attrs, children) {
	var el = document.createElementNS(SVG_NS, tag);
	var keys = Object.keys(attrs || {});

	for (var i = 0; i < keys.length; i++) {
		el.setAttribute(keys[i], attrs[keys[i]]);
	}

	(children || []).forEach(function(child) {
		el.appendChild(child);
	});

	return el;
}

function startIcon() {
	return svgEl('svg', {
		'xmlns': SVG_NS,
		'width': '16',
		'height': '16',
		'viewBox': '0 0 24 24',
		'fill': 'none',
		'stroke': 'currentColor',
		'stroke-width': '2',
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'style': 'vertical-align: -0.15em; margin-right: 5px;'
	}, [
		svgEl('circle', {'cx': '12', 'cy': '12', 'r': '10'}),
		svgEl('path', {'d': 'M10 8l6 4-6 4z'})
	]);
}

function trashIcon() {
	return svgEl('svg', {
		'xmlns': SVG_NS,
		'viewBox': '0 0 24 24',
		'width': '16',
		'height': '16',
		'aria-hidden': 'true',
		'focusable': 'false',
		'style': 'vertical-align: -0.15em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;'
	}, [
		svgEl('path', {'d': 'M3 6h18'}),
		svgEl('path', {'d': 'M8 6V4h8v2'}),
		svgEl('path', {'d': 'M6 6l1 15h10l1-15'}),
		svgEl('path', {'d': 'M10 11v6'}),
		svgEl('path', {'d': 'M14 11v6'})
	]);
}

function viewIcon() {
	return svgEl('svg', {
		'xmlns': SVG_NS,
		'viewBox': '0 0 24 24',
		'width': '16',
		'height': '16',
		'aria-hidden': 'true',
		'focusable': 'false',
		'style': 'vertical-align: -0.15em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;'
	}, [
		svgEl('circle', {'cx': '11', 'cy': '11', 'r': '7'}),
		svgEl('path', {'d': 'M21 21l-4.3-4.3'})
	]);
}

function isNewerAppVersion(candidate, current) {
	const pattern = /^v?(\d+)\.(\d+)\.(\d+)$/;
	const candidateParts = pattern.exec(candidate);
	const currentParts = pattern.exec(current);
	if (!candidateParts || !currentParts)
		return false;

	for (let i = 1; i <= 3; i++) {
		const next = Number(candidateParts[i]);
		const previous = Number(currentParts[i]);
		if (next !== previous)
			return next > previous;
	}
	return false;
}

async function getAvailableAppUpdate() {
	const controller = new AbortController();
	const timeout = setTimeout(function() { controller.abort(); }, 10000);
	try {
		const response = await fetch('https://api.github.com/repos/vad-b/luci-app-speedtest-ng/releases/latest', {
			'credentials': 'omit',
			'referrerPolicy': 'no-referrer',
			'signal': controller.signal
		});
		if (!response.ok)
			throw new Error('GitHub HTTP ' + response.status);
		const release = await response.json();
		if (release.draft || release.prerelease || !isNewerAppVersion(release.tag_name, APP_VERSION))
			return null;
		return {
			version: release.tag_name.replace(/^v/, ''),
			url: 'https://github.com/vad-b/luci-app-speedtest-ng/releases/tag/' + encodeURIComponent(release.tag_name)
		};
	} finally {
		clearTimeout(timeout);
	}
}

function createIcon(children) {
	return svgEl('svg', {
		xmlns: SVG_NS,
		width: '16',
		height: '16',
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': '2',
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round'
	}, children);
}

function showAppUpdate(update) {
	const installCommand = 'wget -qO- https://raw.githubusercontent.com/vad-b/luci-app-speedtest-ng/main/install.sh | sh';
	const commandBlock = E('pre', {
		'style': 'white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box;margin:0;padding:12px 48px 12px 12px'
	}, [installCommand]);
	const copyIcon = createIcon([
		svgEl('rect', { 'x': '9', 'y': '9', 'width': '13', 'height': '13', 'rx': '2' }),
		svgEl('path', { 'd': 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })
	]);
	copyIcon.setAttribute('aria-hidden', 'true');
	const copyButton = E('button', {
		'type': 'button',
		'class': 'btn',
		'title': _('Copy command'),
		'aria-label': _('Copy command'),
		'style': 'position:absolute;top:6px;right:6px;width:28px;height:28px;padding:4px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center',
		'click': async function(ev) {
			const button = ev.currentTarget;
			let copied = false;
			try {
				await navigator.clipboard.writeText(installCommand);
				copied = true;
			} catch (e) {}
			if (!copied) {
				const selection = window.getSelection();
				const range = document.createRange();
				range.selectNodeContents(commandBlock);
				selection.removeAllRanges();
				selection.addRange(range);
				try {
					copied = document.execCommand('copy');
				} catch (e) {}
			}
			button.textContent = copied ? '✓' : '!';
			button.setAttribute('title', copied ? _('Copied') : _('Copy manually'));
			button.setAttribute('aria-label', copied ? _('Copied') : _('Copy manually'));
		}
	}, [copyIcon]);
	const modal = ui.showModal(_('Update available'), [
		E('p', {}, [_('Current version'), ': ', E('strong', {}, ['v' + APP_VERSION])]),
		E('p', {}, [
			_('New version'), ': ', E('strong', {}, ['v' + update.version]), ' · ',
			E('a', {
				'href': update.url,
				'target': '_blank',
				'rel': 'noopener'
			}, [_('Release notes'), ' ↗'])
		]),
		E('p', {}, [_('To update, run this command as root in an SSH session on your router:')]),
		E('div', { 'style': 'position:relative;margin-bottom:1em' }, [commandBlock, copyButton]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'type': 'button',
				'class': 'btn',
				'click': ui.hideModal
			}, _('Close'))
		])
	]);
	modal.style.maxWidth = '560px';
}

function formatMetric(value, suffix) {
	return (value !== undefined && value !== null) ? value + suffix : '-';
}

function formatTimestamp(record, timeFormat) {
	if (record.timestamp) {
		var date = record.timestamp.slice(0, 10);
		var hour = parseInt(record.timestamp.slice(11, 13), 10);
		var minute = record.timestamp.slice(14, 16);

		if (timeFormat === '12h' && !isNaN(hour)) {
			var suffix = hour >= 12 ? 'PM' : 'AM';
			var hour12 = hour % 12 || 12;
			return date + ' ' + hour12 + ':' + minute + ' ' + suffix;
		}

		return date + ' ' + record.timestamp.slice(11, 16);
	}

	if (record.legacy_date || record.legacy_time) {
		return [record.legacy_date, record.legacy_time].filter(function(value) {
			return value;
		}).join(' ');
	}

	return '-';
}

function serverLabel(server) {
	if (!server) {
		return '-';
	}

	return server.sponsor || server.name || server.host || '-';
}

function serverTitle(server) {
	if (!server) {
		return '';
	}

	var label = serverLabel(server);
	if (server.host && label.indexOf(server.host) === -1) {
		label += ' (' + server.host + ')';
	}
	return label;
}

function serverDetailLabel(server) {
	if (!server) {
		return '-';
	}

	var label = server.sponsor || server.name || server.host || '-';
	if (server.id !== null && server.id !== undefined && server.id !== '') {
		label += ' (' + server.id + ')';
	}

	return label;
}

function triggerLabel(trigger) {
	if (trigger === 'manual') {
		return _('Manual');
	}
	if (trigger === 'scheduled') {
		return _('Scheduled');
	}
	return '-';
}

function testLabel(test) {
	if (test === 'all') {
		return _('All');
	}
	if (test === 'latency') {
		return _('Latency');
	}
	if (test === 'download') {
		return _('Download');
	}
	if (test === 'upload') {
		return _('Upload');
	}
	return test || '-';
}

function columnLabel(key) {
	switch (key) {
		case 'seq':           return '#';
		case 'timestamp':     return _('Timestamp');
		case 'trigger':       return _('Run Type');
		case 'test':          return _('Test');
		case 'server':        return _('Server');
		case 'ping_ms':       return _('Ping');
		case 'jitter_ms':     return _('Jitter');
		case 'latency_ms':    return _('Latency');
		case 'download_mbit': return _('Download Speed');
		case 'upload_mbit':   return _('Upload Speed');
		case 'note':          return _('Note');
	}
	return '';
}

function execHelper(args) {
	return fs.exec('/usr/share/speedtest-ng/helper', args).then(function(res) {
		if (!res || res.code !== 0) {
			throw new Error((res && res.stderr) || _('Speedtest helper command failed.'));
		}
		return res.stdout || '';
	});
}

function readData() {
	return execHelper(['list']).then(function(stdout) {
		var records = JSON.parse(stdout || '[]');
		return Array.isArray(records) ? records : [];
	});
}

function deleteData(idToDelete) {
	return execHelper(['delete', idToDelete]);
}

function updateNote(idToUpdate, note) {
	return execHelper(['note', idToUpdate, note]);
}

function clearData() {
	return execHelper(['clear']);
}

function renderRestoreHistory(timeFormat) {
	var restoring = false;
	var fileInput = E('input', {
		'type': 'file',
		'accept': '.json,application/json',
		'style': 'display:none',
		'change': async function() {
			var file = fileInput.files[0];
			fileInput.value = '';
			if (!file || restoring) return;
			restoreButton.disabled = true;
			try {
				var content = await file.text();
				var records;
				try {
					records = JSON.parse(content);
				} catch (err) {
					throw new Error(_('The selected file is not valid JSON.'));
				}
				if (!Array.isArray(records) || records.some(function(record) {
					return !record || typeof record !== 'object' || Array.isArray(record) ||
						typeof record.id !== 'string' || !record.id.length;
				})) {
					throw new Error(_('Select a JSON file previously exported from Speedtest NG.'));
				}
				if (!records.length) {
					throw new Error(_('The selected file contains no test results.'));
				}

				var cancelButton = E('button', {
					'type': 'button', 'class': 'btn', 'click': ui.hideModal
				}, _('Cancel'));
				var confirmButton = E('button', {
					'type': 'button',
					'class': 'btn cbi-button cbi-button-apply',
					'click': async function() {
						if (restoring) return;
						restoring = true;
						confirmButton.disabled = true;
						cancelButton.disabled = true;
						restoreButton.disabled = true;
						confirmButton.textContent = _('Restoring...');
						var uploadPath = '/tmp/speedtest-ng-restore-' + Date.now().toString(36) +
							'-' + Math.random().toString(36).slice(2) + '.json';
						try {
							await fs.write(uploadPath, content, 0o600);
							var result = JSON.parse(await execHelper(['restore', uploadPath]));
							ui.hideModal();
							ui.addNotification(null, E('p', {},
								_('Added %s test results. Skipped %s existing results.').format(result.added, result.skipped)), 'info');
							try {
								page = 1;
								replaceHistory(result.records, timeFormat);
								var details = document.getElementById('speedtest-detail-content');
								if (details) {
									details.innerHTML = '';
									details.appendChild(detailPlaceholder());
								}
							} catch (err) {
								ui.addNotification(null, E('p', {},
									_('History was restored, but the view could not be refreshed. Reopen the Runs tab.')), 'warning');
							}
						} catch (err) {
							ui.addNotification(null, E('p', {},
								_('Unable to restore history: %s').format(err.message)), 'error');
						} finally {
							await fs.remove(uploadPath).catch(function() {});
							restoring = false;
							confirmButton.disabled = false;
							cancelButton.disabled = false;
							restoreButton.disabled = false;
							confirmButton.textContent = _('Restore');
						}
					}
				}, _('Restore'));
				ui.showModal(_('Restore history'), [
					E('p', {'style': 'overflow-wrap:anywhere'},
						_('Add test results from "%s" to your history?').format(file.name)),
					E('p', {}, _('Existing results and notes will be kept. Duplicate IDs will be skipped.')),
					E('div', {'class': 'right'}, [cancelButton, ' ', confirmButton])
				]);
			} catch (err) {
				ui.addNotification(null, E('p', {}, err.message), 'error');
			} finally {
				restoreButton.disabled = false;
			}
		}
	});
	var restoreButton = E('button', {
		'id': 'speedtest-restore',
		'type': 'button',
		'class': 'btn cbi-button cbi-button-action',
		'click': function() { fileInput.click(); }
	}, _('Restore'));
	return E('div', {'class': 'cbi-value'}, [
		E('label', {'class': 'cbi-value-title', 'for': 'speedtest-restore'}, _('Restore history')),
		E('div', {'class': 'cbi-value-field'}, [
			E('p', {'style': 'margin:0 0 .5em'},
				_('Upload a previously exported JSON file to add its results to your test history. Existing results will be kept, and duplicates will be skipped.')),
			fileInput,
			restoreButton
		])
	]);
}

function toRow(record, timeFormat) {
	return {
		id: record.id,
		seq: (record.seq !== undefined && record.seq !== null) ? record.seq : '',
		timestamp: formatTimestamp(record, timeFormat),
		timestampTitle: record.timestamp || '',
		trigger: triggerLabel(record.trigger),
		test: testLabel(record.test),
		server: serverLabel(record.server),
		serverTitle: serverTitle(record.server),
		ping: formatMetric(record.ping_ms, ' ms'),
		jitter: formatMetric(record.jitter_ms, ' ms'),
		latency: formatMetric(record.latency_ms, ' ms'),
		download: formatMetric(record.download_mbit, ' Mbit/s'),
		upload: formatMetric(record.upload_mbit, ' Mbit/s'),
		note: record.note || ''
	};
}

function showDetails(record, timeFormat) {
	function open(rec) {
		renderDetail(rec, timeFormat);
		// Mark this as a programmatic switch so the tab-activation handler does
		// not reset the pane back to the placeholder.
		suppressDetailReset = true;
		var tab = document.querySelector('li[data-tab="details"]');
		if (tab) {
			// LuCI's tab handler keys off the clicked anchor inside the <li>,
			// so click the inner <a> rather than the <li> itself.
			(tab.querySelector('a') || tab).click();
		}
	}

	// Re-read from disk so the details (and the editable note) reflect the
	// current stored state, even if it was edited from the Runs table.
	readData().then(function(fresh) {
		var match = fresh.filter(function(r) {
			return r.id === record.id;
		})[0];
		open(match || record);
	}).catch(function() {
		open(record);
	});
}

function sortRecords(data) {
	var col = COLUMNS.filter(function(c) {
		return c.key === sortKey;
	})[0];
	if (!col) {
		return data.slice();
	}

	var numeric = !!col.numeric;
	var isTimestamp = (sortKey === 'timestamp');
	var dirMult = (sortDir === 'desc') ? -1 : 1;

	function valueOf(record) {
		if (sortKey === 'server') {
			return serverLabel(record.server);
		}
		if (isTimestamp) {
			var parsed = record.timestamp ? Date.parse(record.timestamp) : NaN;
			return isNaN(parsed) ? null : parsed;
		}
		return record[sortKey];
	}

	function isMissing(value) {
		if (value === null || value === undefined) {
			return true;
		}
		if (typeof value === 'number') {
			return isNaN(value);
		}
		if (typeof value === 'string') {
			return value === '' || value === '-';
		}
		return false;
	}

	function tieBreak(a, b) {
		if (isTimestamp) {
			return 0;
		}
		var ta = a.timestamp ? Date.parse(a.timestamp) : 0;
		var tb = b.timestamp ? Date.parse(b.timestamp) : 0;
		if (isNaN(ta)) ta = 0;
		if (isNaN(tb)) tb = 0;
		return tb - ta;
	}

	return data.slice().sort(function(a, b) {
		var va = valueOf(a);
		var vb = valueOf(b);
		var aMissing = isMissing(va);
		var bMissing = isMissing(vb);

		if (aMissing && bMissing) {
			return tieBreak(a, b);
		}
		if (aMissing) {
			return 1;
		}
		if (bMissing) {
			return -1;
		}

		var primary;
		if (numeric || isTimestamp) {
			primary = va - vb;
		} else {
			primary = String(va).localeCompare(String(vb), undefined, {sensitivity: 'base'});
		}

		if (primary !== 0) {
			return primary * dirMult;
		}
		return tieBreak(a, b);
	});
}

function filterData(data, filter) {
	if (filter === 'manual' || filter === 'scheduled') {
		return data.filter(function(item) {
			return item.trigger === filter;
		});
	}
	return data;
}

function txtExport(data, timeFormat) {
	var lines = ['| # | timestamp | run type | test | server | ping | jitter | latency | download | upload | note |'];
	data.forEach(function(item) {
		var row = toRow(item, timeFormat);
		lines.push('| ' + [
			row.seq === '' ? '-' : row.seq,
			row.timestamp,
			row.trigger,
			row.test,
			row.server,
			row.ping,
			row.jitter,
			row.latency,
			row.download,
			row.upload,
			row.note || '-'
		].join(' | ') + ' |');
	});
	return lines.join('\n') + '\n';
}

function csvEscape(value) {
	if (value === null || value === undefined) {
		value = '';
	}

	value = String(value);
	if (/[",\r\n]/.test(value)) {
		return '"' + value.replace(/"/g, '""') + '"';
	}

	return value;
}

function csvExport(data) {
	var headers = [
		'seq',
		'timestamp',
		'run_type',
		'test',
		'server',
		'ping_ms',
		'jitter_ms',
		'latency_ms',
		'download_mbit',
		'upload_mbit',
		'note'
	];
	var lines = [headers.join(',')];

	data.forEach(function(item) {
		lines.push([
			item.seq,
			item.timestamp || '',
			item.trigger || '',
			item.test || '',
			serverLabel(item.server),
			item.ping_ms,
			item.jitter_ms,
			item.latency_ms,
			item.download_mbit,
			item.upload_mbit,
			item.note || ''
		].map(csvEscape).join(','));
	});

	return lines.join('\n') + '\n';
}

function jsonExport(data) {
	return JSON.stringify(data.map(function(record) {
		var copy = Object.assign({}, record);
		delete copy.seq;
		return copy;
	}), null, 2) + '\n';
}

function exportFilename(filter, format) {
	return 'speedtest_' + filter + '_results.' + format;
}

function exportDataFor(data, filter) {
	return sortRecords(filterData(data, filter));
}

function downloadText(filename, text) {
	var blob = new Blob([text], {type: 'text/plain'});
	var link = document.createElement('a');
	link.href = window.URL.createObjectURL(blob);
	link.download = filename;
	link.click();
	window.URL.revokeObjectURL(link.href);
}

function noteEditor(record) {
	var originalNote = record.note || '';
	var input, saveTimer = null, saving = false, pending = false;

	function saveNow() {
		var note = input.value;

		if (note === originalNote) {
			return Promise.resolve();
		}

		if (saving) {
			pending = true;
			return Promise.resolve();
		}

		saving = true;
		input.title = _('Saving note...');

		return updateNote(record.id, note).then(function() {
			originalNote = note;
			record.note = note;
			input.title = _('Note saved');
		}).catch(function(err) {
			input.title = _('Failed to save note');
			throw err;
		}).finally(function() {
			saving = false;
			if (pending) {
				pending = false;
				saveNow();
			}
		});
	}

	function scheduleSave() {
		if (saveTimer) {
			window.clearTimeout(saveTimer);
		}
		saveTimer = window.setTimeout(function() {
			saveTimer = null;
			saveNow();
		}, 600);
	}

	function flushSave() {
		if (saveTimer) {
			window.clearTimeout(saveTimer);
			saveTimer = null;
		}
		saveNow();
	}

	input = E('input', {
		'type': 'text',
		'class': 'cbi-input-text speedtest-ng-note',
		'value': originalNote,
		'placeholder': _('Optional note'),
		'title': _('Notes are saved automatically'),
		'style': 'box-sizing: border-box; width: 12em; max-width: 100%;',
		'input': scheduleSave,
		'change': flushSave,
		'blur': flushSave
	});

	return input;
}

function renderResultDetails() {
	return E('table', {'class': 'table cbi-section-table'}, [
		E('tr', {'class': 'tr table-titles'}, [
			E('th', {'class': 'th left', 'width': '50%'}, _('Category')),
			E('th', {'class': 'th'}, _('Result'))
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('#')),
			E('td', {'class': 'td', 'id': 'detail-seq'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-2'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Timestamp')),
			E('td', {'class': 'td', 'id': 'timestamp'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('IP Address')),
			E('td', {'class': 'td', 'id': 'client-ip'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-2'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Provider')),
			E('td', {'class': 'td', 'id': 'client-isp'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Server')),
			E('td', {'class': 'td', 'id': 'server-name'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-2'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Server Host')),
			E('td', {'class': 'td', 'id': 'server-host'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Server Location')),
			E('td', {'class': 'td', 'id': 'server-location'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-2'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Ping')),
			E('td', {'class': 'td', 'id': 'ping'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Jitter')),
			E('td', {'class': 'td', 'id': 'jitter'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-2'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Latency')),
			E('td', {'class': 'td', 'id': 'latency'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Download Speed')),
			E('td', {'class': 'td', 'id': 'download'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-2'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Upload Speed')),
			E('td', {'class': 'td', 'id': 'upload'}, '-')
		]),
		E('tr', {'class': 'tr cbi-rowstyle-1'}, [
			E('td', {'class': 'td left', 'width': '50%'}, _('Note')),
			E('td', {'class': 'td', 'id': 'detail-note'}, '-')
		])
	]);
}

function detailPlaceholder() {
	return E('div', {'class': 'cbi-value', 'style': 'text-align: center; display: block; padding: 1.5em 0;'}, [
		E('em', _('Run a test, or pick a run on the Runs tab, to see its details here.'))
	]);
}

// Render the detail table for a record into the details pane and populate it.
function renderDetail(record, timeFormat) {
	var container = document.getElementById('speedtest-detail-content');
	if (!container) {
		return;
	}
	container.innerHTML = '';
	container.appendChild(renderResultDetails());
	updateRunDetails(record, timeFormat);
}

// Reset the details pane to the empty placeholder.
function showDetailPlaceholder() {
	var container = document.getElementById('speedtest-detail-content');
	if (!container) {
		return;
	}
	container.innerHTML = '';
	container.appendChild(detailPlaceholder());
}

function updateRunDetails(record, timeFormat) {
	var server = record.server || {};
	var client = record.client || {};
	var values = {
		'detail-seq': (record.seq !== undefined && record.seq !== null) ? String(record.seq) : '-',
		'timestamp': formatTimestamp(record, timeFormat),
		'client-ip': client.ip || '-',
		'client-isp': (client.isp || '-') + ' [' + (client.lat || '-') + ', ' + (client.lon || '-') + ']',
		'server-name': serverDetailLabel(server),
		'server-location': (server.name || '-') + ' (' + (server.distance_km != null ? server.distance_km : '-') + ' km)',
		'server-host': server.host || '-',
		'ping': formatMetric(record.ping_ms, ' ms'),
		'jitter': formatMetric(record.jitter_ms, ' ms'),
		'latency': formatMetric(record.latency_ms, ' ms'),
		'download': formatMetric(record.download_mbit, ' Mbit/s'),
		'upload': formatMetric(record.upload_mbit, ' Mbit/s')
	};
	var keys = Object.keys(values);

	for (var i = 0; i < keys.length; i++) {
		var cell = document.getElementById(keys[i]);
		if (cell) {
			cell.textContent = values[keys[i]];
		}
	}

	var timestamp = document.getElementById('timestamp');
	if (timestamp) {
		timestamp.setAttribute('title', record.timestamp || '');
	}

	var serverName = document.getElementById('server-name');
	if (serverName) {
		serverName.setAttribute('title', serverTitle(server));
	}

	var noteCell = document.getElementById('detail-note');
	if (noteCell) {
		noteCell.innerHTML = '';
		noteCell.appendChild(record.id ? noteEditor(record) : document.createTextNode('-'));
	}
}

function renderTable(data, display, timeFormat) {
	var sortedData = sortRecords(data);
	var startIndex = (page - 1) * display;
	var endIndex = Math.min(startIndex + display, sortedData.length);
	var currentPageData = sortedData.slice(startIndex, endIndex);
	var dataRows = currentPageData.map(function(record, index) {
		var row = toRow(record, timeFormat);
		var rowClass = index % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';
		var rowButton = E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'title': _('Delete'),
			'aria-label': _('Delete'),
			'style': 'padding-left: 0.48em; padding-right: 0.48em;',
			'click': function() {
				ui.showModal(_('Delete data'), [
					E('p', _('Are you sure you want to delete this data?')),
					E('div', {'class': 'right'}, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Cancel')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'click': function() {
								deleteData(row.id).then(function() {
									return window.location.reload();
								}).catch(function(err) {
									ui.hideModal();
									throw err;
								});
							}
						}, _('Delete'))
					])
				]);
			}
		}, trashIcon());

		var viewButton = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'title': _('View details'),
			'aria-label': _('View details'),
			'style': 'padding-left: 0.48em; padding-right: 0.48em;',
			'click': function() {
				showDetails(record, timeFormat);
			}
		}, viewIcon());

		return E('tr', {'class': 'tr ' + rowClass, 'data-id': row.id}, [
			E('td', {'class': 'td'}, row.seq === '' ? '-' : String(row.seq)),
			E('td', {'class': 'td', 'title': row.timestampTitle}, row.timestamp),
			E('td', {'class': 'td'}, row.trigger),
			E('td', {'class': 'td'}, row.test),
			E('td', {
				'class': 'td',
				'title': row.serverTitle,
				'style': 'max-width: 16em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
			}, row.server),
			E('td', {'class': 'td'}, row.ping),
			E('td', {'class': 'td'}, row.jitter),
			E('td', {'class': 'td'}, row.latency),
			E('td', {'class': 'td'}, row.download),
			E('td', {'class': 'td'}, row.upload),
			E('td', {'class': 'td'}, noteEditor(record)),
			E('td', {'class': 'td'}, E('span', {'style': 'display: inline-flex; gap: .35em;'}, [viewButton, rowButton]))
		]);
	});
	var headerCells = COLUMNS.map(function(col) {
		var label = columnLabel(col.key);
		if (!col.sortable) {
			return E('th', {'class': 'th'}, label);
		}

		var isActive = (col.key === sortKey);
		var indicator = isActive ? (sortDir === 'desc' ? '\u2193' : '\u2191') : '\u2195';
		var ariaSort = isActive ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none';
		var headerStyle = 'cursor: pointer; user-select: none; white-space: nowrap;';
		var indicatorStyle = 'margin-left: .35em; font-weight: 700;';

		if (isActive) {
			headerStyle += ' background-color: rgba(0, 0, 0, .06); font-weight: 600; box-shadow: inset 0 -2px 0 currentColor;';
			indicatorStyle += ' font-size: 1.15em; font-weight: 900;';
		} else {
			indicatorStyle += ' opacity: .45;';
		}

		return E('th', {
			'class': 'th speedtest-sortable' + (isActive ? ' speedtest-sort-active' : ''),
			'style': headerStyle,
			'title': isActive ? _('Click to reverse sort order') : _('Click to sort by this column'),
			'aria-sort': ariaSort,
			'click': function() {
				if (sortKey === col.key) {
					sortDir = (sortDir === 'asc') ? 'desc' : 'asc';
				} else {
					sortKey = col.key;
					sortDir = col.naturalDir;
				}
				page = 1;
				updateTable(data, display, timeFormat);
			}
		}, [
			label,
			E('span', {'aria-hidden': 'true', 'style': indicatorStyle}, indicator)
		]);
	});

	return E('table', {'class': 'table cbi-section-table'}, [
		E('tr', {'class': 'tr table-titles'}, headerCells),
		E(dataRows)
	]);
}

function updateTable(data, display, timeFormat) {
	var container = document.getElementsByClassName('table-container');
	var prev = document.querySelector('.prev');
	var next = document.querySelector('.next');

	for (var i = 0; i < container.length; i++) {
		container[i].innerHTML = '';
		container[i].appendChild(renderTable(data, display, timeFormat));
	}

	if (!prev || !next) {
		return;
	}

	var total = data.length;
	var pages = Math.ceil(total / display);
	if (pages <= 1) {
		prev.disabled = true, next.disabled = true;
	} else if (page <= 1) {
		prev.disabled = true, next.disabled = false;
	} else if (page >= pages) {
		prev.disabled = false, next.disabled = true;
	} else {
		prev.disabled = false, next.disabled = false;
	}
	var start = total ? (page - 1) * display + 1 : 0;
	var end = Math.min(start + display - 1, total);
	var pageInfo = document.getElementById('page-info');
	if (pageInfo) {
		pageInfo.innerText = _('Displaying %s - %s of %s').format(start, end, total);
	}
}

function renderHistory(data, timeFormat) {
	var exportFilter = 'all';

	if (data.length === 0) {
		return [
			E('div', {'class': 'cbi-value', 'style': 'text-align: center; display: block;'}, [
				E('em', _('No data available.'))
			])
		];
	}

	return [
		E('div', {'class': 'controls', 'style': 'display: flex; flex-wrap: wrap; justify-content: space-around; padding: 0 0 1em 0;'}, [
			E('button', {
				'class': 'btn cbi-button-neutral prev',
				'style': 'flex-basis: 20%; text-align: center;',
				'disabled': true,
				'click': function() {
					page--, updateTable(data, 10, timeFormat);
				}
			}, '<<'),
			E('div', {
				'class': 'text',
				'id': 'page-info',
				'style': 'flex-grow: 1; align-self: center; text-align: center;'
			}, _('Displaying 1-%s of %s').format(Math.min(10, data.length), data.length)),
			E('button', {
				'class': 'btn cbi-button-neutral next',
				'style': 'flex-basis: 20%; text-align: center;',
				'disabled': 10 < data.length ? null : true,
				'click': function() {
					page++, updateTable(data, 10, timeFormat);
				}
			}, '>>')
		]),
		E('div', {'class': 'table-container', 'style': 'overflow-x: auto;'}, renderTable(data, 10, timeFormat)),
		E('div', {'class': 'cbi-page-actions'}, [
			E('div', {'style': 'display: inline-flex; align-items: center; gap: .35em; margin-right: 5px;'}, [
				E('label', {'for': 'speedtest-export-filter'}, _('Export')),
				E('select', {
					'id': 'speedtest-export-filter',
					'class': 'cbi-input-select',
					'change': function() {
						exportFilter = this.value;
					}
				}, [
					E('option', {'value': 'all'}, _('All')),
					E('option', {'value': 'manual'}, _('Manual')),
					E('option', {'value': 'scheduled'}, _('Scheduled'))
				]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function() {
						var exportData = exportDataFor(data, exportFilter);
						return downloadText(exportFilename(exportFilter, 'txt'), txtExport(exportData, timeFormat));
					}
				}, _('TXT')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function() {
						var exportData = exportDataFor(data, exportFilter);
						return downloadText(exportFilename(exportFilter, 'csv'), csvExport(exportData));
					}
				}, _('CSV')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function() {
						var exportData = exportDataFor(data, exportFilter);
						return downloadText(exportFilename(exportFilter, 'json'), jsonExport(exportData));
					}
				}, _('JSON'))
			]),
			E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': function() {
					ui.showModal(_('Clear data'), [
						E('p', _('Are you sure you want to clear all data?')),
						E('div', {'class': 'right'}, [
							E('button', {
								'class': 'btn',
								'click': ui.hideModal
							}, _('Cancel')),
							' ',
							E('button', {
								'class': 'btn cbi-button cbi-button-remove',
								'click': function() {
									return clearData().then(function() {
										return window.location.reload();
									});
								}
							}, _('Clear'))
						])
					]);
				}
			}, _('Clear'))
		])
	];
}

function replaceHistory(data, timeFormat) {
	var container = document.getElementById('speedtest-history-content');
	if (!container) {
		return;
	}

	container.innerHTML = '';
	renderHistory(data, timeFormat).forEach(function(node) {
		container.appendChild(node);
	});
	updateTable(data, 10, timeFormat);
}

function highlightHistoryRow(recordId) {
	if (!recordId) {
		return;
	}

	var rows = document.querySelectorAll('#speedtest-history-content tr[data-id]');
	var row = null;

	for (var i = 0; i < rows.length; i++) {
		if (rows[i].getAttribute('data-id') === recordId) {
			row = rows[i];
			break;
		}
	}

	if (!row) {
		return;
	}

	var cells = row.querySelectorAll('td');
	for (var j = 0; j < cells.length; j++) {
		cells[j].style.transition = 'background-color 1.2s ease-out';
		cells[j].style.backgroundColor = 'rgba(255, 235, 130, .75)';
	}

	window.setTimeout(function() {
		for (var j = 0; j < cells.length; j++) {
			cells[j].style.backgroundColor = '';
		}
	}, 2500);

	window.setTimeout(function() {
		for (var j = 0; j < cells.length; j++) {
			cells[j].style.transition = '';
		}
	}, 4000);
}

function highlightRunDetails() {
	var cells = document.querySelectorAll('#detail-seq, #timestamp, #client-ip, #client-isp, #server-name, #server-location, #server-host, #ping, #jitter, #latency, #download, #upload');
	if (!cells.length) {
		return;
	}

	for (var i = 0; i < cells.length; i++) {
		cells[i].style.transition = 'background-color 1.2s ease-out';
		cells[i].style.backgroundColor = 'rgba(255, 235, 130, .75)';
	}

	window.setTimeout(function() {
		for (var i = 0; i < cells.length; i++) {
			cells[i].style.backgroundColor = '';
		}
	}, 2500);

	window.setTimeout(function() {
		for (var i = 0; i < cells.length; i++) {
			cells[i].style.transition = '';
		}
	}, 4000);
}

function setStatus(state, message) {
	var status = document.getElementById('status');

	if (!status) {
		return;
	}

	status.textContent = '';
	status.className = '';
	status.removeAttribute('style');
	status.setAttribute('style', 'min-width: 9em;');

	if (!message) {
		status.textContent = _('Idle');
		return;
	}

	if (state === 'running') {
		status.className = 'spinning';
	} else if (state === 'error') {
		status.setAttribute('style', 'min-width: 9em; font-weight: bold; color: #c00;');
	}

	status.textContent = message;
}

function withTimeout(promise, timeoutMs) {
	var timer;
	var timeout = new Promise(function(resolve, reject) {
		timer = window.setTimeout(function() {
			reject(new Error(_('Speedtest timed out. Please check your connection and try again.')));
		}, timeoutMs);
	});

	return Promise.race([promise, timeout]).finally(function() {
		window.clearTimeout(timer);
	});
}

function bindUciOption(option, sectionName, optionName) {
	option.cfgvalue = function(section_id) {
		return uci.get('speedtest-ng', sectionName, optionName);
	};
	option.write = function(section_id, value) {
		uci.set('speedtest-ng', sectionName, optionName, value);
	};
	option.remove = function(section_id) {
		uci.unset('speedtest-ng', sectionName, optionName);
	};
}

function updatePageActionsVisibility(mapNode) {
	var actions = document.querySelector('#view > .cbi-page-actions');
	var activeSettingsTab = mapNode.querySelector('li.cbi-tab[data-tab="settings"]');

	if (actions) {
		actions.style.display = activeSettingsTab ? '' : 'none';
	}
}

function schedulePageActionsVisibilityUpdate(mapNode) {
	window.setTimeout(function() {
		updatePageActionsVisibility(mapNode);
	}, 0);
}

var RunControlsValue = form.DummyValue.extend({
	__name__: 'RunControlsValue',
	data: null,
	timeFormat: '24h',

	render: function(option_index, section_id, in_table) {
		var records = this.data || [];
		var timeFormat = this.timeFormat || '24h';
		var running = false;
		var testSelect, runButton, runButtonLabel;

		function setBusy(busy) {
			running = busy;
			runButton.disabled = busy;
			testSelect.disabled = busy;
		}

		testSelect = E('select', {
			'id': 'speedtest-test-mode',
			'class': 'cbi-input-select',
		}, [
			E('option', {'value': 'all'}, _('All')),
			E('option', {'value': 'latency'}, _('Latency')),
			E('option', {'value': 'download'}, _('Download')),
			E('option', {'value': 'upload'}, _('Upload'))
		]);

		runButtonLabel = E('span', {}, _('Run'));
		runButton = E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-action',
			'click': function() {
				var selectedTest = testSelect.value;

				if (running) {
					return;
				}

				setBusy(true);
				setStatus('running', _('Running...'));

				withTimeout(fs.exec_direct('/usr/share/speedtest-ng/helper', ['run', 'manual', selectedTest]), 180000).then(function(response) {
					var result = JSON.parse(response);
					var record = result.record || {};

					renderDetail(record, timeFormat);
					highlightRunDetails();
					setStatus(null, '');

					if (record.id) {
						return readData().then(function(fresh) {
							records = fresh;
							page = 1;
							replaceHistory(records, timeFormat);
							highlightHistoryRow(record.id);
						});
					}
				}).catch(function(err) {
					if (!err.response) {
						setStatus('error', err.message || _('No response received from speedtest. Please check your internet connection or try again later.'));
					} else if (err.response.data && err.response.data.error === 'unable to retrieve your ip info') {
						setStatus('error', _('Unable to retrieve IP information. Please check your internet connection.'));
					} else {
						setStatus('error', err);
					}
				}).finally(function() {
					setBusy(false);
				});
			}
		}, [
			startIcon(),
			runButtonLabel
		]);

		return E('div', {'class': 'speedtest-run-controls'}, [
			E('div', {'class': 'cbi-value'}, [
				E('label', {'class': 'cbi-value-title', 'for': 'speedtest-test-mode'}, _('Tests')),
				E('div', {'class': 'cbi-value-field'}, [
					E('span', {'style': 'display: inline-flex; align-items: center; gap: .5em; flex-wrap: wrap;'}, [
						testSelect,
						runButton
					])
				])
			]),
			E('div', {'class': 'cbi-value'}, [
				E('label', {'class': 'cbi-value-title'}, _('Status')),
				E('div', {'class': 'cbi-value-field'}, [
					E('em', {'id': 'status', 'style': 'min-width: 9em;'}, _('Idle'))
				])
			])
		]);
	}
});

var FullWidthValue = form.DummyValue.extend({
	__name__: 'FullWidthValue',
	content: null,

	render: function(option_index, section_id, in_table) {
		return E('div', {'class': 'cbi-section'}, this.content || []);
	}
});

return view.extend({
	load: function() {
		return Promise.all([
			readData(),
			uci.load('speedtest-ng')
		]);
	},

	render: function(payload) {
		var data = payload[0] || [];
		var timeFormat = uci.get('speedtest-ng', 'display', 'time_format') || '24h';
		var m, s, o;

		m = new form.Map('speedtest-ng', _('Speedtest NG'),
			_('Run and track network speed tests from LuCI on OpenWrt'));

		s = m.section(form.NamedSection, 'display', 'speedtest');
		s.anonymous = true;
		s.addremove = false;

		o = s.option(RunControlsValue, '_run_controls', _('Run Test'));
		o.data = data;
		o.timeFormat = timeFormat;

		s = m.section(form.NamedSection, 'display', 'speedtest');
		s.anonymous = true;
		s.addremove = false;

		s.tab('history', _('Runs'));
		s.tab('details', _('Run Details'));
		s.tab('settings', _('Settings'));

		o = s.taboption('history', FullWidthValue, '_run_history');
		o.content = E('div', {'id': 'speedtest-history-content'}, renderHistory(data, timeFormat));

		o = s.taboption('details', FullWidthValue, '_run_details');
		o.content = E('div', {'id': 'speedtest-detail-content'}, detailPlaceholder());

		o = s.taboption('settings', form.ListValue, 'time_format', _('Time format'),
			_('Select how timestamps are displayed in results.'));
		bindUciOption(o, 'display', 'time_format');
		o.rmempty = false;
		o.default = '24h';
		o.value('24h', _('24-hour'));
		o.value('12h', _('12-hour'));

		o = s.taboption('settings', form.Flag, 'enable', _('Enable'),
			_('Enable or disable service.'));
		bindUciOption(o, 'schedule', 'enable');
		o.rmempty = false;
		o.default = o.disabled;

		o = s.taboption('settings', form.MultiValue, 'days', _('Days of Week'),
			_('Select days of week to run Speedtest.'));
		bindUciOption(o, 'schedule', 'days');
		o.rmempty = false;
		o.depends('enable', '1');
		o.value('1', _('Monday'));
		o.value('2', _('Tuesday'));
		o.value('3', _('Wednesday'));
		o.value('4', _('Thursday'));
		o.value('5', _('Friday'));
		o.value('6', _('Saturday'));
		o.value('7', _('Sunday'));

		o = s.taboption('settings', form.ListValue, 'start', _('Start time'),
			_('Specify start time for Speedtest.'));
		bindUciOption(o, 'schedule', 'start');
		o.rmempty = false;
		o.depends('enable', '1');
		for (var startHour = 0; startHour < 24; startHour++) {
			var startTime = ('0' + startHour).slice(-2) + ':00';
			o.value(startHour, startTime);
		}

		o = s.taboption('settings', form.ListValue, 'stop', _('Stop time'),
			_('Specify stop time for Speedtest.'));
		bindUciOption(o, 'schedule', 'stop');
		o.rmempty = false;
		o.depends('enable', '1');
		for (var stopHour = 0; stopHour < 24; stopHour++) {
			var stopTime = ('0' + stopHour).slice(-2) + ':00';
			o.value(stopHour, stopTime);
		}

		o = s.taboption('settings', form.Value, 'frequency', _('Frequency (minutes)'),
			_('Specify how often the speed test should run, with a maximum of once per hour.'));
		bindUciOption(o, 'schedule', 'frequency');
		o.rmempty = false;
		o.depends('enable', '1');
		o.placeholder = _('Enter minutes (1-60)');
		o.validate = function(section_id, value) {
			var validate = /^([1-9]|[1-5][0-9]|60)$/;
			if (!validate.test(value)) {
				return _('The frequency must be between 1 and 60 minutes.');
			}
			return true;
		};

		o = s.taboption('settings', form.ListValue, 'test', _('Test type'),
			_('Specify test type for Speedtest.'));
		bindUciOption(o, 'schedule', 'test');
		o.rmempty = false;
		o.depends('enable', '1');
		o.value('all', _('All'));
		o.value('latency', _('Latency'));
		o.value('download', _('Download'));
		o.value('upload', _('Upload'));

		o = s.taboption('settings', FullWidthValue, '_restore_history');
		o.content = renderRestoreHistory(timeFormat);

		return m.render().then(function(mapNode) {
			// Reduce the Runs table per-cell horizontal padding ~20% (theme
			// default is 10px) to tighten the columns.
			mapNode.appendChild(E('style', {}, [
				'#speedtest-history-content .th, #speedtest-history-content .td { padding-left: 8px; padding-right: 8px; }',
				'.speedtest-ng-note::placeholder { opacity: 0.7; }'
			].join('\n')));

			const heading = mapNode.querySelector('h2');
			if (heading) {
				const githubIcon = svgEl('svg', {
					'width': '14',
					'height': '14',
					'viewBox': '0 0 16 16',
					'fill': 'currentColor',
					'aria-hidden': 'true',
					'style': 'vertical-align:-0.125em;margin-right:0.3em'
				}, [svgEl('path', {
					'd': 'M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656'
				})]);
				const metadata = E('span', {
					'style': 'display:inline-block;margin-left:16px;font-size:13px;font-weight:400;line-height:18px;white-space:nowrap'
				}, [
					'v' + APP_VERSION + ' · ',
					E('a', {
						'href': 'https://github.com/vad-b/luci-app-speedtest-ng',
						'target': '_blank',
						'rel': 'noopener'
					}, [githubIcon, 'GitHub'])
				]);
				heading.appendChild(metadata);
				getAvailableAppUpdate().then(function(update) {
					if (!update)
						return;
					metadata.appendChild(document.createTextNode(' · '));
					metadata.appendChild(E('button', {
						'type': 'button',
						'style': 'display:inline-block;padding:1px 7px;border:1px solid #fcd34d;border-radius:4px;background:#fef3c7;color:#713f12;font-family:inherit;font-size:12px;font-weight:400;line-height:18px;vertical-align:baseline;cursor:pointer',
						'click': function() { showAppUpdate(update); }
					}, [_('Update available: %s').format('v' + update.version)]));
				}).catch(function(error) {
					console.warn('Unable to check for application updates:', error);
				});
			}

			schedulePageActionsVisibilityUpdate(mapNode);
			mapNode.addEventListener('click', function(ev) {
				if (ev.target.closest('.cbi-tabmenu')) {
					schedulePageActionsVisibilityUpdate(mapNode);
					window.setTimeout(function() {
						if (mapNode.querySelector('li.cbi-tab[data-tab="history"]')) {
							// Re-read the Runs list so notes edited on Run Details show here.
							readData().then(function(fresh) {
								replaceHistory(fresh, timeFormat);
							});
						} else if (mapNode.querySelector('li.cbi-tab[data-tab="details"]')) {
							// Run Details keeps no state: a manual switch here resets to
							// the placeholder; a programmatic switch (run / # click) keeps
							// the freshly rendered content.
							if (suppressDetailReset) {
								suppressDetailReset = false;
							} else {
								showDetailPlaceholder();
							}
						}
					}, 0);
				}
			});
			return mapNode;
		});
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			ui.changes.apply(mode == '0');
			return window.setTimeout(function() {
				fs.exec('/usr/share/speedtest-ng/schedule', ['update']);
			}, 1000);
		});
	}
});
