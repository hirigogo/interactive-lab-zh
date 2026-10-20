/* ─── RAG Interactive Explainer ─── */
(function () {
  'use strict';

  /* ═══════ Domain data ═══════ */

  var DOMAINS = {
    airquality: {
      label: '空气质量',
      docs: [
        '德里冬季的 PM2.5 非常高',
        '孟买的空气污染程度中等',
        '班加罗尔的空气质量相对较好',
        '金奈的沿海风降低了污染水平',
        '加尔各答的冬季雾霾逐年加重',
      ],
      embs: [[0.9,0.8],[0.5,0.4],[0.1,0.2],[0.2,0.35],[0.75,0.7]],
      query: '德里冬季的空气污染如何？',
      qEmb: [0.85, 0.75],
      answer: '德里冬季的空气污染非常严重，PM2.5 水平常达到危害级别。',
      ctxWords: ['very', 'high', 'winter', 'Delhi', 'PM2.5'],
      axisX: '污染严重程度', axisY: '季节性强度',
    },
    cooking: {
      label: 'Cooking',
      docs: [
        '印度香饭使用巴斯马蒂米、藏红花，并以慢火焖制',
        '多萨面糊需要黑吉豆经一夜发酵',
        '奶酪串以酸奶腌制后烤制',
        '桑巴汤需要罗望子与特定香料粉',
        '玫瑰奶球经过油炸并浸入糖浆',
      ],
      embs: [[0.8,0.7],[0.3,0.6],[0.6,0.3],[0.35,0.8],[0.15,0.15]],
      query: '印度香饭怎么做？',
      qEmb: [0.75, 0.65],
      answer: '印度香饭以巴斯马蒂米加藏红花制成，分层后以慢火焖制，风味浓郁。',
      ctxWords: ['basmati', 'rice', 'saffron', 'slow', 'dum'],
      axisX: '烹饪复杂度', axisY: '准备时间',
    },
    history: {
      label: 'History',
      docs: [
        '莫卧儿帝国由巴布尔于 1526 年建立',
        '英国东印度公司于 1600 年抵达',
        '印度于 1947 年 8 月 15 日获得独立',
        '马拉塔帝国于 17 世纪崛起',
        '1947 年的印度分治催生了巴基斯坦',
      ],
      embs: [[0.15,0.8],[0.4,0.6],[0.85,0.3],[0.3,0.75],[0.8,0.35]],
      query: '印度何时独立？',
      qEmb: [0.82, 0.32],
      answer: '印度于 1947 年 8 月 15 日获得独立，结束了近两个世纪的英国殖民统治。',
      ctxWords: ['independence', '15', 'August', '1947', 'gained'],
      axisX: '时间顺序位置', axisY: '政治意义',
    },
    medical: {
      label: 'Medical',
      docs: [
        '2 型糖尿病通过二甲双胍与生活方式改变进行管理',
        '高血压需要定期监测血压并使用 ACE 抑制剂',
        '哮喘患者急性发作时使用支气管扩张剂吸入器',
        '登革热表现为高热、皮疹与血小板偏低',
        '结核病治疗采用为期 6 个月的 DOTS 方案',
      ],
      embs: [[0.7,0.3],[0.65,0.5],[0.3,0.7],[0.15,0.85],[0.45,0.65]],
      query: '糖尿病如何治疗？',
      qEmb: [0.68, 0.28],
      answer: '2 型糖尿病通常以二甲双胍，配合饮食与运动作为一线生活方式干预来管理。',
      ctxWords: ['metformin', 'lifestyle', 'changes', 'diabetes', 'managed'],
      axisX: '治疗复杂度', axisY: '急性与慢性',
    },
  };

  var K = 2;
  var currentDomain = 'airquality';
  function D() { return DOMAINS[currentDomain]; }

  /* ═══════ Utilities ═══════ */

  function euclidean(a, b) {
    return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]));
  }

  function topK(embs, q, k) {
    var ds = embs.map(function (e, i) { return { i: i, d: euclidean(e, q) }; });
    ds.sort(function (a, b) { return a.d - b.d; });
    return ds.slice(0, k);
  }

  /* ═══════ KaTeX — render all math via JS ═══════ */

  function renderMath() {
    if (!window.katex) return;

    var blocks = {
      'math-lm':      ['p(x_t \\mid x_{<t})', true],
      'math-knn':     ['\\text{kNN}(q) = \\arg\\min_{d \\in D}\\; \\|q - d\\|', true],
      'math-dist':    ['\\|q - d_i\\|_2 = \\sqrt{(q_x - d_x)^2 + (q_y - d_y)^2}', true],
      'math-gen':     ['p(y_t \\mid \\text{prompt},\\; y_{<t})', true],
      'math-attn':    ['\\alpha_{t,i} = \\text{softmax}(q_t^\\top k_i)', true],
      'math-norag':   ['p(y \\mid q)', true],
      'math-withrag': ['p(y \\mid q, d_1, d_2)', true],
      'math-why1':    ['p(y \\mid q) \\quad \\text{(parametric memory only)}', true],
      'math-why2':    ['p(y \\mid q) = \\sum_{d \\in D} p(y \\mid q, d)\\; p(d \\mid q)', true],
      'math-why3':    ['p(y \\mid q) \\approx \\sum_{d \\in \\text{top-}k} p(y \\mid q, d)', true],
      'math-final':   ['\\boxed{\\text{RAG} = \\text{kNN over knowledge} + \\text{LM over text}}', true],
      'math-retriever-inline': ['p(d \\mid q) \\propto \\exp(-\\|q - d\\|)', false],
    };

    Object.keys(blocks).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      try {
        katex.render(blocks[id][0], el, { displayMode: blocks[id][1], throwOnError: false });
      } catch (_) {}
    });
  }

  /* ═══════ Progress bar ═══════ */

  function setupProgress() {
    var fill = document.getElementById('progressFill');
    if (!fill) return;
    window.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = h > 0 ? ((window.scrollY / h) * 100).toFixed(1) + '%' : '0';
    });
  }

  /* ═══════ Pipeline step highlighting ═══════ */

  function setupPipelineHighlight() {
    var sectionToStep = {
      'embedding': 'embed',
      'query-embed': 'embed',
      'retrieval': 'retrieve',
      'prompt': 'prompt',
      'generate': 'generate'
    };
    var pipeSteps = document.querySelectorAll('.pipe-step[data-pipe]');
    var secs = Object.keys(sectionToStep).map(function (id) { return document.getElementById(id); }).filter(Boolean);

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var stepName = sectionToStep[e.target.id];
        pipeSteps.forEach(function (ps) {
          ps.classList.toggle('pipe-step--hl', ps.dataset.pipe === stepName);
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    secs.forEach(function (s) { obs.observe(s); });
  }

  /* ═══════ Embedding table (Section IV) ═══════ */

  function updateEmbedTable() {
    var el = document.getElementById('embedTable');
    if (!el) return;
    var d = D();
    var html = '<table class="data-table"><thead><tr><th>Doc</th><th>Text</th><th>Embedding</th></tr></thead><tbody>';
    d.docs.forEach(function (doc, i) {
      var txt = doc.length > 40 ? doc.slice(0, 38) + '\u2026' : doc;
      html += '<tr><td><code>d' + (i + 1) + '</code></td><td>' + txt + '</td>';
      html += '<td><code>[' + d.embs[i].map(function (v) { return v.toFixed(2); }).join(', ') + ']</code></td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  /* ═══════ Query embedding display (Section V) ═══════ */

  function updateQueryEmbDisplay() {
    var el = document.getElementById('queryEmbDisplay');
    if (!el) return;
    var d = D();
    el.textContent = '[' + qPos.map(function (v) { return v.toFixed(2); }).join(', ') + ']';
  }

  /* ═══════ 2D Embedding Canvas ═══════ */

  var canvas, ctx, dragging = false, qPos;

  function canvasInit() {
    canvas = document.getElementById('embeddingCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    qPos = D().qEmb.slice();
    draw();

    canvas.addEventListener('mousedown', mDown);
    canvas.addEventListener('mousemove', mMove);
    canvas.addEventListener('mouseup', mUp);
    canvas.addEventListener('mouseleave', mUp);
    canvas.addEventListener('touchstart', tDown, { passive: false });
    canvas.addEventListener('touchmove', tMove, { passive: false });
    canvas.addEventListener('touchend', mUp);
    window.addEventListener('resize', function () { resize(); draw(); });
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  var PAD = 52;
  function d2c(x, y) {
    var r = canvas.getBoundingClientRect();
    return [PAD + x * (r.width - 2 * PAD), r.height - PAD - y * (r.height - 2 * PAD)];
  }
  function c2d(cx, cy) {
    var r = canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (cx - PAD) / (r.width - 2 * PAD))),
      Math.max(0, Math.min(1, (r.height - PAD - cy) / (r.height - 2 * PAD)))
    ];
  }

  function draw() {
    if (!ctx) return;
    var r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
    var d = D();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#faf8f4'; ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(32,39,51,0.05)'; ctx.lineWidth = 1;
    for (var i = 0; i <= 10; i++) {
      var gx = PAD + (i / 10) * (w - 2 * PAD);
      var gy = h - PAD - (i / 10) * (h - 2 * PAD);
      ctx.beginPath(); ctx.moveTo(gx, PAD); ctx.lineTo(gx, h - PAD); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(w - PAD, gy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(32,39,51,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, h - PAD); ctx.lineTo(w - PAD, h - PAD); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD, h - PAD); ctx.lineTo(PAD, PAD); ctx.stroke();

    ctx.fillStyle = '#626d79'; ctx.font = '600 11px Manrope, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.axisX + ' \u2192', w / 2, h - 10);
    ctx.save(); ctx.translate(13, h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(d.axisY + ' \u2192', 0, 0); ctx.restore();

    // Top-k
    var tk = topK(d.embs, qPos, K);
    var retSet = {};
    tk.forEach(function (t) { retSet[t.i] = true; });

    // Distance lines
    tk.forEach(function (t) {
      var from = d2c(qPos[0], qPos[1]), to = d2c(d.embs[t.i][0], d.embs[t.i][1]);
      ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(30,119,112,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#1e7770'; ctx.font = '600 10px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.d.toFixed(2), (from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 5);
    });

    // Doc dots
    d.embs.forEach(function (emb, i) {
      var p = d2c(emb[0], emb[1]);
      var ret = !!retSet[i];
      ctx.beginPath(); ctx.arc(p[0], p[1], ret ? 9 : 7, 0, 2 * Math.PI);
      ctx.fillStyle = ret ? '#1e7770' : '#3c68cf'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = ret ? '#1e7770' : '#3c68cf';
      ctx.font = '700 11px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('d' + (i + 1), p[0] + 12, p[1] - 3);
      ctx.fillStyle = '#626d79'; ctx.font = '500 9px Manrope, sans-serif';
      var txt = d.docs[i].length > 28 ? d.docs[i].slice(0, 26) + '\u2026' : d.docs[i];
      ctx.fillText(txt, p[0] + 12, p[1] + 9);
    });

    // Query dot
    var qp = d2c(qPos[0], qPos[1]);
    ctx.beginPath(); ctx.arc(qp[0], qp[1], 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#d35b43'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#d35b43'; ctx.font = '800 12px IBM Plex Mono, monospace';
    ctx.textAlign = 'left'; ctx.fillText('q', qp[0] + 14, qp[1] + 4);

    updateTable(tk);
    updatePrompt(tk);
    updateQueryEmbDisplay();
    renderAttn(tk);
    if (typeof refreshGen === 'function') refreshGen(tk);
  }

  function mousePos(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function near(pos) { var qp = d2c(qPos[0], qPos[1]); return Math.abs(pos[0] - qp[0]) < 22 && Math.abs(pos[1] - qp[1]) < 22; }
  function mDown(e) { if (near(mousePos(e))) dragging = true; }
  function mMove(e) { if (!dragging) return; qPos = c2d.apply(null, mousePos(e)); draw(); }
  function mUp() { dragging = false; }
  function tDown(e) { e.preventDefault(); if (near(mousePos(e.touches[0]))) dragging = true; }
  function tMove(e) { e.preventDefault(); if (!dragging) return; qPos = c2d.apply(null, mousePos(e.touches[0])); draw(); }

  /* ═══════ Distance table ═══════ */

  function updateTable(tk) {
    var tbody = document.getElementById('distanceTableBody');
    if (!tbody) return;
    var d = D();
    var retSet = {}; tk.forEach(function (t) { retSet[t.i] = true; });
    var all = d.embs.map(function (e, i) { return { i: i, d: euclidean(e, qPos) }; });
    all.sort(function (a, b) { return a.d - b.d; });
    tbody.innerHTML = all.map(function (item) {
      var ret = !!retSet[item.i];
      var docTxt = d.docs[item.i];
      if (docTxt.length > 32) docTxt = docTxt.slice(0, 30) + '\u2026';
      return '<tr class="' + (ret ? 'is-retrieved' : '') + '">' +
        '<td>d<sub>' + (item.i + 1) + '</sub>: ' + docTxt + '</td>' +
        '<td><code>[' + d.embs[item.i].map(function (v) { return v.toFixed(2); }).join(', ') + ']</code></td>' +
        '<td><code>' + item.d.toFixed(3) + '</code></td>' +
        '<td class="' + (ret ? 'retrieved-yes' : 'retrieved-no') + '">' + (ret ? 'Yes' : 'No') + '</td></tr>';
    }).join('');
  }

  /* ═══════ Prompt builder ═══════ */

  function updatePrompt(tk) {
    var ctxEl = document.getElementById('promptContext');
    var qEl = document.getElementById('promptQuery');
    var d = D();
    if (ctxEl) {
      ctxEl.innerHTML = tk.map(function (t, idx) {
        return '<div class="prompt-doc"><span class="prompt-doc-num">' + (idx + 1) + '.</span> ' + d.docs[t.i] + '</div>';
      }).join('');
    }
    if (qEl) qEl.textContent = d.query;
    var qt = document.getElementById('queryText');
    if (qt) qt.textContent = '\u201c' + d.query + '\u201d';
  }

  /* ═══════ Doc list ═══════ */

  function updateDocList() {
    var el = document.getElementById('docList');
    if (!el) return;
    var d = D();
    var tk = topK(d.embs, qPos || d.qEmb, K);
    var retSet = {}; tk.forEach(function (t) { retSet[t.i] = true; });
    el.innerHTML = d.docs.map(function (doc, i) {
      return '<div class="doc-card' + (retSet[i] ? ' is-retrieved' : '') + '">' +
        '<span class="doc-tag">d<sub>' + (i + 1) + '</sub></span>' +
        '<span>\u201c' + doc + '\u201d</span></div>';
    }).join('');
  }

  /* ═══════ Token-by-token generation ═══════ */

  function setupGen() {
    var btn = document.getElementById('generateBtn');
    var reset = document.getElementById('resetGenBtn');
    var output = document.getElementById('genOutput');
    var preview = document.getElementById('genPromptPreview');
    if (!btn) return;

    function showPreview(tkPassed) {
      if (!preview) return;
      var d = D(), tk = tkPassed || topK(d.embs, qPos || d.qEmb, K);
      var lines = ['上下文：'];
      tk.forEach(function (t, i) { lines.push((i + 1) + '. ' + d.docs[t.i]); });
      lines.push('', '问题：' + d.query);
      preview.textContent = lines.join('\n');
    }
    showPreview();

    btn.addEventListener('click', function () {
      var d = D(), tk = topK(d.embs, qPos || d.qEmb, K);
      var tokens = d.answer.split(/(\s+)/);
      output.innerHTML = '';
      btn.disabled = true;
      showPreview(tk);
      
      // Gather all words from retrieved docs to check for context highlighting
      var contextText = tk.map(function(t) { return d.docs[t.i].toLowerCase(); }).join(' ');
      
      var i = 0;
      (function tick() {
        if (i >= tokens.length) { btn.disabled = false; return; }
        var tok = tokens[i];
        var span = document.createElement('span');
        span.className = 'gen-token';
        
        // Only highlight words > 3 chars that actually appear in the current retrieved context
        if (tok.trim().length > 3 && contextText.indexOf(tok.trim().toLowerCase()) >= 0) {
          span.classList.add('gen-token--context');
        }
        
        span.textContent = tok;
        output.appendChild(span);
        i++;
        setTimeout(tick, 80 + Math.random() * 60);
      })();
    });

    if (reset) reset.addEventListener('click', function () {
      output.innerHTML = ''; btn.disabled = false; showPreview();
    });

    return showPreview;
  }

  /* ═══════ Attention heatmap ═══════ */

  function renderAttn(tkPassed) {
    var el = document.getElementById('attentionHeatmap');
    if (!el) return;
    var d = D(), tk = tkPassed || topK(d.embs, qPos || d.qEmb, K);

    var ctxToks = [];
    tk.forEach(function (t) {
      d.docs[t.i].split(/\s+/).slice(0, 4).forEach(function (w) { ctxToks.push(w); });
    });
    ctxToks.push('\u2026');

    var outToks = d.answer.split(/\s+/).slice(0, 5);
    var weights = outToks.map(function (ot) {
      var row = ctxToks.map(function (ct) {
        var a = ot.toLowerCase().replace(/[^a-z0-9]/g, '');
        var b = ct.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (a === b) return 0.8;
        if (a.length > 2 && b.indexOf(a) >= 0) return 0.55;
        if (b.length > 2 && a.indexOf(b) >= 0) return 0.5;
        return 0.04 + Math.random() * 0.1;
      });
      var sum = row.reduce(function (s, v) { return s + v; }, 0);
      return row.map(function (v) { return v / sum; });
    });

    var html = '<div class="attn-row"><div class="attn-label"></div>';
    ctxToks.forEach(function (t) { html += '<div class="attn-header">' + t.slice(0, 6) + '</div>'; });
    html += '</div>';
    outToks.forEach(function (ot, ri) {
      html += '<div class="attn-row"><div class="attn-label">' + ot.slice(0, 8) + '</div>';
      weights[ri].forEach(function (w) {
        var a = Math.min(1, w * 3);
        html += '<div class="attn-cell" style="background:rgba(30,119,112,' + a.toFixed(2) + ')">' + w.toFixed(2) + '</div>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  /* ═══════ Walkthrough (Section IX) ═══════ */

  function updateWalkthrough() {
    var d = D(), tk = topK(d.embs, d.qEmb, K);
    var retSet = {}; tk.forEach(function (t) { retSet[t.i] = true; });

    var wtDocs = document.getElementById('wtDocs');
    if (wtDocs) {
      wtDocs.innerHTML = d.docs.map(function (doc, i) {
        return '<div class="wt-doc' + (retSet[i] ? ' is-retrieved' : '') + '">d' + (i + 1) + ': ' + doc + '</div>';
      }).join('');
    }
    var wtQ = document.getElementById('wtQuery');
    if (wtQ) wtQ.textContent = '\u201c' + d.query + '\u201d';
    var wtR = document.getElementById('wtRetrieved');
    if (wtR) {
      wtR.innerHTML = tk.map(function (t) {
        return '<div class="wt-doc is-retrieved">d' + (t.i + 1) + ': ' + d.docs[t.i] +
          ' <span style="color:#626d79;font-size:0.8rem">(dist=' + t.d.toFixed(3) + ')</span></div>';
      }).join('');
    }
    var wtP = document.getElementById('wtPrompt');
    if (wtP) {
      var lines = '上下文：\\n';
      tk.forEach(function (t, i) { lines += (i + 1) + '. ' + d.docs[t.i] + '\n'; });
      lines += '\n问题：' + d.query;
      wtP.textContent = lines;
    }
    var wtA = document.getElementById('wtAnswer');
    if (wtA) wtA.textContent = d.answer;
  }

  /* ═══════ Domain switching ═══════ */

  var refreshGen;

  function switchDomain(domain) {
    currentDomain = domain;
    qPos = D().qEmb.slice();
    draw();
    updateDocList();
    updateEmbedTable();
    updateWalkthrough();
    renderAttn();
    if (refreshGen) refreshGen();
    var output = document.getElementById('genOutput');
    if (output) output.innerHTML = '';
    var btn = document.getElementById('generateBtn');
    if (btn) btn.disabled = false;

    // Sync all domain button sets
    document.querySelectorAll('.domain-btn').forEach(function (b) {
      b.classList.toggle('domain-btn--active', b.dataset.domain === domain);
    });
  }

  function setupDomainSwitching() {
    document.querySelectorAll('.domain-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchDomain(this.dataset.domain); });
    });
  }

  /* ═══════ Init ═══════ */

  function init() {
    // Render math
    if (window.katex) {
      renderMath();
    } else {
      var s = document.querySelector('script[src*="katex"]');
      if (s) s.addEventListener('load', renderMath);
    }

    setupProgress();
    canvasInit();
    refreshGen = setupGen();
    renderAttn();
    setupDomainSwitching();
    updateDocList();
    updateEmbedTable();
    updateWalkthrough();
    setupPipelineHighlight();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
