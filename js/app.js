/* Budget Planner: user interface (the only file that touches the page).
 *
 * Connects the page (index.html) with the other layers:
 *   TD         (core.js)       rules, validation, calculations, CSV
 *   Auth       (auth.js)       sign-in
 *   Categories (categories.js) category list and icons
 *   DataStore  (storage.js)    saving to localStorage
 *   Charts     (charts.js)     drawing charts and saving PNG
 *
 * The structure of this file follows Track Daily by Yogabharathi (MIT licence, see LICENSE);
 * it was reduced and changed for this project (euro, validation, login, filters, chart export).
 */
(function () {
  'use strict';

  /* ============ CATEGORIES ============ */
  const BASE_CATS = Categories.BASE_CATS;
  const iconSvg = Categories.iconSvg;
  const hexToRgba = Categories.hexToRgba;

  let customCategories = [];
  function allCategories(){ return BASE_CATS.concat(customCategories.filter(c => !BASE_CATS.some(b => b.id === c.id))); }
  function catMeta(id){ return allCategories().find(c => c.id === id) || { id, label:'Deleted category', color:'#8A8375', icon:'tag', kind:'expense' }; }
  function categoriesForKind(kind){ return allCategories().filter(c => c.kind === kind || c.kind === 'both'); }

  /* ============ STATE ============ */
  let state = {
    page: 'overview',
    moneySubtab: 'transactions',
    typePill: 'expense',
    monthOffset: 0,
    budgetMonthOffset: 0,
    search: '',
    filterCategory: 'all',
    filterFrom: '',
    filterTo: '',
    transactions: [],
    budgets: {},
    editingId: null,
    editingType: 'expense',
    pendingDelete: null,
    pendingReset: false,
    insightType: 'expense',
    insightFrom: '',
    insightTo: '',
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const todayISO = TD.todayISO;
  const monthKey = iso => iso.slice(0,7);
  const fmtMoney = TD.formatMoney;
  const fmtMoneyRound = TD.formatMoneyRound;
  const fmtDate = TD.formatDate;
  const escapeHtml = TD.escapeHtml;
  const addMonths = TD.addMonths;
  const monthLabelFor = TD.monthLabel;

  function toast(msg, kind){
    kind = kind || 'default';
    const colors = { default:'var(--text-dim)', success:'var(--pos)', error:'var(--neg)' };
    const iconName = { default:null, success:'check', error:'alert' }[kind];
    const el = document.createElement('div');
    el.className = 'toast-enter card rounded-xl px-4 py-3 text-[13px] font-medium shadow-lg pointer-events-auto flex items-center gap-2';
    el.style.maxWidth = '360px';
    const iconHtml = iconName
      ? '<span class="toast-icon-pop" style="color:'+colors[kind]+'; display:inline-flex;">'+iconSvg(iconName,15)+'</span>'
      : '<span style="width:6px;height:6px;border-radius:50%;background:var(--text-faint);display:inline-block;flex-shrink:0;"></span>';
    el.innerHTML = iconHtml + '<span>'+escapeHtml(msg)+'</span>';
    $('#toastContainer').appendChild(el);
    setTimeout(()=>{ el.style.transition='opacity .3s ease, transform .3s ease'; el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(()=>el.remove(),300); }, 2600);
  }

  // Briefly swaps a button's content for a checkmark to confirm a save, then restores it.
  function flashSaved(btn, label){
    const original = btn.innerHTML;
    btn.innerHTML = iconSvg('check',14) + '<span>'+(label||'Saved')+'</span>';
    btn.style.pointerEvents = 'none';
    btn.classList.remove('save-success'); void btn.offsetWidth; btn.classList.add('save-success');
    return function restore(){ btn.innerHTML = original; btn.style.pointerEvents = ''; btn.classList.remove('save-success'); };
  }


  /* ============ PERSISTENCE (through DataStore) ============ */
  let storageWarned = false;
  function warnIfFailed(ok){
    if (!ok && !storageWarned){ storageWarned = true; toast('Could not save: browser storage is full or blocked','error'); }
  }
  function loadAll(){
    const d = DataStore.load();
    state.transactions = d.transactions; state.budgets = d.budgets; customCategories = d.customCategories;
  }
  function saveTx(){ warnIfFailed(DataStore.saveTransactions(state.transactions)); }
  function saveBudgets(){ warnIfFailed(DataStore.saveBudgets(state.budgets)); }
  function saveCustomCategories(){ warnIfFailed(DataStore.saveCustomCategories(customCategories)); }

  function animateNumber(el, from, to, formatter, duration){
    duration = duration||650;
    const start = performance.now();
    function tick(now){
      const p = Math.min(1,(now-start)/duration);
      const eased = 1-Math.pow(1-p,3);
      el.textContent = formatter(from+(to-from)*eased);
      if (p<1) requestAnimationFrame(tick); else el.textContent = formatter(to);
    }
    requestAnimationFrame(tick);
  }

  /* ============ THEME ============ */
  function applyTheme(theme){
    document.documentElement.classList.toggle('light', theme==='light');
    document.documentElement.classList.toggle('dark', theme!=='light');
    DataStore.setTheme(theme);
    const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
    const moon = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
    const isLight = theme==='light';
    $('#themeIcon').innerHTML = isLight ? sun : moon;
    $('#themeIconMore').innerHTML = isLight ? sun : moon;
    $('#themeLabelMore').textContent = isLight ? 'Dark mode' : 'Light mode';
    $('#themeIconSide').innerHTML = isLight ? sun : moon;
    $('#themeLabelSide').textContent = isLight ? 'Dark mode' : 'Light mode';
    [$('#themeIcon'), $('#themeIconMore')].forEach(el=>{
      el.classList.remove('theme-icon-spin');
      void el.offsetWidth;
      el.classList.add('theme-icon-spin');
    });
  }
  function toggleTheme(){
    const cur = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    applyTheme(cur==='light' ? 'dark' : 'light');
    renderChartsIfVisible();
  }

  function playPageTransition(el){
    el.classList.remove('page-transition');
    void el.offsetWidth;
    el.classList.add('page-transition');
  }

  /* ============ NAVIGATION ============ */
  const NAV_PAGES = ['overview','money','more'];
  function goToPage(page){
    state.page = page;
    $$('.page').forEach(p => p.classList.add('hidden'));
    const target = $('#page-'+page);
    target.classList.remove('hidden');
    playPageTransition(target);
    $$('.bottom-nav-btn, .side-nav-btn[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page===page));
    const activeBtn = $('.bottom-nav-btn[data-page="'+page+'"]');
    if (activeBtn){
      const svg = activeBtn.querySelector('svg');
      svg.classList.remove('nav-bounce'); void svg.offsetWidth; svg.classList.add('nav-bounce');
    }
    $('#fab').style.display = page==='more' ? 'none' : 'flex';
    const idx = NAV_PAGES.indexOf(page);
    if (idx>-1) $('#navIndicator').style.transform = 'translateX('+(idx*100)+'%)';
    closeFabMenu();
    if (page==='overview') renderOverview();
    if (page==='money') renderMoneyActiveSubtab();
    window.scrollTo(0,0);
  }
  function goToMoneySubtab(tab){
    state.moneySubtab = tab;
    $$('.money-subpage').forEach(p=>p.classList.add('hidden'));
    const target = $('#money-'+tab);
    target.classList.remove('hidden');
    playPageTransition(target);
    $$('.money-subtab').forEach(b=>b.classList.toggle('active', b.dataset.subtab===tab));
    renderMoneyActiveSubtab();
  }
  function renderMoneyActiveSubtab(){
    if (state.moneySubtab==='transactions') renderTransactionsTab();
    else if (state.moneySubtab==='budget') renderBudgetTab();
    else if (state.moneySubtab==='insights') renderCharts();
  }
  function renderChartsIfVisible(){ if (state.page==='money' && state.moneySubtab==='insights') renderCharts(); }

  $$('.bottom-nav-btn, .side-nav-btn[data-page]').forEach(b => b.addEventListener('click', ()=> goToPage(b.dataset.page)));
  $$('.money-subtab').forEach(b => b.addEventListener('click', ()=> goToMoneySubtab(b.dataset.subtab)));
  $('#goToInsights').addEventListener('click', ()=>{ goToPage('money'); goToMoneySubtab('insights'); });

  /* ============ COMPUTATIONS ============ */
  function getTotals(list){
    let income=0, expense=0;
    list.forEach(t=>{ if(t.type==='income') income+=t.amount; else if(t.type==='expense') expense+=t.amount; });
    return { income, expense, net: income-expense };
  }
  function monthTotals(ym){ return getTotals(state.transactions.filter(t=>monthKey(t.date)===ym)); }
  function pctChange(curr, prev){ if(!prev) return curr===0?null:Infinity; return ((curr-prev)/Math.abs(prev))*100; }
  function trendChip(pct, goodIsUp){
    if (pct===null) return { label:'No data last month', positive:null, direction:null };
    if (pct===Infinity) return { label:'New this month', positive:true, direction:'up' };
    const r = Math.round(pct*10)/10;
    const isGood = goodIsUp ? r>=0 : r<=0;
    return { label:Math.abs(r)+'% from last month', positive:isGood, direction: r>=0?'up':'down' };
  }
  function trendIcon(direction){
    if (!direction) return '';
    return '<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate('+(direction==='up'?'0':'180')+'deg);flex-shrink:0;"><path d="M12 4l8 12H4z"/></svg>';
  }
  function currentMonthKey(){ return addMonths(todayISO().slice(0,7), 0); }
  function prevMonthKey(){ return addMonths(currentMonthKey(), -1); }

  /* ============ OVERVIEW ============ */
  function renderGreeting(){
    const now = new Date();
    const h = now.getHours();
    $('#greetingText').textContent = h<12?'Good morning':h<18?'Good afternoon':'Good evening';
    $('#greetingDate').textContent = now.toLocaleDateString('lv-LV',{weekday:'long', day:'numeric', month:'long'});
  }
  function setChip(sel, chip){
    const el = $(sel);
    el.innerHTML = trendIcon(chip.direction) + '<span>'+chip.label+'</span>';
    if (chip.positive===true){ el.style.background='rgba(var(--pos-rgb),0.14)'; el.style.color='var(--pos)'; el.style.border='none'; }
    else if (chip.positive===false){ el.style.background='rgba(var(--neg-rgb),0.14)'; el.style.color='var(--neg)'; el.style.border='none'; }
    else { el.style.background='var(--surface)'; el.style.color='var(--text-faint)'; el.style.border='1px solid var(--border)'; }
  }
  function setInlineTrend(sel, chip){
    const el = $(sel);
    el.innerHTML = trendIcon(chip.direction) + '<span style="margin-left:3px;">'+chip.label+'</span>';
    el.style.color = chip.positive===false?'var(--neg)':(chip.positive?'var(--pos)':'var(--text-faint)');
  }
  function renderOverview(){
    const all = getTotals(state.transactions);
    const balance = all.net;
    const thisMonth = monthTotals(currentMonthKey());
    const lastMonth = monthTotals(prevMonthKey());
    animateNumber($('#statBalance'),0,balance,fmtMoney);
    animateNumber($('#statIncome'),0,thisMonth.income,fmtMoney);
    animateNumber($('#statExpenses'),0,thisMonth.expense,fmtMoney);
    animateNumber($('#statNetSavings'),0,thisMonth.net,fmtMoney);
    const prevBalance = balance - thisMonth.net;
    setChip('#balanceTrendChip', trendChip(pctChange(balance, prevBalance), true));
    setInlineTrend('#incomeTrend', trendChip(pctChange(thisMonth.income, lastMonth.income), true));
    setInlineTrend('#expenseTrend', trendChip(pctChange(thisMonth.expense, lastMonth.expense), false));
    setChip('#savingsTrendChip', trendChip(pctChange(thisMonth.net, lastMonth.net), true));
    renderOverviewPanels();
  }

  /* ============ DESKTOP PANELS ============ */
  function categoryBarsHtml(byCat, limit){
    const ids = Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]).slice(0,limit);
    if (!ids.length) return '<p class="text-[13px] py-6 text-center" style="color:var(--text-faint);">No expenses this month yet.</p>';
    const max = byCat[ids[0]];
    return ids.map(id=>{
      const meta = catMeta(id);
      return '<div class="py-2"><div class="flex items-center justify-between text-[12.5px] mb-1.5"><span class="font-medium truncate">'+escapeHtml(meta.label)+'</span><span class="tabular" style="color:var(--text-dim);">'+fmtMoneyRound(byCat[id])+'</span></div>' +
        '<div class="h-1.5 rounded-full overflow-hidden" style="background:var(--surface-hi);"><div class="h-full rounded-full" style="width:'+Math.max(4, byCat[id]/max*100)+'%;background:'+meta.color+';"></div></div></div>';
    }).join('');
  }
  function renderOverviewPanels(){
    const recent = state.transactions.slice().sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0,6);
    $('#recentTxList').innerHTML = recent.length ? recent.map(t=>{
      const meta = catMeta(t.category), inc = t.type==='income';
      return '<div class="flex items-center gap-3 py-3" style="border-bottom:1px solid var(--border);">' +
        '<span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style="background:'+meta.color+';">'+iconSvg(meta.icon,16,'#fff')+'</span>' +
        '<div class="min-w-0 flex-1"><p class="text-[13.5px] font-medium truncate">'+escapeHtml(t.description||meta.label)+'</p><p class="text-[11.5px]" style="color:var(--text-faint);">'+escapeHtml(meta.label)+' · '+fmtDate(t.date)+'</p></div>' +
        '<span class="font-display font-semibold text-[13.5px] tabular" style="color:'+(inc?'var(--pos)':'var(--neg)')+';">'+(inc?'+':'−')+fmtMoney(t.amount)+'</span></div>';
    }).join('') : '<p class="text-[13px] py-6 text-center" style="color:var(--text-faint);">No transactions yet.</p>';
    $('#topCategoriesList').innerHTML = categoryBarsHtml(TD.spentByCategory(state.transactions, currentMonthKey()), 5);
  }
  function renderTxSummary(){
    const period = activePeriod();
    const ym = currentTxMonthKey();
    const t = period ? getTotals(state.transactions.filter(x => TD.inRange(x.date, period.from, period.to))) : monthTotals(ym);
    const spent = period ? TD.totalsByCategory(state.transactions, 'expense', period.from, period.to) : TD.spentByCategory(state.transactions, ym);
    const heading = period ? 'Selected period' : (ym===currentMonthKey() ? 'This month' : monthLabelFor(ym));
    const row = (label, value, color) => '<div class="flex items-center justify-between py-2"><span class="text-[13px]" style="color:var(--text-dim);">'+label+'</span><span class="font-display font-semibold text-[14px] tabular" style="color:'+color+';">'+value+'</span></div>';
    $('#txSummaryAside').innerHTML = '<div class="rounded-2xl card p-5">' +
      '<p class="text-[11px] font-semibold" style="color:var(--text-faint); letter-spacing:.05em;">SUMMARY</p>' +
      '<h3 class="font-display font-bold text-[16px] mb-2">'+heading+'</h3>' +
      row('Income', fmtMoney(t.income), 'var(--pos)') + row('Expenses', fmtMoney(t.expense), 'var(--neg)') +
      '<div style="border-top:1px solid var(--border);margin-top:4px;">' + row('Net savings', fmtMoney(t.net), t.net>=0?'var(--pos)':'var(--neg)') + '</div>' +
      '<p class="text-[11px] font-semibold mt-4 mb-1" style="color:var(--text-faint); letter-spacing:.05em;">TOP SPENDING</p>' +
      categoryBarsHtml(spent, 4) + '</div>';
  }
  $('#btnRecentViewAll').addEventListener('click', ()=>{ goToPage('money'); goToMoneySubtab('transactions'); });

  /* ============ CATEGORIES: PICKER + MANAGE ============ */
  function openCategoryPicker(){
    const cats = categoriesForKind(state.editingType);
    $('#categoryGrid').innerHTML = cats.map((c,i)=>{
      return '<button type="button" class="cat-pick-btn cat-icon-btn cat-pop flex flex-col items-center gap-1.5" style="animation-delay:'+Math.min(i*18,260)+'ms;" data-id="'+c.id+'">' +
        '<span class="w-12 h-12 rounded-full flex items-center justify-center" style="background:'+c.color+';">'+iconSvg(c.icon,20,'#fff')+'</span>' +
        '<span class="text-[11px] font-medium text-center leading-tight" style="color:var(--text-dim);">'+escapeHtml(c.label)+'</span>' +
        '</button>';
    }).join('') +
      '<button type="button" id="newCategoryFromGrid" class="cat-icon-btn cat-pop flex flex-col items-center gap-1.5" style="animation-delay:'+Math.min(cats.length*18,260)+'ms;">' +
        '<span class="w-12 h-12 rounded-full flex items-center justify-center border-2 border-dashed" style="border-color:var(--border-hi); color:var(--text-faint);">'+iconSvg('plus',18)+'</span>' +
        '<span class="text-[11px] font-medium" style="color:var(--text-faint);">New</span>' +
      '</button>';
    $$('.cat-pick-btn').forEach(b=>b.addEventListener('click', ()=>{
      selectCategory(b.dataset.id);
      hideModal('#categoryModal');
    }));
    $('#newCategoryFromGrid').addEventListener('click', ()=>{
      hideModal('#categoryModal');
      openManageCategoriesModal();
    });
    showModal('#categoryModal');
  }
  function selectCategory(id){
    const meta = catMeta(id);
    $('#txCategoryBtn').dataset.categoryId = id;
    $('#txCategoryLabel').innerHTML = '<span class="w-4 h-4 rounded-full inline-flex" style="background:'+meta.color+';"></span> '+escapeHtml(meta.label);
    $('#txCategoryLabel').style.color = 'var(--text)';
    $('#txCategoryLabel').classList.remove('cat-selected'); void $('#txCategoryLabel').offsetWidth; $('#txCategoryLabel').classList.add('cat-selected');
  }
  $('#closeCategoryModal').addEventListener('click', ()=>hideModal('#categoryModal'));
  $('#categoryModalBackdrop').addEventListener('click', ()=>hideModal('#categoryModal'));
  $('#txCategoryBtn').addEventListener('click', openCategoryPicker);

  function openManageCategoriesModal(){
    renderCustomCategoriesList();
    $('#newCategoryName').value = '';
    showModal('#manageCategoriesModal');
  }
  function renderCustomCategoriesList(){
    if (customCategories.length===0){
      $('#customCategoriesList').innerHTML = '<p class="text-[12.5px] text-center py-4" style="color:var(--text-faint);">No custom categories yet.</p>';
      return;
    }
    $('#customCategoriesList').innerHTML = customCategories.map((c,i)=>{
      return '<div class="flex items-center justify-between rounded-xl px-3.5 py-2.5 surface list-row row-enter" data-id="'+c.id+'" style="animation-delay:'+Math.min(i*35,280)+'ms;">' +
        '<span class="flex items-center gap-2 text-[13.5px] font-medium"><span class="w-3 h-3 rounded-full" style="background:'+c.color+';"></span>'+escapeHtml(c.label)+'</span>' +
        '<button aria-label="Delete category" class="delete-category-btn p-1.5 rounded-lg btn-ghost" data-id="'+c.id+'">'+iconSvg('trash',13)+'</button>' +
        '</div>';
    }).join('');
    $$('.delete-category-btn').forEach(b=>b.addEventListener('click', ()=>{
      openConfirm('Delete category?', 'Transactions already using it will show as "Deleted category".', 'category', b.dataset.id);
    }));
  }
  $('#btnManageCategories').addEventListener('click', openManageCategoriesModal);
  $('#closeManageCategories').addEventListener('click', ()=>hideModal('#manageCategoriesModal'));
  $('#manageCategoriesBackdrop').addEventListener('click', ()=>hideModal('#manageCategoriesModal'));
  $('#btnAddCategory').addEventListener('click', ()=>{
    const name = $('#newCategoryName').value.trim();
    const nameError = TD.validateCategoryName(name, allCategories().map(c=>c.label));
    if (nameError){ toast(nameError,'error'); return; }
    // kind 'both': a custom category can be used for income and for expenses.
    customCategories.push({ id: uid(), label:name, color:'#9C9689', icon:'tag', kind:'both', custom:true });
    saveCustomCategories();
    $('#newCategoryName').value = '';
    renderCustomCategoriesList();
    toast('Category added','success');
    const restore = flashSaved($('#btnAddCategory'), 'Added');
    setTimeout(restore, 320);
  });

  /* ============ ADD / EDIT TRANSACTION MODAL ============ */
  function setEditingType(type){
    state.editingType = type;
    $$('.type-toggle-btn').forEach(b=>{
      const active = b.dataset.type===type;
      b.style.color = active ? '#fff' : 'var(--text-dim)';
      b.style.background = active ? 'var(--accent)' : 'transparent';
      b.dataset.active = active?'1':'0';
    });
    $('#txModalTitle').textContent = state.editingId ? ('Edit '+(type==='expense'?'Expense':'Income')) : (type==='expense'?'Add Expense':'Add Income');
    $('#txModalSubtitle').textContent = type==='expense' ? 'Track money going out' : 'Track money coming in';
    $('#btnSaveTx').style.background = type==='expense' ? 'var(--neg)' : 'var(--pos)';
    // reset category selection if it no longer fits
    // the date picker only offers dates that pass validation (an expense cannot be in the future)
    $('#txDate').min = TD.LIMITS.MIN_DATE;
    $('#txDate').max = type==='expense' ? todayISO() : TD.addDaysISO(todayISO(), TD.LIMITS.MAX_FUTURE_INCOME_DAYS);
    const curId = $('#txCategoryBtn').dataset.categoryId;
    if (curId){
      const m = catMeta(curId);
      if (m.kind!=='both' && m.kind!==type){
        $('#txCategoryBtn').dataset.categoryId='';
        $('#txCategoryLabel').innerHTML = 'Choose <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        $('#txCategoryLabel').style.color = 'var(--text-faint)';
      }
    }
  }
  $$('.type-toggle-btn').forEach(b=>b.addEventListener('click', ()=>setEditingType(b.dataset.type)));

  function resetTxForm(keepCore){
    if (!keepCore){
      $('#txAmount').value='';
      $('#txDescription').value='';
      $('#txCategoryBtn').dataset.categoryId='';
      $('#txCategoryLabel').innerHTML = 'Choose <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
      $('#txCategoryLabel').style.color='var(--text-faint)';
      $('#txDate').value = todayISO();
    } else {
      $('#txAmount').value='';
      $('#txDescription').value='';
    }
    $('#txTags').value='';
    $('#txNotes').value='';
    $('#txFormError').textContent = '';
  }
  function openAddTxModal(type){
    state.editingId = null;
    resetTxForm(false);
    setEditingType(type||'expense');
    showModal('#txModal');
    setTimeout(()=>$('#txAmount').focus(),60);
  }
  function openEditTxModal(id){
    const t = state.transactions.find(x=>x.id===id);
    if (!t) return;
    state.editingId = id;
    $('#txFormError').textContent = '';
    setEditingType(t.type==='income'?'income':'expense');
    $('#txAmount').value = t.amount;
    $('#txDescription').value = t.description;
    $('#txDate').value = t.date;
    $('#txTags').value = (t.tags||[]).join(', ');
    $('#txNotes').value = t.notes || '';
    selectCategory(t.category);
    showModal('#txModal');
  }
  $('#closeTxModal').addEventListener('click', ()=>hideModal('#txModal'));
  $('#txModalBackdrop').addEventListener('click', ()=>hideModal('#txModal'));
  $('#btnCancelTx').addEventListener('click', ()=>hideModal('#txModal'));

  function readTxForm(){
    return {
      type: state.editingType,
      amount: $('#txAmount').value,            // kept as text, so "12.505" can be rejected instead of silently rounded
      description: $('#txDescription').value.trim(),
      date: $('#txDate').value,
      category: $('#txCategoryBtn').dataset.categoryId,
      tags: $('#txTags').value.split(',').map(s=>s.trim()).filter(Boolean),
      notes: $('#txNotes').value.trim(),
    };
  }
  /** Runs the shared validation rules (core.js); shows the first problem under the form. */
  function validateTxForm(f){
    const errors = TD.validateTransaction(f, { today: todayISO(), categories: allCategories() });
    $('#txFormError').textContent = errors.length ? errors[0] : '';
    return errors.length===0;
  }
  ['#txAmount','#txDescription','#txDate','#txTags','#txNotes'].forEach(sel=>$(sel).addEventListener('input', ()=>{ $('#txFormError').textContent=''; }));
  function saveTxFromForm(andNext, btn){
    const f = readTxForm();
    if (!validateTxForm(f)) return;
    const type = f.type;
    const amount = TD.checkAmount(f.amount).value;
    let msg;
    if (state.editingId){
      const t = state.transactions.find(x=>x.id===state.editingId);
      Object.assign(t, { type, amount, description:f.description, date:f.date, category:f.category, tags:f.tags, notes:f.notes });
      msg = 'Transaction updated';
    } else {
      state.transactions.push({ id:uid(), type, amount, description:f.description, date:f.date, category:f.category, tags:f.tags, notes:f.notes });
      msg = type==='expense'?'Expense added':'Income added';
    }
    saveTx();
    toast(msg,'success');
    const restore = btn ? flashSaved(btn) : null;
    setTimeout(()=>{
      if (restore) restore();
      if (andNext){
        resetTxForm(true);
        setTimeout(()=>$('#txAmount').focus(),30);
      } else {
        hideModal('#txModal');
      }
      refreshAfterTxChange();
    }, restore ? 380 : 0);
  }
  $('#btnSaveTx').addEventListener('click', ()=>saveTxFromForm(false, $('#btnSaveTx')));
  $('#btnSaveNext').addEventListener('click', ()=>saveTxFromForm(true, $('#btnSaveNext')));

  function refreshAfterTxChange(){
    if (state.page==='overview') renderOverview();
    if (state.page==='money'){
      if (state.moneySubtab==='transactions') renderTransactionsTab();
      if (state.moneySubtab==='insights') renderCharts();
      if (state.moneySubtab==='budget') renderBudgetTab();
    }
  }

  /* ============ TRANSACTIONS TAB ============ */
  function currentTxMonthKey(){ return addMonths(currentMonthKey(), state.monthOffset); }
  // Using the month arrows switches back from a custom From/To period to month view.
  function clearPeriod(){ state.filterFrom = ''; state.filterTo = ''; }
  $('#btnPrevMonth').addEventListener('click', ()=>{ clearPeriod(); state.monthOffset--; renderTransactionsTab(); });
  $('#btnNextMonth').addEventListener('click', ()=>{ clearPeriod(); state.monthOffset++; renderTransactionsTab(); });
  $$('.type-pill').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.typePill = b.dataset.typepill;
      $$('.type-pill').forEach(x=>x.classList.toggle('active', x===b));
      renderTransactionsTab();
    });
  });
  $('#btnSearchToggle').addEventListener('click', ()=>{
    $('#searchBarWrap').classList.toggle('hidden');
    if (!$('#searchBarWrap').classList.contains('hidden')) $('#searchInput').focus();
  });
  $('#searchInput').addEventListener('input', e=>{ state.search = e.target.value; renderTransactionsTab(); });
  $('#btnExportCsv').addEventListener('click', exportCSV);
  $('#btnExportCsvMore').addEventListener('click', exportCSV);
  $('#btnImportCsvMore').addEventListener('click', ()=>$('#importFileInput').click());

  /** The custom From/To period from the filter sheet, or null when the month view is used. */
  function activePeriod(){
    if (!state.filterFrom && !state.filterTo) return null;
    return { from: state.filterFrom, to: state.filterTo };
  }
  function periodLabel(p){
    if (p.from && p.to) return fmtDate(p.from)+' – '+fmtDate(p.to);
    return p.from ? 'From '+fmtDate(p.from) : 'Until '+fmtDate(p.to);
  }
  function getFilteredTx(){
    const ym = currentTxMonthKey();
    const period = activePeriod();
    return state.transactions
      .filter(t => period ? TD.inRange(t.date, period.from, period.to) : monthKey(t.date)===ym)
      .filter(t => state.typePill==='all' ? true : t.type===state.typePill)
      .filter(t => state.filterCategory==='all' || t.category===state.filterCategory)
      .filter(t => {
        if (!state.search) return true;
        const s = state.search.toLowerCase();
        return t.description.toLowerCase().includes(s) || (t.notes||'').toLowerCase().includes(s) ||
          catMeta(t.category).label.toLowerCase().includes(s) || (t.tags||[]).some(tag=>tag.toLowerCase().includes(s));
      })
      .sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }
  function renderTransactionsTab(){
    const ym = currentTxMonthKey();
    const period = activePeriod();
    $('#monthLabel').textContent = period ? periodLabel(period) : (ym===currentMonthKey() ? 'This Month' : monthLabelFor(ym));
    const list = getFilteredTx();
    $('#txEntryCount').textContent = list.length + (list.length===1?' entry':' entries');
    const container = $('#txList');
    const empty = $('#emptyTxState');
    if (list.length===0){
      container.innerHTML = '';
      empty.classList.remove('hidden'); empty.classList.add('flex');
      const typeWord = state.typePill==='income' ? 'income' : state.typePill==='all' ? 'transactions' : 'expenses';
      $('#emptyTxText').textContent = 'No '+typeWord+' recorded yet. Add your first entry above.';
    } else {
      empty.classList.add('hidden'); empty.classList.remove('flex');
      container.innerHTML = list.map((t,i)=>{
        const meta = catMeta(t.category);
        const isIncome = t.type==='income';
        const sign = isIncome?'+':'−';
        const color = isIncome?'var(--pos)':'var(--neg)';
        const tagsHtml = (t.tags&&t.tags.length) ? '<div class="flex flex-wrap gap-1 mt-1">'+t.tags.map(tg=>'<span class="text-[10px] px-1.5 py-0.5 rounded-full surface" style="color:var(--text-faint);">'+escapeHtml(tg)+'</span>').join('')+'</div>' : '';
        return '<div class="tx-row row-enter flex items-center gap-3 px-4 py-3.5" style="border-bottom:1px solid var(--border); animation-delay:'+Math.min(i*30,300)+'ms;" data-id="'+t.id+'">' +
          '<span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style="background:'+meta.color+';">'+iconSvg(meta.icon,16,'#fff')+'</span>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="text-[13.5px] font-medium truncate">'+escapeHtml(t.description||catMeta(t.category).label)+'</p>' +
            '<p class="text-[11.5px]" style="color:var(--text-faint);">'+escapeHtml(meta.label)+' · '+fmtDate(t.date)+'</p>' +
            tagsHtml +
          '</div>' +
          '<div class="flex flex-col items-end gap-1 shrink-0">' +
            '<span class="font-display font-semibold text-[13.5px] tabular" style="color:'+color+';">'+sign+fmtMoney(t.amount)+'</span>' +
            '<div class="flex items-center gap-1">' +
              '<button aria-label="Edit transaction" class="edit-tx-btn p-1 rounded-md btn-ghost" data-id="'+t.id+'">'+iconSvg('edit',12)+'</button>' +
              '<button aria-label="Delete transaction" class="delete-tx-btn p-1 rounded-md btn-ghost" data-id="'+t.id+'" style="color:var(--neg);">'+iconSvg('trash',12)+'</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      $$('.edit-tx-btn').forEach(b=>b.addEventListener('click', ()=>openEditTxModal(b.dataset.id)));
      $$('.delete-tx-btn').forEach(b=>b.addEventListener('click', ()=>openConfirm('Delete transaction?', "This can't be undone.", 'transaction', b.dataset.id)));
    }
    renderTxSummary();
  }

  /* ============ FILTER SHEET ============ */
  function populateFilterCategorySelect(){
    $('#filterCategorySelect').innerHTML = '<option value="all">All categories</option>' + allCategories().map(c=>'<option value="'+c.id+'">'+escapeHtml(c.label)+'</option>').join('');
    $('#filterCategorySelect').value = state.filterCategory;
  }
  $('#btnFilterSheet').addEventListener('click', ()=>{
    populateFilterCategorySelect();
    $('#filterFrom').value = state.filterFrom; $('#filterTo').value = state.filterTo;
    $('#filterError').textContent = '';
    showModal('#filterModal');
  });
  $('#closeFilterModal').addEventListener('click', ()=>hideModal('#filterModal'));
  $('#filterModalBackdrop').addEventListener('click', ()=>hideModal('#filterModal'));
  $('#btnApplyFilterSheet').addEventListener('click', ()=>{
    const from = $('#filterFrom').value, to = $('#filterTo').value;
    const rangeError = TD.validateDateRange(from, to);
    if (rangeError){ $('#filterError').textContent = rangeError; return; }
    state.filterCategory = $('#filterCategorySelect').value;
    state.filterFrom = from; state.filterTo = to;
    hideModal('#filterModal'); renderTransactionsTab();
  });
  $('#btnClearFilterSheet').addEventListener('click', ()=>{
    state.filterCategory='all'; clearPeriod();
    hideModal('#filterModal'); renderTransactionsTab();
  });

  /* ============ BUDGET ============ */
  function currentBudgetMonthKey(){ return addMonths(currentMonthKey(), state.budgetMonthOffset); }
  $('#btnBudgetPrevMonth').addEventListener('click', ()=>{ state.budgetMonthOffset--; renderBudgetTab(); });
  $('#btnBudgetNextMonth').addEventListener('click', ()=>{ state.budgetMonthOffset++; renderBudgetTab(); });

  function renderBudgetTab(){
    const ym = currentBudgetMonthKey();
    $('#budgetMonthLabel').textContent = monthLabelFor(ym);
    if (!state.budgets[ym]) state.budgets[ym] = {};
    const items = state.budgets[ym];
    const usedIds = Object.keys(items);
    const rowsEl = $('#budgetRows');
    const emptyEl = $('#budgetEmptyRow');
    if (usedIds.length===0){ rowsEl.innerHTML=''; emptyEl.classList.remove('hidden'); }
    else {
      emptyEl.classList.add('hidden');
      const spent = TD.spentByCategory(state.transactions, ym);
      rowsEl.innerHTML = usedIds.map((id,i)=>{
        const meta = catMeta(id);
        return '<div class="rounded-xl p-3.5 card list-row row-enter" style="animation-delay:'+Math.min(i*35,280)+'ms;" data-cat-id="'+id+'">' +
          '<div class="flex items-center gap-3">' +
            '<span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:'+meta.color+';">'+iconSvg(meta.icon,14,'#fff')+'</span>' +
            '<span class="text-[13.5px] font-medium flex-1 truncate">'+escapeHtml(meta.label)+'</span>' +
            '<span class="text-[13px]" style="color:var(--text-faint);">EUR</span>' +
            '<input type="number" min="0" max="1000000" step="0.01" class="budget-amount-input input-field rounded-lg px-2.5 py-1.5 text-[13.5px] w-24 text-right tabular" data-id="'+id+'" value="'+items[id]+'">' +
            '<button aria-label="Remove from budget" class="delete-budget-row p-1.5 rounded-lg btn-ghost" data-id="'+id+'">'+iconSvg('trash',13)+'</button>' +
          '</div>' +
          '<div class="mt-2.5"><div class="h-1.5 rounded-full overflow-hidden" style="background:var(--surface-hi);"><div class="h-full rounded-full" data-bar="'+id+'" style="width:0%;transition:width .4s ease;"></div></div>' +
          '<p class="text-[11.5px] mt-1.5" data-spent="'+id+'" style="color:var(--text-faint);"></p></div>' +
          '</div>';
      }).join('');
      const paintBar = id => {
        const budget = Number(items[id])||0, sp = spent[id]||0;
        const over = budget>0 ? sp>budget : sp>0;
        const pct = budget>0 ? Math.min(100, sp/budget*100) : (sp>0?100:0);
        const bar = rowsEl.querySelector('[data-bar="'+id+'"]'), txt = rowsEl.querySelector('[data-spent="'+id+'"]');
        if (!bar || !txt) return;
        bar.style.width = pct+'%';
        bar.style.background = over ? 'var(--neg)' : pct>=80 ? '#D98A2B' : 'var(--accent)';
        txt.textContent = fmtMoneyRound(sp)+' spent'+(budget>0 ? ' of '+fmtMoneyRound(budget)+(over ? ' · over by '+fmtMoneyRound(sp-budget) : ' · '+fmtMoneyRound(budget-sp)+' left') : '');
        txt.style.color = over ? 'var(--neg)' : 'var(--text-faint)';
      };
      usedIds.forEach(paintBar);
      $$('.budget-amount-input').forEach(inp=>inp.addEventListener('input', e=>{
        const id = e.target.dataset.id;
        const r = TD.checkBudgetAmount(e.target.value);
        e.target.style.borderColor = r.error ? 'var(--neg)' : '';
        e.target.title = r.error || '';
        if (r.error) return;               // invalid value: keep the old budget and mark the field red
        items[id] = r.value;
        saveBudgets(); paintBar(id); updateBudgetTotal();
      }));
      $$('.delete-budget-row').forEach(b=>b.addEventListener('click', ()=>{
        const id = b.dataset.id;
        const row = document.querySelector('#budgetRows [data-cat-id="'+id+'"]');
        const finish = ()=>{ delete items[id]; saveBudgets(); renderBudgetTab(); };
        if (row){ row.classList.add('row-exit'); row.addEventListener('animationend', finish, {once:true}); } else finish();
      }));
    }
    const remaining = allCategories().filter(c=>c.kind!=='income' && !usedIds.includes(c.id));
    $('#addCategoriesList').innerHTML = remaining.map(c=>{
      return '<button type="button" class="add-budget-cat-chip surface rounded-full px-3 py-1.5 text-[12.5px] font-medium flex items-center gap-1.5" data-id="'+c.id+'">'+iconSvg('plus',11)+escapeHtml(c.label)+'</button>';
    }).join('');
    $$('.add-budget-cat-chip').forEach(b=>b.addEventListener('click', ()=>{
      items[b.dataset.id] = 0;
      saveBudgets();
      renderBudgetTab();
    }));
    updateBudgetTotal(true);
  }
  function updateBudgetTotal(animate){
    const ym = currentBudgetMonthKey();
    const items = state.budgets[ym] || {};
    const total = Object.values(items).reduce((a,b)=>a+(Number(b)||0),0);
    if (animate) animateNumber($('#budgetTotal'), 0, total, fmtMoneyRound, 550);
    else $('#budgetTotal').textContent = fmtMoneyRound(total);
  }
  $('#toggleAddCategories').addEventListener('click', ()=>{
    $('#addCategoriesList').classList.toggle('hidden');
  });
  $('#btnSaveBudget').addEventListener('click', ()=>{
    saveBudgets();
    toast('Budget saved','success');
    const restore = flashSaved($('#btnSaveBudget'), 'Saved');
    setTimeout(restore, 700);
  });
  $('#btnAutoSuggestBudget').addEventListener('click', ()=>{
    const ym = currentBudgetMonthKey();
    if (!state.budgets[ym]) state.budgets[ym] = {};
    const items = state.budgets[ym];
    const months = [addMonths(ym,-1), addMonths(ym,-2), addMonths(ym,-3)];
    const sums = {}; const counts = {};
    state.transactions.filter(t=>t.type==='expense' && months.includes(monthKey(t.date))).forEach(t=>{
      sums[t.category] = (sums[t.category]||0) + t.amount;
    });
    let added = 0;
    Object.keys(sums).forEach(catId=>{
      if (items[catId] !== undefined) return;
      const avg = sums[catId] / 3;
      if (avg > 0){ items[catId] = Math.round(avg/50)*50; added++; }
    });
    if (added===0){ toast('Not enough history yet to suggest a budget','default'); return; }
    saveBudgets();
    renderBudgetTab();
    toast('Suggested budgets for '+added+' categor'+(added===1?'y':'ies'),'success');
  });
  $('#btnCopyLastMonth').addEventListener('click', ()=>{
    const ym = currentBudgetMonthKey();
    const prevYm = addMonths(ym,-1);
    const prevBudget = state.budgets[prevYm];
    if (!prevBudget || Object.keys(prevBudget).length===0){ toast('No budget found for last month','error'); return; }
    if (!state.budgets[ym]) state.budgets[ym] = {};
    const items = state.budgets[ym];
    let added=0;
    Object.keys(prevBudget).forEach(id=>{ if (items[id]===undefined){ items[id]=prevBudget[id]; added++; } });
    saveBudgets();
    renderBudgetTab();
    toast(added>0 ? 'Copied '+added+' categor'+(added===1?'y':'ies')+' from last month' : 'Already up to date','success');
  });


  /* ============ INSIGHTS (charts by category over a period) ============ */
  function defaultInsightRange(){
    const t = todayISO();
    return { from: t.slice(0,7) + '-01', to: t };
  }
  function setInsightRange(from, to){
    state.insightFrom = from; state.insightTo = to;
    $('#insightFrom').value = from; $('#insightTo').value = to;
  }
  function quickRange(kind){
    const t = todayISO();
    if (kind==='month') return { from: t.slice(0,7)+'-01', to: t };
    if (kind==='3months') return { from: addMonths(t.slice(0,7), -2)+'-01', to: t };
    return { from: t.slice(0,4)+'-01-01', to: t };
  }
  function insightPeriodText(){
    return fmtDate(state.insightFrom)+' – '+fmtDate(state.insightTo);
  }
  let lastLegend = [];
  function renderCharts(){
    if (!state.insightFrom){ const r = defaultInsightRange(); setInsightRange(r.from, r.to); }
    $$('.insight-type-btn').forEach(b=>{ b.dataset.active = b.dataset.insightType===state.insightType ? '1' : '0'; });

    const err = (!state.insightFrom || !state.insightTo) ? 'Pick both the From and To date.' : TD.validateDateRange(state.insightFrom, state.insightTo);
    $('#insightError').textContent = err || '';
    if (err){ Charts.destroyAll(); return; }

    const isExpense = state.insightType==='expense';
    $('#categoryChartTitle').textContent = isExpense ? 'Expenses by category' : 'Income by category';
    $('#categoryChartSub').textContent = insightPeriodText();
    $('#trendChartSub').textContent = insightPeriodText();

    const byCat = TD.totalsByCategory(state.transactions, state.insightType, state.insightFrom, state.insightTo);
    const catIds = Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]);
    const items = catIds.map(id=>({ label:catMeta(id).label, color:catMeta(id).color, value:byCat[id] }));
    const donutCanvas = $('#categoryChart'), donutEmpty = $('#donutEmpty');
    const drawn = Charts.drawCategory(donutCanvas, items, fmtMoney);
    if (!drawn){
      donutCanvas.style.display='none'; donutEmpty.classList.remove('hidden'); donutEmpty.classList.add('flex');
      $('#categoryLegend').innerHTML='';
    } else {
      donutCanvas.style.display='block'; donutEmpty.classList.add('hidden'); donutEmpty.classList.remove('flex');
      const total = items.reduce((a,i)=>a+i.value,0);
      $('#categoryLegend').innerHTML = items.map(i=>{
        const pct = total ? Math.round((i.value/total)*100) : 0;
        return '<div class="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2 py-1 rounded-full" style="background:'+hexToRgba(i.color,0.12)+'; color:var(--text-dim);">'+
          '<span class="w-2 h-2 rounded-full shrink-0" style="background:'+i.color+';"></span><span>'+escapeHtml(i.label)+'</span>'+
          '<span style="color:var(--text-faint);">'+fmtMoney(i.value)+' · '+pct+'%</span></div>';
      }).join('');
    }
    lastLegend = items.map(i=>({ label:i.label+' '+fmtMoney(i.value), color:i.color }));

    const months = TD.monthsInRange(state.insightFrom, state.insightTo, 24);
    const totals = TD.monthlyTotals(state.transactions.filter(t=>TD.inRange(t.date, state.insightFrom, state.insightTo)), months);
    Charts.drawTrend($('#trendChart'), months.map(m=>new Date(m+'-02').toLocaleDateString('lv-LV',{month:'short', year:'2-digit'})),
      totals.map(x=>x.income), totals.map(x=>x.expense), fmtMoney);
  }

  $$('.insight-type-btn').forEach(b=>b.addEventListener('click', ()=>{ state.insightType = b.dataset.insightType; renderCharts(); }));
  $$('.insight-range').forEach(b=>b.addEventListener('click', ()=>{ const r = quickRange(b.dataset.insightRange); setInsightRange(r.from, r.to); renderCharts(); }));
  ['#insightFrom','#insightTo'].forEach(sel=>$(sel).addEventListener('change', ()=>{
    state.insightFrom = $('#insightFrom').value; state.insightTo = $('#insightTo').value; renderCharts();
  }));
  function savePng(which, nameBase, title, sub){
    const ok = Charts.savePng(which, nameBase+'-'+todayISO()+'.png', title, sub, which==='category' ? lastLegend : []);
    toast(ok ? 'Chart saved as image' : 'Nothing to save yet', ok ? 'success' : 'error');
  }
  $('#btnSaveCategoryPng').addEventListener('click', ()=>savePng('category', 'category-chart', $('#categoryChartTitle').textContent, insightPeriodText()));
  $('#btnSaveTrendPng').addEventListener('click', ()=>savePng('trend', 'income-vs-expenses', 'Income vs expenses', insightPeriodText()));

  /* ============ CSV ============ */
  function downloadFile(name, content, type){
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function exportCSV(){
    if (state.transactions.length===0){ toast('No transactions to export','error'); return; }
    downloadFile('budget-planner-transactions-'+todayISO()+'.csv', '\uFEFF'+TD.buildCSV(state.transactions, id=>catMeta(id).label), 'text/csv;charset=utf-8;');
    toast('CSV exported (transactions only)','success');
  }
  $('#importFileInput').addEventListener('change', e=>{
    const file = e.target.files[0]; e.target.value='';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = ()=>toast('Could not read that file','error');
    reader.onload = ev=>{
      try{
        const res = TD.importTransactions(String(ev.target.result), allCategories(), state.transactions, uid, todayISO());
        if (res.added.length){ state.transactions.push(...res.added); saveTx(); refreshAfterTxChange(); }
        const notes = [];
        if (res.duplicates) notes.push(res.duplicates+' duplicate'+(res.duplicates===1?'':'s')+' skipped');
        if (res.invalid) notes.push(res.invalid+' invalid row'+(res.invalid===1?'':'s')+' skipped');
        const extra = notes.length ? ' ('+notes.join(', ')+')' : '';
        if (res.added.length) toast(res.added.length+' transaction'+(res.added.length===1?'':'s')+' imported'+extra,'success');
        else toast(notes.length ? 'Nothing imported'+extra : 'No valid rows found','error');
      } catch(err){ toast('Could not parse that CSV file','error'); }
    };
    reader.readAsText(file);
  });

  /* ============ JSON EXPORT / RESTORE ============ */
  let pendingRestore = null;
  function buildBackup(){
    return { app:'budget-planner', version:1, exportedAt:new Date().toISOString(), transactions:state.transactions, budgets:state.budgets, customCategories };
  }
  function applyBackup(b){
    state.transactions = b.transactions; state.budgets = b.budgets; customCategories = b.customCategories;
    saveTx(); saveBudgets(); saveCustomCategories();
    renderOverview(); refreshAfterTxChange();
    toast('Backup restored','success');
  }
  function askRestore(b, sourceLabel){
    if (!TD.validateBackup(b)){ toast('That is not a valid Budget Planner backup','error'); return; }
    pendingRestore = b;
    openConfirm('Restore this backup?', sourceLabel+' has '+b.transactions.length+' transactions. This replaces everything currently in the app.', 'restore', null, 'Restore');
  }
  function exportJSON(){
    downloadFile('budget-planner-backup-'+todayISO()+'.json', JSON.stringify(buildBackup(), null, 2), 'application/json');
    toast('JSON exported','success');
  }
  $('#btnBackupJson').addEventListener('click', exportJSON);
  $('#btnRestoreJson').addEventListener('click', ()=>$('#restoreFileInput').click());
  $('#restoreFileInput').addEventListener('change', e=>{
    const file = e.target.files[0]; e.target.value='';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = ()=>toast('Could not read that file','error');
    reader.onload = ev=>{
      let data;
      try { data = JSON.parse(String(ev.target.result)); } catch(err){ toast('That file is not valid JSON','error'); return; }
      askRestore(data, 'This backup');
    };
    reader.readAsText(file);
  });

  /* ============ FAB MENU ============ */
  function closeFabMenu(){
    $('#fabMenu').classList.add('hidden');
    $('#fab').classList.remove('open');
    $('#fabMenuBackdrop').style.opacity = '0';
    setTimeout(()=>{ if($('#fab').classList.contains('open')) return; $('#fabMenuBackdrop').classList.add('hidden'); }, 180);
  }
  function openFabMenu(){
    $('#fabMenu').classList.remove('hidden');
    $('#fab').classList.add('open');
    $('#fabMenuBackdrop').classList.remove('hidden');
    requestAnimationFrame(()=>{ $('#fabMenuBackdrop').style.opacity = '1'; });
  }
  $('#fab').addEventListener('click', ()=>{
    if ($('#fabMenu').classList.contains('hidden')) openFabMenu(); else closeFabMenu();
  });
  $('#fabMenuBackdrop').addEventListener('click', closeFabMenu);
  $$('.fab-item').forEach(b=>b.addEventListener('click', ()=>{
    const action = b.dataset.fabAction;
    closeFabMenu();
    if (action==='add-expense'){ goToPage('money'); goToMoneySubtab('transactions'); openAddTxModal('expense'); }
    else if (action==='add-income'){ goToPage('money'); goToMoneySubtab('transactions'); openAddTxModal('income'); }
    else if (action==='import-csv'){ $('#importFileInput').click(); }
  }));
  document.addEventListener('click', e=>{
    if (!$('#fabMenu').contains(e.target) && e.target.closest('#fab')===null) closeFabMenu();
  });

  /* ============ RIPPLE EFFECT ============ */
  document.addEventListener('click', e=>{
    const target = e.target.closest('.btn-primary, .btn-soft, #fab');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size+'px';
    span.style.left = (e.clientX - rect.left - size/2)+'px';
    span.style.top = (e.clientY - rect.top - size/2)+'px';
    target.appendChild(span);
    setTimeout(()=>span.remove(), 550);
  });

  /* ============ CONFIRM MODAL ============ */
  function openConfirm(title, sub, type, id, okLabel){
    state.pendingDelete = { type, id };
    $('#confirmOk').textContent = okLabel || 'Delete';
    $('#confirmTitle').textContent = title;
    $('#confirmSub').textContent = sub;
    showModal('#confirmModal');
  }
  $('#confirmOk').addEventListener('click', ()=>{
    const pd = state.pendingDelete;
    if (pd){
      if (pd.type==='transaction'){
        const row = document.querySelector('.tx-row[data-id="'+pd.id+'"]');
        const finish = ()=>{ state.transactions = state.transactions.filter(t=>t.id!==pd.id); saveTx(); refreshAfterTxChange(); toast('Transaction deleted','default'); };
        if (row){ row.classList.add('row-exit'); row.addEventListener('animationend', finish, {once:true}); } else finish();
      } else if (pd.type==='category'){
        const finish = ()=>{
          customCategories = customCategories.filter(c=>c.id!==pd.id); saveCustomCategories();
          renderCustomCategoriesList();
          toast('Category deleted','default');
        };
        animateRowsOutThenRun(pd.id, ['#customCategoriesList .list-row'], finish);
      } else if (pd.type==='restore'){
        if (pendingRestore){ applyBackup(pendingRestore); pendingRestore = null; }
      } else if (pd.type==='reset-all'){
        state.transactions=[]; state.budgets={};
        saveTx(); saveBudgets();
        renderOverview(); refreshAfterTxChange();
        toast('All data has been reset','default');
      }
    }
    state.pendingDelete = null;
    hideModal('#confirmModal');
  });
  function animateRowsOutThenRun(dataId, selectors, callback){
    const rows = document.querySelectorAll(selectors.map(s=>s+'[data-id="'+dataId+'"]').join(','));
    if (rows.length===0){ callback(); return; }
    rows.forEach(r=>r.classList.add('row-exit'));
    setTimeout(callback, 260);
  }
  $('#confirmCancel').addEventListener('click', ()=>{ pendingRestore = null; hideModal('#confirmModal'); });
  $('#confirmModalBackdrop').addEventListener('click', ()=>{ pendingRestore = null; hideModal('#confirmModal'); });
  $('#btnResetMore').addEventListener('click', ()=>openConfirm('Reset all data?', 'This deletes every transaction and budget permanently.', 'reset-all', null));

  /* ============ MODAL HELPERS ============ */
  function showModal(sel){
    const m=$(sel); m.classList.remove('hidden'); m.classList.add('flex'); document.body.style.overflow='hidden';
    if (sel==='#txModal'){
      $$('#txFormScroll .form-section').forEach(el=>{ el.classList.remove('form-section'); void el.offsetWidth; el.classList.add('form-section'); });
    }
  }
  function hideModal(sel){ const m=$(sel); m.classList.add('hidden'); m.classList.remove('flex'); document.body.style.overflow=''; }

  /* ============ THEME BUTTONS ============ */
  $('#themeToggleBtn').addEventListener('click', toggleTheme);
  $('#btnThemeMore').addEventListener('click', toggleTheme);
  $('#btnThemeSide').addEventListener('click', toggleTheme);
  $('#btnLogoutMore').addEventListener('click', signOut);
  $('#btnLogoutSide').addEventListener('click', signOut);
  $('#btnSideAddExpense').addEventListener('click', ()=>{ goToPage('money'); goToMoneySubtab('transactions'); openAddTxModal('expense'); });
  $('#btnSideAddIncome').addEventListener('click', ()=>{ goToPage('money'); goToMoneySubtab('transactions'); openAddTxModal('income'); });



  /* ============ SIGN-IN ============ */
  function showGate(){ const g=$('#authGate'); g.classList.remove('hidden'); g.classList.add('flex'); }
  function hideGate(){ const g=$('#authGate'); g.classList.add('hidden'); g.classList.remove('flex'); }
  let appStarted = false;
  function startApp(){
    hideGate();
    if (appStarted){ goToPage('overview'); return; }
    appStarted = true;
    loadAll();
    renderGreeting();
    goToPage('overview');
  }
  function signOut(){
    Auth.logout();
    Charts.destroyAll();
    $$('#txModal,#categoryModal,#manageCategoriesModal,#filterModal,#confirmModal').forEach(m=>{ m.classList.add('hidden'); m.classList.remove('flex'); });
    document.body.style.overflow = '';
    $('#authUsername').value = ''; $('#authPassword').value = ''; $('#authMsg').textContent = '';
    showGate();
    $('#authUsername').focus();
  }
  $('#authForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const username = $('#authUsername').value, password = $('#authPassword').value;
    const formError = TD.validateLoginInput(username, password);
    if (formError){ $('#authMsg').textContent = formError; return; }
    const btn = $('#btnAuthSignIn'); btn.disabled = true;
    const result = await Auth.login(username, password);
    btn.disabled = false;
    if (!result.ok){ $('#authMsg').textContent = result.error; $('#authPassword').select(); return; }
    $('#authMsg').textContent = '';
    startApp();
  });


  /* ============ INIT ============ */
  function init(){
    applyTheme(DataStore.getTheme());
    document.addEventListener('keydown', e=>{
      if (e.key==='Escape'){
        ['#txModal','#categoryModal','#manageCategoriesModal','#filterModal','#confirmModal'].forEach(hideModal);
        closeFabMenu();
      }
    });
    if (Auth.isLoggedIn()) startApp(); else showGate();
  }
  init();
})();
