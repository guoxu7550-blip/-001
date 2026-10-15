/* =============================================================================
 * RBM Toolkit · 工具函数层 (utils.js)
 * DOM 助手 / 导出 / 打印 / 轻量 SVG 图表 / 提示与弹窗
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ DOM 助手 */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { n.dataset[d] = attrs[k][d]; });
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(obj) {
    return Object.keys(obj).filter(function (k) { return obj[k] != null && obj[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]); }).join('&');
  }

  /* ------------------------------------------------------------------ 提示 */
  function toast(msg, type) {
    var box = $('#toast-box');
    if (!box) { box = el('div', { id: 'toast-box', class: 'toast-box' }); document.body.appendChild(box); }
    var t = el('div', { class: 'toast toast-' + (type || 'info') });
    t.appendChild(el('span', { class: 'toast-dot' }));
    t.appendChild(el('span', { text: msg }));
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 2600);
  }

  function confirmDialog(title, message, onOk, okText) {
    var wrap = el('div', { class: 'modal-mask' });
    var box = el('div', { class: 'modal' });
    box.appendChild(el('h3', { text: title }));
    box.appendChild(el('p', { class: 'modal-msg', text: message }));
    var foot = el('div', { class: 'modal-foot' });
    var cancel = el('button', { class: 'btn btn-ghost', text: '取消' });
    var ok = el('button', { class: 'btn btn-danger', text: okText || '确认' });
    cancel.onclick = function () { wrap.remove(); };
    ok.onclick = function () { wrap.remove(); onOk && onOk(); };
    foot.appendChild(cancel); foot.appendChild(ok);
    box.appendChild(foot);
    wrap.appendChild(box);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
  }

  function openModal(title, bodyNode, footNodes, wide) {
    var wrap = el('div', { class: 'modal-mask' });
    var box = el('div', { class: 'modal' + (wide ? ' modal-wide' : '') });
    var head = el('div', { class: 'modal-head' });
    head.appendChild(el('h3', { text: title }));
    var x = el('button', { class: 'modal-x', html: '&times;' });
    x.onclick = function () { wrap.remove(); };
    head.appendChild(x);
    box.appendChild(head);
    var body = el('div', { class: 'modal-body' });
    if (typeof bodyNode === 'string') body.innerHTML = bodyNode; else if (bodyNode) body.appendChild(bodyNode);
    box.appendChild(body);
    if (footNodes && footNodes.length) {
      var foot = el('div', { class: 'modal-foot' });
      footNodes.forEach(function (f) { foot.appendChild(f); });
      box.appendChild(foot);
    }
    wrap.appendChild(box);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
    return { wrap: wrap, close: function () { wrap.remove(); } };
  }

  /* ------------------------------------------------------------------ 文件导出 */
  function download(filename, content, mime) {
    var blob = new Blob(['\ufeff' + content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function toCSV(rows, headers) {
    function cell(v) {
      var s = (v == null ? '' : String(v));
      if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var out = [];
    if (headers) out.push(headers.map(function (h) { return cell(h.label); }).join(','));
    rows.forEach(function (r) {
      if (headers) out.push(headers.map(function (h) { return cell(typeof h.value === 'function' ? h.value(r) : r[h.value]); }).join(','));
      else out.push(r.map(cell).join(','));
    });
    return out.join('\r\n');
  }

  function downloadCSV(filename, rows, headers) { download(filename, toCSV(rows, headers), 'text/csv'); }
  function downloadJSON(filename, obj) { download(filename, JSON.stringify(obj, null, 2), 'application/json'); }

  /* ------------------------------------------------------------------ Word 导出（.doc，兼容 WPS / MS Word） */
  function downloadWord(filename, innerHTML, title) {
    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
      '<title>' + esc(title || filename) + '</title>' +
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
      '<style>' + basePrintCSS() + 'body{padding:0}</style></head><body>' + innerHTML + '</body></html>';
    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* ------------------------------------------------------------------ 打印 / PDF */
  function printHTML(title, innerHTML, extraClass) {
    var w = window.open('', '_blank');
    if (!w) { toast('浏览器拦截了新窗口，请允许弹窗后重试', 'warn'); return; }
    var css = '';
    try { css = document.getElementById('rbm-print-css') ? document.getElementById('rbm-print-css').textContent : ''; } catch (e) { }
    w.document.write(
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>' + basePrintCSS() + css + '</style></head><body class="' + (extraClass || '') + '">' + innerHTML + '</body></html>'
    );
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) { } }, 450);
  }

  function basePrintCSS() {
    return [
      '*{box-sizing:border-box}',
      'body{font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;color:#1a202c;margin:0;padding:26px 30px;font-size:12px;line-height:1.6}',
      'h1{font-size:19px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 8px;border-left:4px solid #0f766e;padding-left:8px}',
      'h3{font-size:13px;margin:14px 0 6px}',
      '.print-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:10px;margin-bottom:14px}',
      '.print-brand{font-size:11px;color:#64748b;text-align:right}',
      'table{width:100%;border-collapse:collapse;margin:8px 0 14px}',
      'th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top;font-size:11px}',
      'th{background:#f1f5f9;font-weight:600}',
      '.kv{display:grid;grid-template-columns:120px 1fr 120px 1fr;gap:6px 10px;margin-bottom:12px}',
      '.kv div{border-bottom:1px dotted #cbd5e1;padding:3px 0}',
      '.kv .k{color:#64748b}', '.kv .v{font-weight:600}',
      '.badge{display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:600;border:1px solid}',
      '.b-high{color:#b91c1c;border-color:#fca5a5;background:#fef2f2}',
      '.b-mid{color:#b45309;border-color:#fcd34d;background:#fffbeb}',
      '.b-low{color:#047857;border-color:#6ee7b7;background:#ecfdf5}',
      '.sign{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:26px}',
      '.sign div{border-top:1px solid #94a3b8;padding-top:5px;font-size:11px;color:#475569}',
      '.muted{color:#64748b}.small{font-size:10.5px}',
      'ul{margin:4px 0 10px;padding-left:18px}li{margin-bottom:3px}',
      '.chk{width:14px;height:14px;border:1px solid #475569;display:inline-block;vertical-align:-2px;margin-right:5px}',
      '.pagebreak{page-break-before:always}',
      '@page{margin:14mm 12mm}'
    ].join('');
  }

  /* ------------------------------------------------------------------ 轻量 SVG 图表 */
  /** 水平条形图
   * data: [{label, value, max, level}]  */
  function barChart(container, data, opts) {
    opts = opts || {};
    var W = opts.width || 560, rowH = opts.rowH || 30, padL = opts.padLeft || 150, padR = 46;
    var H = data.length * rowH + 10;
    var max = opts.max || Math.max.apply(null, data.map(function (d) { return d.max || d.value; }).concat([1]));
    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" preserveAspectRatio="xMidYMid meet">'];
    data.forEach(function (d, i) {
      var y = i * rowH + 6, barW = Math.max(2, (d.value / max) * (W - padL - padR));
      var color = opts.colorOf ? opts.colorOf(d) : '#0f766e';
      svg.push('<text x="0" y="' + (y + 12) + '" class="chart-lab">' + esc(trunc(d.label, opts.labelLen || 22)) + '</text>');
      svg.push('<rect x="' + padL + '" y="' + y + '" width="' + (W - padL - padR) + '" height="14" rx="4" fill="#eef2f6"/>');
      svg.push('<rect x="' + padL + '" y="' + y + '" width="' + barW + '" height="14" rx="4" fill="' + color + '"/>');
      svg.push('<text x="' + (padL + barW + 6) + '" y="' + (y + 12) + '" class="chart-val">' + esc(d.display != null ? d.display : d.value) + '</text>');
    });
    svg.push('</svg>');
    container.innerHTML = svg.join('');
  }

  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /** 折线趋势图 series: [{name,color,points:[{x label, y value}]}] */
  function lineChart(container, series, opts) {
    opts = opts || {};
    var W = opts.width || 620, H = opts.height || 220, padL = 42, padR = 16, padT = 14, padB = 30;
    var labels = opts.labels || (series[0] ? series[0].points.map(function (p) { return p.x; }) : []);
    var all = [];
    series.forEach(function (s) { s.points.forEach(function (p) { all.push(p.y); }); });
    var max = opts.max != null ? opts.max : Math.max.apply(null, all.concat([1]));
    var min = opts.min != null ? opts.min : 0;
    if (max === min) max = min + 1;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    function X(i, n) { return padL + (n <= 1 ? innerW / 2 : (innerW * i / (n - 1))); }
    function Y(v) { return padT + innerH - ((v - min) / (max - min)) * innerH; }

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" preserveAspectRatio="xMidYMid meet">'];
    // 网格
    for (var g = 0; g <= 4; g++) {
      var gv = min + (max - min) * g / 4, gy = Y(gv);
      svg.push('<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#e6ebf1" stroke-width="1"/>');
      svg.push('<text x="' + (padL - 6) + '" y="' + (gy + 3.5) + '" class="chart-axis" text-anchor="end">' + round1(gv) + '</text>');
    }
    labels.forEach(function (l, i) {
      svg.push('<text x="' + X(i, labels.length) + '" y="' + (H - 9) + '" class="chart-axis" text-anchor="middle">' + esc(l) + '</text>');
    });
    // 阈值线
    if (opts.threshold != null) {
      var ty = Y(opts.threshold);
      svg.push('<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="5 4"/>');
      svg.push('<text x="' + (W - padR) + '" y="' + (ty - 5) + '" class="chart-axis" text-anchor="end" fill="#dc2626">阈值 ' + opts.threshold + '</text>');
    }
    series.forEach(function (s) {
      var pts = s.points.map(function (p, i) { return X(i, s.points.length) + ',' + Y(p.y); }).join(' ');
      svg.push('<polyline points="' + pts + '" fill="none" stroke="' + (s.color || '#0f766e') + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
      s.points.forEach(function (p, i) {
        svg.push('<circle cx="' + X(i, s.points.length) + '" cy="' + Y(p.y) + '" r="3.4" fill="#fff" stroke="' + (s.color || '#0f766e') + '" stroke-width="2"/>');
      });
    });
    svg.push('</svg>');
    container.innerHTML = svg.join('');
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  /** 甜甜圈图 data:[{label,value,color}] */
  function donut(container, data, opts) {
    opts = opts || {};
    var size = opts.size || 150, r = size / 2 - 12, cx = size / 2, cy = size / 2, sw = opts.stroke || 18;
    var total = data.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var C = 2 * Math.PI * r, off = 0;
    var svg = ['<svg viewBox="0 0 ' + size + ' ' + size + '" class="chart-svg" style="max-width:' + size + 'px">'];
    svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#eef2f6" stroke-width="' + sw + '"/>');
    data.forEach(function (d) {
      var len = (d.value / total) * C;
      svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color + '" stroke-width="' + sw +
        '" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt"/>');
      off += len;
    });
    svg.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="donut-num">' + (opts.centerNum != null ? opts.centerNum : total) + '</text>');
    if (opts.centerLabel) svg.push('<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" class="donut-lab">' + esc(opts.centerLabel) + '</text>');
    svg.push('</svg>');
    container.innerHTML = svg.join('');
  }

  /* ------------------------------------------------------------------ 其他 */
  function levelClass(level) {
    return level === '高' ? 'lv-high' : level === '中' ? 'lv-mid' : level === '低' ? 'lv-low' : 'lv-none';
  }
  function levelColor(level) {
    return level === '高' ? '#dc2626' : level === '中' ? '#d97706' : level === '低' ? '#059669' : '#94a3b8';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return iso;
    return fmtDate(iso) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    var ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
    return Math.round(ms / 86400000);
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 200); };
  }
  function fileToDataURL(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  function readFileText(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsText(file, 'utf-8');
    });
  }

  global.RBM_Utils = {
    $: $, $$: $$, el: el, esc: esc, qs: qs,
    toast: toast, confirmDialog: confirmDialog, openModal: openModal,
    download: download, downloadCSV: downloadCSV, downloadJSON: downloadJSON, downloadWord: downloadWord, toCSV: toCSV,
    printHTML: printHTML, basePrintCSS: basePrintCSS,
    barChart: barChart, lineChart: lineChart, donut: donut,
    levelClass: levelClass, levelColor: levelColor,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, daysBetween: daysBetween,
    debounce: debounce, fileToDataURL: fileToDataURL, readFileText: readFileText, round1: round1
  };
})(window);
