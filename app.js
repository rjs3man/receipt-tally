(function () {
  'use strict';

  const P = window.ReceiptParser;
  const CATS = P.CATEGORIES;
  const CAT_COLORS = {
    Dining: '#e8833a', Groceries: '#3a9d5d', Transport: '#3b82c4', Shopping: '#a855c7', Travel: '#0ea5a4',
    Subscriptions: '#d0478a', Bills: '#7c6f64', Health: '#d64545', Entertainment: '#c9a227', Other: '#8792a2',
  };
  const KEY_EXPENSES = 'receipt-tally.expenses.v1';
  const KEY_LEARNED = 'receipt-tally.learned.v1';
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
  const $ = sel => document.querySelector(sel);

  // ---------- storage ----------
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save() {
    try {
      localStorage.setItem(KEY_EXPENSES, JSON.stringify(state.expenses));
      localStorage.setItem(KEY_LEARNED, JSON.stringify(state.learned));
    } catch (e) { toast('Could not save. Your browser storage may be full or blocked.'); }
  }

  const now = new Date();
  const state = {
    expenses: load(KEY_EXPENSES, []),
    learned: load(KEY_LEARNED, {}),
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    jobs: [],
    search: '',
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const monthKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const fmtMonth = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const round2 = n => Math.round(n * 100) / 100;

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const el = $('#toast');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (actionLabel ? '<button type="button">' + esc(actionLabel) + '</button>' : '');
    el.hidden = false;
    if (actionLabel) el.querySelector('button').onclick = () => { el.hidden = true; action(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // ---------- summary + list ----------
  function monthExpenses() {
    const mk = monthKey(state.month);
    return state.expenses.filter(e => e.date.slice(0, 7) === mk);
  }

  function renderSummary() {
    const label = fmtMonth(state.month);
    $('#monthLabel').textContent = label;
    $('#sumMonth').textContent = label;
    const list = monthExpenses();
    const total = round2(list.reduce((s, e) => s + e.amount, 0));
    $('#monthTotal').textContent = money.format(total);

    const prev = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
    const prevTotal = state.expenses.filter(e => e.date.slice(0, 7) === monthKey(prev)).reduce((s, e) => s + e.amount, 0);
    let meta = list.length + (list.length === 1 ? ' expense' : ' expenses');
    if (prevTotal > 0 && list.length) {
      const diff = total - prevTotal;
      meta += ' · ' + money.format(Math.abs(diff)) + (diff >= 0 ? ' more' : ' less') + ' than ' + prev.toLocaleDateString(undefined, { month: 'long' });
    }
    $('#monthMeta').textContent = meta;

    const byCat = {};
    for (const e of list) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    const rows = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = rows.length ? rows[0][1] : 0;
    $('#catBars').innerHTML = rows.length ? rows.map(([cat, v]) =>
      '<div class="bar-row"><span>' + esc(cat) + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(2, v / max * 100).toFixed(1) + '%;background:' + (CAT_COLORS[cat] || CAT_COLORS.Other) + '"></div></div>' +
      '<span class="bar-amt">' + money.format(v) + '</span></div>').join('')
      : '<div class="empty">Nothing yet this month. Drop a receipt above to get started.</div>';
  }

  function renderList() {
    const q = state.search.trim().toLowerCase();
    const list = monthExpenses()
      .filter(e => !q || (e.merchant + ' ' + (e.note || '') + ' ' + e.category).toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    if (!list.length) {
      $('#list').innerHTML = '<div class="empty">' + (q ? 'No matches.' : 'No expenses in ' + esc(fmtMonth(state.month)) + '.') + '</div>';
      return;
    }
    const days = [];
    for (const e of list) {
      if (!days.length || days[days.length - 1].date !== e.date) days.push({ date: e.date, items: [] });
      days[days.length - 1].items.push(e);
    }
    $('#list').innerHTML = days.map(d => {
      const label = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const sum = d.items.reduce((s, e) => s + e.amount, 0);
      return '<div class="day"><div class="day-label"><span>' + esc(label) + '</span><span>' + money.format(sum) + '</span></div>' +
        d.items.map(e =>
          '<div class="exp" data-id="' + esc(e.id) + '" tabindex="0" role="button">' +
          '<span class="dot" style="background:' + (CAT_COLORS[e.category] || CAT_COLORS.Other) + '"></span>' +
          '<div class="exp-main"><div class="exp-merchant">' + esc(e.merchant || 'Unknown') + '</div>' +
          '<div class="exp-sub">' + esc(e.category) + (e.note ? ' · ' + esc(e.note) : '') + '</div></div>' +
          '<div class="exp-amt' + (e.amount < 0 ? ' neg' : '') + '">' + money.format(e.amount) + '</div></div>').join('') +
        '</div>';
    }).join('');
  }

  function render() { renderSummary(); renderList(); }

  $('#list').addEventListener('click', e => {
    const row = e.target.closest('.exp');
    if (row) openEdit(state.expenses.find(x => x.id === row.dataset.id));
  });
  $('#list').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('exp')) e.target.click();
  });
  $('#search').addEventListener('input', e => { state.search = e.target.value; renderList(); });
  $('#prevMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); render(); };
  $('#nextMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); render(); };

  // ---------- edit dialog ----------
  const dlg = $('#editDialog');
  const form = $('#editForm');
  form.category.innerHTML = CATS.map(c => '<option>' + c + '</option>').join('');
  let editing = null;

  function openEdit(exp) {
    editing = exp || null;
    $('#editTitle').textContent = exp ? 'Edit expense' : 'Add expense';
    $('#deleteBtn').hidden = !exp;
    form.merchant.value = exp ? exp.merchant : '';
    form.amount.value = exp ? exp.amount.toFixed(2) : '';
    const today = P.isoOf(new Date());
    form.date.value = exp ? exp.date : (monthKey(state.month) === today.slice(0, 7) ? today : monthKey(state.month) + '-01');
    form.category.value = exp ? exp.category : 'Other';
    form.note.value = exp ? exp.note || '' : '';
    dlg.showModal();
    if (!exp) form.merchant.focus();
  }

  form.merchant.addEventListener('change', () => {
    if (!editing) form.category.value = P.categorize(form.merchant.value, '', state.learned);
  });

  dlg.addEventListener('close', () => {
    const action = dlg.returnValue;
    dlg.returnValue = '';
    if (action === 'delete' && editing) {
      const removed = editing;
      state.expenses = state.expenses.filter(x => x.id !== removed.id);
      save(); render();
      toast('Deleted ' + (removed.merchant || 'expense'), 'Undo', () => { state.expenses.push(removed); save(); render(); });
    } else if (action === 'save') {
      const amount = round2(parseFloat(form.amount.value));
      if (!isFinite(amount)) return;
      const data = { merchant: form.merchant.value.trim(), amount, date: form.date.value, category: form.category.value, note: form.note.value.trim() };
      learn(data.merchant, data.category);
      if (editing) Object.assign(editing, data);
      else state.expenses.push(Object.assign({ id: uid(), createdAt: Date.now(), source: 'manual' }, data));
      save(); render();
    }
    editing = null;
  });

  function learn(merchant, category) {
    const k = P.normMerchant(merchant);
    if (!k) return;
    if (category === P.categorize(merchant, '', null)) delete state.learned[k];
    else state.learned[k] = category;
  }

  $('#addManual').onclick = () => openEdit(null);

  // ---------- intake: files, paste, drop ----------
  const drop = $('#drop');
  const fileInput = $('#fileInput');
  drop.addEventListener('click', e => { if (!e.target.closest('button')) fileInput.click(); });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  $('#chooseBtn').onclick = () => fileInput.click();
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

  let dragDepth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; drop.classList.add('over'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.classList.remove('over'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; drop.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
  window.addEventListener('paste', e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const files = [];
    for (const it of (e.clipboardData || {}).items || []) if (it.kind === 'file' && it.type.startsWith('image/')) files.push(it.getAsFile());
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => f && (f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(f.name)));
    if (!files.length) { toast('Those files are not images.'); return; }
    for (const file of files) {
      const job = { id: uid(), file, name: file.name || 'Pasted screenshot', url: URL.createObjectURL(file), status: 'queued', progress: 0, items: [], text: '' };
      state.jobs.push(job);
      $('#jobs').appendChild(jobEl(job));
    }
    $('#review').hidden = false;
    updateReviewButtons();
    $('#review').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    pump();
  }

  // ---------- OCR ----------
  let workerPromise = null;
  let activeJob = null;
  function getWorker() {
    if (!workerPromise) {
      if (!window.Tesseract) return Promise.reject(new Error('The text reader did not load. Check your connection and reload.'));
      workerPromise = Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (!activeJob) return;
          if (m.status === 'recognizing text') activeJob.progress = 0.15 + m.progress * 0.85;
          else if (typeof m.progress === 'number') activeJob.progress = Math.min(0.15, m.progress * 0.15);
          activeJob.stage = m.status;
          updateProgress(activeJob);
        },
      }).catch(err => { workerPromise = null; throw err; });
    }
    return workerPromise;
  }

  // Upscale small screenshots, convert to grayscale, and flip dark-mode screenshots to dark-on-light.
  async function prepareImage(file) {
    const bmp = await createImageBitmap(file);
    let scale = 1;
    if (bmp.width < 1200) scale = Math.min(2.5, 1200 / bmp.width);
    const maxSide = 3200;
    scale = Math.min(scale, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      sum += g;
    }
    if (sum / (d.length / 4) < 115) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      let job;
      while ((job = state.jobs.find(j => j.status === 'queued'))) {
        activeJob = job;
        job.status = 'reading'; job.stage = 'loading text reader';
        refreshJob(job);
        try {
          const canvas = await prepareImage(job.file);
          let data;
          // The OCR engine downloads on first use; a flaky connection gets one silent retry.
          for (let attempt = 1; ; attempt++) {
            try {
              const worker = await getWorker();
              ({ data } = await worker.recognize(canvas));
              break;
            } catch (err) {
              if (attempt >= 2) throw err;
              const w = workerPromise;
              workerPromise = null;
              if (w) w.then(x => x.terminate()).catch(() => {});
            }
          }
          job.text = data.text || '';
          const result = P.parse(job.text, { learned: state.learned });
          job.mode = result.mode;
          job.items = result.items.map(it => Object.assign({ key: uid(), autoCategory: it.category }, it));
          job.status = 'done';
        } catch (err) {
          console.error(err);
          job.status = 'error';
          job.error = /decode|source image|InvalidStateError/i.test(String(err && (err.name + err.message)))
            ? "This image type couldn't be opened. Try a PNG or JPG screenshot."
            : (err && err.message) || 'Something went wrong reading this image.';
        }
        activeJob = null;
        refreshJob(job);
        updateReviewButtons();
      }
    } finally { pumping = false; }
  }

  // ---------- review UI ----------
  function jobEl(job) {
    const el = document.createElement('div');
    el.className = 'job';
    el.dataset.id = job.id;
    fillJob(el, job);
    return el;
  }
  function refreshJob(job) {
    const el = document.querySelector('.job[data-id="' + job.id + '"]');
    if (el) fillJob(el, job);
  }
  function updateProgress(job) {
    const el = document.querySelector('.job[data-id="' + job.id + '"]');
    if (!el) return;
    const bar = el.querySelector('.progress > div');
    if (bar) bar.style.width = Math.round(job.progress * 100) + '%';
    const st = el.querySelector('.stage');
    if (st) st.textContent = stageText(job);
  }
  function stageText(job) {
    if (job.status === 'queued') return 'Waiting…';
    if (job.stage === 'recognizing text') return 'Reading text… ' + Math.round(job.progress * 100) + '%';
    return 'Getting the text reader ready…';
  }

  function duplicateOf(it) {
    return state.expenses.find(e => Math.abs(e.amount - it.amount) < 0.005 &&
      Math.abs(new Date(e.date) - new Date(it.date)) <= 86400000);
  }

  function fillJob(el, job) {
    el.innerHTML = '';
    const thumb = document.createElement('img');
    thumb.className = 'job-thumb';
    thumb.src = job.url;
    thumb.alt = 'Receipt image';
    thumb.onclick = () => showPreview(job.url);
    const body = document.createElement('div');
    body.className = 'job-body';
    el.append(thumb, body);

    const head = '<div class="job-status"><span class="name">' + esc(job.name) + '</span>';
    if (job.status === 'queued' || job.status === 'reading') {
      body.innerHTML = head + '<span class="stage">' + esc(stageText(job)) + '</span></div><div class="progress"><div style="width:' + Math.round(job.progress * 100) + '%"></div></div>';
      return;
    }
    if (job.status === 'error') {
      body.innerHTML = head + '</div><p class="badge">' + esc(job.error) + '</p>';
      body.appendChild(jobFoot(job));
      return;
    }

    const n = job.items.length;
    const summary = n === 0 ? "Couldn't find an amount. Add it below."
      : job.mode === 'list' ? 'Found ' + n + ' transactions'
      : 'Found a receipt';
    body.innerHTML = head + '<span>' + esc(summary) + '</span></div>';
    const itemsEl = document.createElement('div');
    itemsEl.className = 'items';
    job.items.forEach(it => itemsEl.appendChild(itemRow(job, it)));
    body.appendChild(itemsEl);
    body.appendChild(jobFoot(job));
    if (job.text.trim()) {
      const det = document.createElement('details');
      det.className = 'raw';
      det.innerHTML = '<summary>Show text read from image</summary><pre>' + esc(job.text) + '</pre>';
      body.appendChild(det);
    }
  }

  function jobFoot(job) {
    const foot = document.createElement('div');
    foot.className = 'job-foot';
    const addRow = document.createElement('button');
    addRow.className = 'btn small ghost'; addRow.type = 'button'; addRow.textContent = '+ Add a row';
    addRow.onclick = () => {
      if (job.status === 'error') { job.status = 'done'; job.text = ''; }
      job.items.push({ key: uid(), date: P.isoOf(new Date()), merchant: '', amount: 0, category: 'Other', autoCategory: 'Other', checked: true });
      refreshJob(job);
      const inputs = document.querySelectorAll('.job[data-id="' + job.id + '"] .f-merchant');
      if (inputs.length) inputs[inputs.length - 1].focus();
      updateReviewButtons();
    };
    const remove = document.createElement('button');
    remove.className = 'btn small ghost'; remove.type = 'button'; remove.textContent = 'Discard image';
    remove.onclick = () => removeJob(job);
    if (job.status === 'error') {
      const retry = document.createElement('button');
      retry.className = 'btn small'; retry.type = 'button'; retry.textContent = 'Try again';
      retry.onclick = () => { job.status = 'queued'; job.progress = 0; refreshJob(job); updateReviewButtons(); pump(); };
      foot.append(retry);
    }
    foot.append(addRow, remove);
    return foot;
  }

  function itemRow(job, it) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'item' + (it.checked ? '' : ' off');
    row.innerHTML =
      '<input type="checkbox" aria-label="Include">' +
      '<input type="date" class="f-date" aria-label="Date">' +
      '<input type="text" class="f-merchant" placeholder="Merchant" aria-label="Merchant">' +
      '<input type="number" class="f-amount" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Amount">' +
      '<select class="f-cat" aria-label="Category">' + CATS.map(c => '<option>' + c + '</option>').join('') + '</select>';
    const [cb, date, merchant, amount, cat] = row.querySelectorAll('input, select');
    cb.checked = !!it.checked;
    date.value = it.date;
    merchant.value = it.merchant;
    amount.value = it.amount ? it.amount.toFixed(2) : '';
    cat.value = it.category;
    cb.onchange = () => { it.checked = cb.checked; row.classList.toggle('off', !cb.checked); updateReviewButtons(); };
    date.onchange = () => { it.date = date.value; refreshBadges(); };
    merchant.oninput = () => { it.merchant = merchant.value; };
    merchant.onchange = () => {
      if (cat.value === it.autoCategory) {
        it.category = it.autoCategory = P.categorize(merchant.value, '', state.learned);
        cat.value = it.category;
      }
    };
    amount.oninput = () => { it.amount = round2(parseFloat(amount.value) || 0); refreshBadges(); };
    cat.onchange = () => { it.category = cat.value; };

    const badges = document.createElement('div');
    badges.className = 'badges';
    function refreshBadges() {
      const dup = it.amount ? duplicateOf(it) : null;
      let html = '';
      if (it.credit) html += '<span class="badge">Looks like a payment or refund, so it\'s unchecked</span>';
      if (dup) html += '<span class="badge">Possible duplicate of ' + esc(dup.merchant || 'an expense') + ' on ' + esc(dup.date) + '</span>';
      badges.innerHTML = html;
      badges.hidden = !html;
    }
    refreshBadges();
    wrap.append(row, badges);

    const alts = (it.candidates || []).filter(v => Math.abs(v - it.amount) > 0.004).slice(0, 5);
    if (alts.length) {
      const chips = document.createElement('div');
      chips.className = 'chips badges';
      chips.innerHTML = '<span>Wrong amount? Other amounts found:</span>' + alts.map(v => '<button type="button" class="chip" data-v="' + v + '">' + money.format(v) + '</button>').join('');
      chips.onclick = e => {
        const b = e.target.closest('.chip');
        if (!b) return;
        it.amount = parseFloat(b.dataset.v);
        amount.value = it.amount.toFixed(2);
        refreshBadges();
      };
      wrap.appendChild(chips);
    }
    return wrap;
  }

  function removeJob(job) {
    state.jobs = state.jobs.filter(j => j !== job);
    const el = document.querySelector('.job[data-id="' + job.id + '"]');
    if (el) el.remove();
    URL.revokeObjectURL(job.url);
    if (!state.jobs.length) $('#review').hidden = true;
    updateReviewButtons();
  }

  function selectedCount() {
    return state.jobs.filter(j => j.status === 'done').reduce((n, j) => n + j.items.filter(it => it.checked).length, 0);
  }
  function updateReviewButtons() {
    const n = selectedCount();
    const busy = state.jobs.some(j => j.status === 'queued' || j.status === 'reading');
    const btn = $('#addAll');
    btn.disabled = n === 0;
    btn.textContent = n ? 'Add ' + n + ' expense' + (n === 1 ? '' : 's') : (busy ? 'Reading…' : 'Add selected');
  }

  $('#addAll').onclick = () => {
    const added = [];
    const problems = [];
    for (const job of state.jobs.filter(j => j.status === 'done')) {
      for (const it of job.items.filter(x => x.checked)) {
        if (!(it.amount > 0) || !it.date) { problems.push(it); continue; }
        if (it.category !== it.autoCategory) learn(it.merchant, it.category);
        added.push({
          id: uid(), createdAt: Date.now(), source: 'scan',
          merchant: (it.merchant || '').trim() || 'Unknown', amount: round2(it.amount), date: it.date, category: it.category, note: '',
        });
      }
    }
    if (problems.length) { toast(problems.length + ' selected row' + (problems.length === 1 ? ' is' : 's are') + ' missing an amount or date.'); return; }
    if (!added.length) return;
    state.expenses.push(...added);
    save();
    for (const job of state.jobs.filter(j => j.status === 'done' || j.status === 'error')) removeJob(job);
    const mk = monthKey(state.month);
    if (!added.some(e => e.date.slice(0, 7) === mk)) {
      const latest = added.map(e => e.date).sort().pop();
      state.month = new Date(+latest.slice(0, 4), +latest.slice(5, 7) - 1, 1);
    }
    render();
    const ids = new Set(added.map(e => e.id));
    toast('Added ' + added.length + ' expense' + (added.length === 1 ? '' : 's') + ' · ' + money.format(added.reduce((s, e) => s + e.amount, 0)),
      'Undo', () => { state.expenses = state.expenses.filter(e => !ids.has(e.id)); save(); render(); });
  };

  $('#discardAll').onclick = () => { for (const job of state.jobs.slice()) if (job !== activeJob) removeJob(job); };

  function showPreview(url) {
    const d = document.createElement('dialog');
    d.className = 'preview';
    d.innerHTML = '<img alt="Receipt image">';
    d.querySelector('img').src = url;
    d.onclick = () => d.close();
    d.onclose = () => d.remove();
    document.body.appendChild(d);
    d.showModal();
  }

  // ---------- export / backup ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  $('#exportCsv').onclick = () => {
    if (!state.expenses.length) { toast('No expenses to export yet.'); return; }
    const rows = [['Date', 'Merchant', 'Category', 'Amount', 'Note']].concat(
      state.expenses.slice().sort((a, b) => a.date.localeCompare(b.date))
        .map(e => [e.date, e.merchant, e.category, e.amount.toFixed(2), e.note || '']));
    download('expenses-' + P.isoOf(new Date()) + '.csv', rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  };
  $('#backup').onclick = () => {
    download('receipt-tally-backup-' + P.isoOf(new Date()) + '.json',
      JSON.stringify({ version: 1, expenses: state.expenses, learned: state.learned }, null, 2), 'application/json');
  };
  $('#restoreBtn').onclick = () => $('#restoreInput').click();
  $('#restoreInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = (data.expenses || []).filter(x => x && x.id && x.date && typeof x.amount === 'number');
      const have = new Set(state.expenses.map(x => x.id));
      const fresh = incoming.filter(x => !have.has(x.id));
      state.expenses.push(...fresh);
      Object.assign(state.learned, data.learned || {});
      save(); render();
      toast('Restored ' + fresh.length + ' expense' + (fresh.length === 1 ? '' : 's') + (incoming.length - fresh.length ? ' (' + (incoming.length - fresh.length) + ' already here)' : '') + '.');
    } catch (err) { toast("That file isn't a Receipt Tally backup."); }
  });

  render();
})();
