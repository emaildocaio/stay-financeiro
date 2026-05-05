// =====================================================
// STAY ARRAIAL — Dashboard Financeiro
// =====================================================

const SUPABASE_URL = 'https://zoqrmshnysdfxhcoulql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcXJtc2hueXNkZnhoY291bHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQyMjMsImV4cCI6MjA4ODU4MDIyM30.NQqvqxEEb3sz3Qx7RT_CGloFcvwhWuWI3NCsgZ-ZHFY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Paleta para gráficos
const COLORS = {
  azulProfundo: '#0c4a6e',
  turquesa: '#06b6d4',
  turquesa2: '#0891b2',
  areia: '#fde68a',
  coral: '#fb7185',
  coral2: '#f43f5e',
  ink: '#0f172a',
  ink3: '#64748b',
  line: '#e2e8f0',
};

const CATEGORY_COLORS = {
  'Condomínio': '#0c4a6e',
  'Luz': '#fbbf24',
  'Internet': '#3b82f6',
  'Manutenção': '#dc2626',
  'Compras': '#9333ea',
  'Materiais de Limpeza': '#10b981',
  'Lavanderia': '#06b6d4',
  'Faxina': '#0891b2',
  'Impostos DAS': '#7f1d1d',
  'Contador': '#92400e',
  'Co-Host Airbnb': '#FF5A5F',
  'Co-Host Booking': '#003580',
  'Stays Mensalidade': '#1e293b',
  'Stays Comissão': '#475569',
  'PriceLabs/Beyond Comissão': '#64748b',
};

// Estado global
const state = {
  resumoMensal: [],
  resumoApto: [],
  despesasCategoria: [],
  reservas: [],
  apartamentos: [],
  syncLog: null,
  charts: {},
};

// =====================================================
// UTILS
// =====================================================
const fmt = {
  brl: (v) => 'R$ ' + (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  brlFull: (v) => 'R$ ' + (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (v) => (v ?? 0).toFixed(1).replace('.', ',') + '%',
  mes: (yyyymm) => {
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const [y, m] = yyyymm.split('-');
    return `${meses[+m - 1]}/${y.slice(2)}`;
  },
  data: (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  },
};

function isFuture(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') > new Date();
}

// =====================================================
// DATA FETCHING
// =====================================================
async function fetchAll() {
  try {
    const [resumo, resumoApto, despCat, reservas, aptos, syncLog] = await Promise.all([
      sb.from('dash_v_resumo_mensal').select('*').order('mes', { ascending: true }),
      sb.from('dash_v_resumo_mensal_apto').select('*').order('mes', { ascending: true }),
      sb.from('dash_v_despesas_categoria').select('*').order('mes', { ascending: true }),
      sb.from('dash_v_reservas').select('*').order('check_in', { ascending: false }),
      sb.from('dash_apartamentos').select('*').order('codigo'),
      sb.from('dash_sync_log').select('*').order('id', { ascending: false }).limit(1),
    ]);

    if (resumo.error) throw new Error('resumo: ' + resumo.error.message);
    if (resumoApto.error) throw new Error('resumoApto: ' + resumoApto.error.message);
    if (despCat.error) throw new Error('despCat: ' + despCat.error.message);
    if (reservas.error) throw new Error('reservas: ' + reservas.error.message);
    if (aptos.error) throw new Error('aptos: ' + aptos.error.message);

    state.resumoMensal = resumo.data || [];
    state.resumoApto = resumoApto.data || [];
    state.despesasCategoria = despCat.data || [];
    state.reservas = reservas.data || [];
    state.apartamentos = aptos.data || [];
    state.syncLog = syncLog.data?.[0] || null;
    
    return true;
  } catch (e) {
    console.error('Erro ao buscar dados:', e);
    showError(e.message);
    return false;
  }
}

function showError(msg) {
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = `Erro ao carregar dados: ${msg}`;
  document.querySelector('.container').prepend(banner);
}

// =====================================================
// SYNC STATUS
// =====================================================
function renderSyncStatus() {
  const text = document.getElementById('syncText');
  const footerSync = document.getElementById('footerSync');
  
  if (!state.syncLog) {
    text.textContent = 'Sync não executado';
    footerSync.textContent = 'Sync: nunca';
    return;
  }
  
  const dt = new Date(state.syncLog.started_at);
  const dtStr = dt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  const statusEmoji = state.syncLog.status === 'success' ? '✓' : '⚠';
  text.textContent = `Sync ${statusEmoji} ${dtStr}`;
  footerSync.textContent = `Último sync: ${dtStr} · ${state.syncLog.reservations_fetched || 0} reservas`;
}

// =====================================================
// VISÃO GERAL
// =====================================================
function renderOverview() {
  // Filtrar últimos 12 meses por padrão
  const data = state.resumoMensal.filter(r => {
    const mesDate = new Date(r.mes);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    return mesDate >= cutoff;
  });

  // YTD (ano corrente)
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const ytd = state.resumoMensal.filter(r => new Date(r.mes) >= yearStart);
  
  const sumYtd = (key) => ytd.reduce((acc, r) => acc + Number(r[key] || 0), 0);
  
  const recYtd = sumYtd('receita_liquida');
  const despYtd = sumYtd('despesas_total');
  const resYtd = sumYtd('resultado');
  const recPosPlat = sumYtd('receita_pos_plataforma');
  const margemYtd = recPosPlat > 0 ? (resYtd / recPosPlat) * 100 : 0;
  
  document.getElementById('kpiReceitaYtd').textContent = fmt.brl(recYtd);
  document.getElementById('kpiReceitaYtdSub').textContent = `${ytd.reduce((a, r) => a + r.qty_reservas, 0)} reservas`;
  
  document.getElementById('kpiDespesaYtd').textContent = fmt.brl(despYtd);
  document.getElementById('kpiDespesaYtdSub').textContent = `${ytd.length} ${ytd.length === 1 ? 'mês' : 'meses'} de operação`;
  
  document.getElementById('kpiResultadoYtd').textContent = fmt.brl(resYtd);
  const resSub = document.getElementById('kpiResultadoYtdSub');
  resSub.textContent = resYtd >= 0 ? '↗ Resultado positivo' : '↘ Resultado negativo';
  resSub.className = 'kpi-sub ' + (resYtd >= 0 ? 'up' : 'down');
  
  document.getElementById('kpiMargemYtd').textContent = fmt.pct(margemYtd);
  document.getElementById('kpiMargemYtdSub').textContent = `R$ ${(resYtd / Math.max(ytd.length, 1)).toLocaleString('pt-BR', {maximumFractionDigits: 0})}/mês`;
  
  // Co-host pendente
  const cohostPendente = ytd.reduce((acc, r) => acc + Number(r.cohost_booking_pendente || 0), 0);
  if (cohostPendente > 0) {
    const futureBookings = state.reservas.filter(r => 
      r.partner === 'booking' && isFuture(r.check_out)
    );
    document.getElementById('cohostAlert').hidden = false;
    document.getElementById('cohostAlertText').textContent = 
      `${fmt.brlFull(cohostPendente)} a pagar a co-anfitrião sobre reservas Booking com checkout futuro ou recente.`;
  }
  
  renderResumoTable(data);
  renderChartReceitaDespesa(data);
}

function renderResumoTable(data) {
  const tbody = document.getElementById('resumoTbody');
  tbody.innerHTML = '';
  
  let totQty = 0, totRec = 0, totCom = 0, totCo = 0, totDesp = 0, totRes = 0;
  
  data.forEach(r => {
    const tr = document.createElement('tr');
    const resCls = r.resultado >= 0 ? 'cell-positive' : 'cell-negative';
    tr.innerHTML = `
      <td class="cell-mes">${fmt.mes(r.mes.slice(0, 7))}</td>
      <td class="num">${r.qty_reservas}</td>
      <td class="num">${fmt.brl(r.receita_bruta)}</td>
      <td class="num">${fmt.brl(r.comissao_plataforma)}</td>
      <td class="num">${fmt.brl(r.cohost_total)}</td>
      <td class="num">${fmt.brl(r.despesas_operacionais)}</td>
      <td class="num ${resCls}"><strong>${fmt.brl(r.resultado)}</strong></td>
      <td class="num">${fmt.pct(r.margem_pct)}</td>
    `;
    tbody.appendChild(tr);
    
    totQty += r.qty_reservas;
    totRec += Number(r.receita_bruta);
    totCom += Number(r.comissao_plataforma);
    totCo += Number(r.cohost_total);
    totDesp += Number(r.despesas_operacionais);
    totRes += Number(r.resultado);
  });
  
  // Totalizador
  const totRecPos = totRec - totCom;
  const totMargem = totRecPos > 0 ? (totRes / totRecPos * 100) : 0;
  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  totRow.innerHTML = `
    <td>Total</td>
    <td class="num">${totQty}</td>
    <td class="num">${fmt.brl(totRec)}</td>
    <td class="num">${fmt.brl(totCom)}</td>
    <td class="num">${fmt.brl(totCo)}</td>
    <td class="num">${fmt.brl(totDesp)}</td>
    <td class="num ${totRes >= 0 ? 'cell-positive' : 'cell-negative'}">${fmt.brl(totRes)}</td>
    <td class="num">${fmt.pct(totMargem)}</td>
  `;
  tbody.appendChild(totRow);
}

function renderChartReceitaDespesa(data) {
  const ctx = document.getElementById('chartReceitaDespesa').getContext('2d');
  if (state.charts.receitaDespesa) state.charts.receitaDespesa.destroy();
  
  const labels = data.map(r => fmt.mes(r.mes.slice(0, 7)));
  const receitas = data.map(r => Number(r.receita_pos_plataforma));
  const despesas = data.map(r => Number(r.despesas_total));
  const resultado = data.map(r => Number(r.resultado));
  
  state.charts.receitaDespesa = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Receita pós-plataforma',
          data: receitas,
          backgroundColor: COLORS.turquesa + 'cc',
          borderColor: COLORS.turquesa,
          borderWidth: 0,
          borderRadius: 4,
        },
        {
          label: 'Despesas total',
          data: despesas,
          backgroundColor: COLORS.coral + 'cc',
          borderColor: COLORS.coral,
          borderWidth: 0,
          borderRadius: 4,
        },
        {
          label: 'Resultado',
          data: resultado,
          type: 'line',
          borderColor: COLORS.azulProfundo,
          backgroundColor: COLORS.azulProfundo,
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'white',
          pointBorderWidth: 2,
        }
      ]
    },
    options: chartOptions(),
  });
}

// =====================================================
// POR APARTAMENTO
// =====================================================
function renderApartamentos() {
  const grid = document.getElementById('aptGrid');
  grid.innerHTML = '';
  
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  
  state.apartamentos.forEach(apt => {
    const aptData = state.resumoApto.filter(
      r => r.apartamento === apt.codigo && new Date(r.mes) >= yearStart
    );
    
    const recBruta = aptData.reduce((a, r) => a + Number(r.receita_bruta || 0), 0);
    const recLiq = aptData.reduce((a, r) => a + Number(r.receita_liquida || 0), 0);
    const desp = aptData.reduce((a, r) => a + Number(r.despesas_diretas || 0), 0);
    const resultado = recLiq - desp;
    const qty = aptData.reduce((a, r) => a + r.qty_reservas, 0);
    
    const card = document.createElement('div');
    card.className = 'apt-card';
    card.innerHTML = `
      <div class="apt-card-header">
        <span class="apt-codigo">${apt.codigo}</span>
        <span class="apt-predio">${apt.stays_external_id}</span>
      </div>
      <div class="apt-stat">
        <span class="apt-stat-label">Receita líquida YTD</span>
        <span class="apt-stat-value highlight">${fmt.brl(recLiq)}</span>
      </div>
      <div class="apt-stat">
        <span class="apt-stat-label">Despesas diretas</span>
        <span class="apt-stat-value">${fmt.brl(desp)}</span>
      </div>
      <div class="apt-stat">
        <span class="apt-stat-label">Resultado direto</span>
        <span class="apt-stat-value ${resultado >= 0 ? 'cell-positive' : 'cell-negative'}">${fmt.brl(resultado)}</span>
      </div>
      <div class="apt-stat">
        <span class="apt-stat-label">Reservas YTD</span>
        <span class="apt-stat-value">${qty}</span>
      </div>
    `;
    grid.appendChild(card);
  });
  
  renderChartAptos();
}

function renderChartAptos() {
  const ctx = document.getElementById('chartAptos').getContext('2d');
  if (state.charts.aptos) state.charts.aptos.destroy();
  
  // Últimos 12 meses
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const data12m = state.resumoApto.filter(r => new Date(r.mes) >= cutoff);
  
  const meses = [...new Set(data12m.map(r => r.mes))].sort();
  const labels = meses.map(m => fmt.mes(m.slice(0, 7)));
  
  const aptColors = {
    'IV203': COLORS.azulProfundo,
    'IV204': COLORS.turquesa,
    'BA201': COLORS.coral,
    'BA203': '#92400e',
    'BA204': '#7c3aed',
  };
  
  const datasets = state.apartamentos.map(apt => ({
    label: apt.codigo,
    data: meses.map(mes => {
      const r = data12m.find(x => x.apartamento === apt.codigo && x.mes === mes);
      return r ? Number(r.receita_pos_plataforma) : 0;
    }),
    borderColor: aptColors[apt.codigo] || COLORS.ink3,
    backgroundColor: (aptColors[apt.codigo] || COLORS.ink3) + '20',
    tension: 0.3,
    borderWidth: 2.5,
    pointRadius: 3,
    pointHoverRadius: 5,
  }));
  
  state.charts.aptos = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions(),
  });
}

// =====================================================
// DESPESAS
// =====================================================
function renderDespesas() {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const ytd = state.despesasCategoria.filter(r => new Date(r.mes) >= yearStart);
  
  // Agregação por categoria
  const porCategoria = {};
  ytd.forEach(r => {
    porCategoria[r.categoria] = (porCategoria[r.categoria] || 0) + Number(r.total);
  });
  
  // Filtrar lançamentos substituidos não estão nas categorias (já tratados pela view)
  const sortedCats = Object.entries(porCategoria)
    .map(([cat, val]) => ({ cat, val }))
    .sort((a, b) => b.val - a.val);
  
  // Pizza
  const pieCtx = document.getElementById('chartDespesasPie').getContext('2d');
  if (state.charts.pie) state.charts.pie.destroy();
  state.charts.pie = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: sortedCats.map(x => x.cat),
      datasets: [{
        data: sortedCats.map(x => x.val),
        backgroundColor: sortedCats.map(x => CATEGORY_COLORS[x.cat] || COLORS.ink3),
        borderWidth: 2,
        borderColor: 'white',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { family: 'Inter', size: 11 },
            padding: 12,
            boxWidth: 12,
          }
        },
        tooltip: tooltipConfig(),
      }
    }
  });
  
  // Top 5
  const ranking = document.getElementById('rankingCategorias');
  ranking.innerHTML = '';
  const total = sortedCats.reduce((a, c) => a + c.val, 0);
  sortedCats.slice(0, 5).forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'ranking-item';
    li.innerHTML = `
      <span class="ranking-pos">${String(i + 1).padStart(2, '0')}</span>
      <div class="ranking-info">
        <span class="ranking-cat">${c.cat}</span>
        <span class="ranking-meta">${(c.val / total * 100).toFixed(1)}% das despesas</span>
      </div>
      <span class="ranking-value">${fmt.brl(c.val)}</span>
    `;
    ranking.appendChild(li);
  });
  
  // Stack chart por mês
  const meses = [...new Set(state.despesasCategoria.map(r => r.mes))].sort().slice(-12);
  const labels = meses.map(m => fmt.mes(m.slice(0, 7)));
  const cats = sortedCats.slice(0, 7).map(x => x.cat);
  
  const datasets = cats.map(cat => ({
    label: cat,
    data: meses.map(mes => {
      const r = state.despesasCategoria.find(x => x.categoria === cat && x.mes === mes);
      return r ? Number(r.total) : 0;
    }),
    backgroundColor: CATEGORY_COLORS[cat] || COLORS.ink3,
  }));
  
  const stackCtx = document.getElementById('chartDespesasStack').getContext('2d');
  if (state.charts.stack) state.charts.stack.destroy();
  state.charts.stack = new Chart(stackCtx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...chartOptions(),
      scales: {
        ...chartOptions().scales,
        x: { ...chartOptions().scales.x, stacked: true },
        y: { ...chartOptions().scales.y, stacked: true },
      },
    }
  });
}

// =====================================================
// RESERVAS
// =====================================================
function populateAptoFilter() {
  const sel = document.getElementById('filterApto');
  state.apartamentos.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.codigo;
    opt.textContent = a.codigo;
    sel.appendChild(opt);
  });
}

function renderReservas() {
  const fp = document.getElementById('filterPartner').value;
  const fa = document.getElementById('filterApto').value;
  const fper = document.getElementById('filterPeriodo').value;
  
  let filtered = state.reservas.filter(r => {
    if (fp && r.partner !== fp) return false;
    if (fa && r.apartamento !== fa) return false;
    
    const dt = new Date(r.check_in + 'T00:00:00');
    const now = new Date();
    
    if (fper === 'future') return dt > now;
    if (fper === 'last30') {
      const cut = new Date(); cut.setDate(cut.getDate() - 30);
      return dt >= cut && dt <= now;
    }
    if (fper === 'last90') {
      const cut = new Date(); cut.setDate(cut.getDate() - 90);
      return dt >= cut && dt <= now;
    }
    if (fper === 'ytd') return dt.getFullYear() === now.getFullYear();
    return true;
  });
  
  const tbody = document.getElementById('reservasTbody');
  tbody.innerHTML = '';
  
  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${r.reservation_code}</code></td>
      <td><span class="badge-canal badge-${r.partner}">${r.partner}</span></td>
      <td><strong>${r.apartamento}</strong></td>
      <td>${fmt.data(r.check_in)}</td>
      <td class="num">${r.noites}</td>
      <td class="num">${r.guests}</td>
      <td class="num">${fmt.brlFull(r.total_value)}</td>
      <td class="num">${fmt.brlFull(r.cleaning_fee)}</td>
      <td class="num">${fmt.brlFull(r.partner_commission)}</td>
      <td class="num">${fmt.brlFull(r.co_host_calc)}</td>
      <td class="num"><strong>${fmt.brlFull(r.liquido_stay)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
  
  const tot = filtered.reduce((a, r) => a + Number(r.liquido_stay), 0);
  document.getElementById('reservasFooter').textContent = 
    `${filtered.length} reservas · líquido total: ${fmt.brlFull(tot)}`;
}

// =====================================================
// CHART OPTIONS (compartilhado)
// =====================================================
function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          font: { family: 'Inter', size: 12, weight: '500' },
          padding: 14,
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'rectRounded',
        },
      },
      tooltip: tooltipConfig(),
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: COLORS.line, drawBorder: false },
        ticks: {
          font: { family: 'JetBrains Mono', size: 11 },
          color: COLORS.ink3,
          callback: v => 'R$ ' + (v / 1000).toFixed(0) + 'k',
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { family: 'JetBrains Mono', size: 11 },
          color: COLORS.ink3,
        }
      },
    }
  };
}

function tooltipConfig() {
  return {
    backgroundColor: COLORS.ink,
    titleFont: { family: 'Inter', size: 12, weight: '600' },
    bodyFont: { family: 'JetBrains Mono', size: 12 },
    padding: 12,
    cornerRadius: 8,
    callbacks: {
      label: ctx => {
        const lbl = ctx.dataset.label || '';
        const v = ctx.parsed.y ?? ctx.parsed;
        return `${lbl}: ${fmt.brlFull(v)}`;
      }
    }
  };
}

// =====================================================
// TABS
// =====================================================
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      
      // Lazy redraw nos charts ao trocar de tab (correção responsiva)
      Object.values(state.charts).forEach(c => c?.resize?.());
    });
  });
  
  // Botão alert -> reservas
  document.getElementById('cohostAlertBtn')?.addEventListener('click', () => {
    document.querySelector('[data-tab="reservas"]').click();
    document.getElementById('filterPartner').value = 'booking';
    document.getElementById('filterPeriodo').value = 'all';
    renderReservas();
  });
}

function setupFilters() {
  // Filtros de período da tabela resumo
  document.querySelectorAll('#periodFilter .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#periodFilter .pill').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
      
      const period = p.dataset.period;
      let data;
      if (period === '12m') {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 12);
        data = state.resumoMensal.filter(r => new Date(r.mes) >= cutoff);
      } else if (period === 'ytd') {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        data = state.resumoMensal.filter(r => new Date(r.mes) >= yearStart);
      } else {
        data = state.resumoMensal;
      }
      renderResumoTable(data);
    });
  });
  
  // Filtros reservas
  ['filterPartner', 'filterApto', 'filterPeriodo'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderReservas);
  });
}

// =====================================================
// REFRESH
// =====================================================
async function refreshData() {
  const btn = document.getElementById('btnRefresh');
  btn.disabled = true;
  btn.textContent = '↻ Sincronizando...';
  
  try {
    // Dispara Edge Function de sync
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/dash-stays-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await resp.json();
    
    if (result.ok) {
      btn.textContent = `✓ ${result.fetched} reservas atualizadas`;
      // Re-fetch dos dados
      await fetchAll();
      renderAll();
    } else {
      btn.textContent = '⚠ Erro no sync';
    }
  } catch (e) {
    btn.textContent = '⚠ Erro';
  }
  
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '↻ Atualizar dados';
  }, 3000);
}

// =====================================================
// INIT
// =====================================================
function renderAll() {
  renderSyncStatus();
  renderOverview();
  renderApartamentos();
  renderDespesas();
  renderReservas();
}

async function init() {
  setupTabs();
  setupFilters();
  
  const ok = await fetchAll();
  if (!ok) return;
  
  populateAptoFilter();
  renderAll();
  
  document.getElementById('btnRefresh').addEventListener('click', refreshData);
}

document.addEventListener('DOMContentLoaded', init);
