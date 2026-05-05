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
  despesasDetalhe: [],
  reservas: [],
  apartamentos: [],
  syncLog: null,
  charts: {},
};

const APTOS_ORDER = ['IV203', 'IV204', 'BA201', 'BA203', 'BA204'];
const MESES_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
    const [resumo, resumoApto, despCat, despDet, reservas, aptos, syncLog] = await Promise.all([
      sb.from('dash_v_resumo_mensal').select('*').order('mes', { ascending: true }),
      sb.from('dash_v_resumo_mensal_apto').select('*').order('mes', { ascending: true }),
      sb.from('dash_v_despesas_categoria').select('*').order('mes', { ascending: true }),
      sb.from('dash_expenses').select('data, apartamento, categoria, valor'),
      sb.from('dash_v_reservas').select('*').order('check_in', { ascending: false }),
      sb.from('dash_apartamentos').select('*').order('codigo'),
      sb.from('dash_sync_log').select('*').order('id', { ascending: false }).limit(1),
    ]);

    if (resumo.error) throw new Error('resumo: ' + resumo.error.message);
    if (resumoApto.error) throw new Error('resumoApto: ' + resumoApto.error.message);
    if (despCat.error) throw new Error('despCat: ' + despCat.error.message);
    if (despDet.error) throw new Error('despDet: ' + despDet.error.message);
    if (reservas.error) throw new Error('reservas: ' + reservas.error.message);
    if (aptos.error) throw new Error('aptos: ' + aptos.error.message);

    state.resumoMensal = resumo.data || [];
    state.resumoApto = resumoApto.data || [];
    state.despesasCategoria = despCat.data || [];
    state.despesasDetalhe = despDet.data || [];
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

function aggregateByPartnerByMonth() {
  const result = {};
  state.reservas.forEach(r => {
    if (!r.check_in) return;
    const mes = r.check_in.slice(0, 7);
    if (!result[mes]) result[mes] = {};
    const p = r.partner || 'direct';
    if (!result[mes][p]) {
      result[mes][p] = { qty: 0, bruta: 0, comissao: 0, cohost: 0 };
    }
    result[mes][p].qty += 1;
    result[mes][p].bruta += Number(r.total_value || 0);
    result[mes][p].comissao += Number(r.partner_commission || 0);
    result[mes][p].cohost += Number(r.co_host_calc || 0);
  });
  return result;
}

const PARTNER_LABELS = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  direct: 'Direto',
};
const PARTNER_ORDER = ['airbnb', 'booking', 'direct'];

function renderResumoTable(data) {
  const tbody = document.getElementById('resumoTbody');
  tbody.innerHTML = '';

  const partnerByMonth = aggregateByPartnerByMonth();
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

    // Sub-linhas: quebra por plataforma
    const mesKey = r.mes.slice(0, 7);
    const partners = partnerByMonth[mesKey] || {};
    PARTNER_ORDER.forEach(p => {
      const d = partners[p];
      if (!d || d.qty === 0) return;
      const subTr = document.createElement('tr');
      subTr.className = 'sub-row';
      subTr.innerHTML = `
        <td class="cell-sub"><span class="sub-arrow">↳</span> <span class="badge-canal badge-${p}">${PARTNER_LABELS[p]}</span></td>
        <td class="num">${d.qty}</td>
        <td class="num">${fmt.brl(d.bruta)}</td>
        <td class="num">${fmt.brl(d.comissao)}</td>
        <td class="num">${fmt.brl(d.cohost)}</td>
        <td class="num cell-muted">—</td>
        <td class="num cell-muted">—</td>
        <td class="num cell-muted">—</td>
      `;
      tbody.appendChild(subTr);
    });

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

  // Tabela pivot mensal por categoria (default: 12m)
  renderDespesasPivot('12m');
}

// =====================================================
// PIVOT MENSAL — DESPESAS
// =====================================================
function filterDespesasByPeriod(period) {
  if (period === 'all') return state.despesasCategoria.slice();
  if (period === 'ytd') {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    return state.despesasCategoria.filter(r => new Date(r.mes) >= yearStart);
  }
  // 12m
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  return state.despesasCategoria.filter(r => new Date(r.mes) >= cutoff);
}

function renderDespesasPivot(period) {
  const data = filterDespesasByPeriod(period);
  const meses = [...new Set(data.map(r => r.mes))].sort();
  const cats = [...new Set(data.map(r => r.categoria))].sort();

  // Total YTD/período por categoria pra ordenar
  const totaisCat = {};
  cats.forEach(c => {
    totaisCat[c] = data
      .filter(r => r.categoria === c)
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
  });
  const catsOrd = cats.slice().sort((a, b) => totaisCat[b] - totaisCat[a]);

  // Lookup mes×categoria
  const lookup = {};
  data.forEach(r => {
    lookup[`${r.mes}|${r.categoria}`] = Number(r.total || 0);
  });

  // Header
  const thead = document.getElementById('despesasPivotThead');
  thead.innerHTML = '';
  const hr = document.createElement('tr');
  hr.innerHTML = '<th>Categoria</th>' +
    meses.map(m => `<th class="num">${fmt.mes(m.slice(0, 7))}</th>`).join('') +
    '<th class="num">Total</th>';
  thead.appendChild(hr);

  // Body
  const tbody = document.getElementById('despesasPivotTbody');
  tbody.innerHTML = '';
  catsOrd.forEach(cat => {
    const tr = document.createElement('tr');
    const cells = meses.map(m => {
      const v = lookup[`${m}|${cat}`] || 0;
      return `<td class="num">${v ? fmt.brl(v) : '<span style="color:var(--ink-4)">—</span>'}</td>`;
    }).join('');
    tr.innerHTML = `<td class="cell-mes">${cat}</td>${cells}<td class="num"><strong>${fmt.brl(totaisCat[cat])}</strong></td>`;
    tbody.appendChild(tr);
  });

  // Totalizador por mês
  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  let grand = 0;
  const totCells = meses.map(m => {
    const sumMes = catsOrd.reduce((acc, c) => acc + (lookup[`${m}|${c}`] || 0), 0);
    grand += sumMes;
    return `<td class="num">${fmt.brl(sumMes)}</td>`;
  }).join('');
  totRow.innerHTML = `<td>Total</td>${totCells}<td class="num">${fmt.brl(grand)}</td>`;
  tbody.appendChild(totRow);
}

// =====================================================
// LIMPEZA & LAVANDERIA
// =====================================================
const LIMPEZA_CATS = ['Materiais de Limpeza', 'Lavanderia'];

function renderLimpeza() {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const ytd = state.despesasCategoria.filter(
    r => LIMPEZA_CATS.includes(r.categoria) && new Date(r.mes) >= yearStart
  );

  const totMat = ytd.filter(r => r.categoria === 'Materiais de Limpeza')
    .reduce((a, r) => a + Number(r.total || 0), 0);
  const totLav = ytd.filter(r => r.categoria === 'Lavanderia')
    .reduce((a, r) => a + Number(r.total || 0), 0);
  const totSum = totMat + totLav;
  const mesesYtd = new Set(ytd.map(r => r.mes)).size || 1;

  document.getElementById('kpiMateriaisYtd').textContent = fmt.brl(totMat);
  document.getElementById('kpiMateriaisYtdSub').textContent =
    `R$ ${(totMat / mesesYtd).toLocaleString('pt-BR', {maximumFractionDigits: 0})}/mês`;

  document.getElementById('kpiLavanderiaYtd').textContent = fmt.brl(totLav);
  document.getElementById('kpiLavanderiaYtdSub').textContent =
    `R$ ${(totLav / mesesYtd).toLocaleString('pt-BR', {maximumFractionDigits: 0})}/mês`;

  document.getElementById('kpiLimpezaTotalYtd').textContent = fmt.brl(totSum);
  const matPct = totSum > 0 ? (totMat / totSum * 100) : 0;
  document.getElementById('kpiLimpezaTotalYtdSub').textContent =
    `Materiais ${fmt.pct(matPct)} · Lavanderia ${fmt.pct(100 - matPct)}`;

  document.getElementById('kpiLimpezaMediaMes').textContent = fmt.brl(totSum / mesesYtd);

  renderLimpezaChart();
  renderLimpezaTable('12m');
}

function renderLimpezaChart() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const data = state.despesasCategoria.filter(
    r => LIMPEZA_CATS.includes(r.categoria) && new Date(r.mes) >= cutoff
  );
  const meses = [...new Set(data.map(r => r.mes))].sort();
  const labels = meses.map(m => fmt.mes(m.slice(0, 7)));

  const seriesFor = (cat) => meses.map(m => {
    const r = data.find(x => x.mes === m && x.categoria === cat);
    return r ? Number(r.total) : 0;
  });

  const ctx = document.getElementById('chartLimpeza').getContext('2d');
  if (state.charts.limpeza) state.charts.limpeza.destroy();
  state.charts.limpeza = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Materiais de Limpeza',
          data: seriesFor('Materiais de Limpeza'),
          backgroundColor: CATEGORY_COLORS['Materiais de Limpeza'] + 'cc',
          borderColor: CATEGORY_COLORS['Materiais de Limpeza'],
          borderRadius: 4,
        },
        {
          label: 'Lavanderia',
          data: seriesFor('Lavanderia'),
          backgroundColor: CATEGORY_COLORS['Lavanderia'] + 'cc',
          borderColor: CATEGORY_COLORS['Lavanderia'],
          borderRadius: 4,
        },
      ]
    },
    options: chartOptions(),
  });
}

function renderLimpezaTable(period) {
  const data = filterDespesasByPeriod(period)
    .filter(r => LIMPEZA_CATS.includes(r.categoria));
  const meses = [...new Set(data.map(r => r.mes))].sort();

  // Total geral de despesas no período (todas as categorias) pra calcular % do mês
  const totalMesGeral = {};
  filterDespesasByPeriod(period).forEach(r => {
    totalMesGeral[r.mes] = (totalMesGeral[r.mes] || 0) + Number(r.total || 0);
  });

  const tbody = document.getElementById('limpezaTbody');
  tbody.innerHTML = '';

  let totMat = 0, totLav = 0, totGeralPeriodo = 0;

  meses.forEach(m => {
    const mat = data.find(r => r.mes === m && r.categoria === 'Materiais de Limpeza');
    const lav = data.find(r => r.mes === m && r.categoria === 'Lavanderia');
    const vMat = mat ? Number(mat.total) : 0;
    const vLav = lav ? Number(lav.total) : 0;
    const subtotal = vMat + vLav;
    const pct = totalMesGeral[m] > 0 ? (subtotal / totalMesGeral[m] * 100) : 0;

    totMat += vMat;
    totLav += vLav;
    totGeralPeriodo += totalMesGeral[m] || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-mes">${fmt.mes(m.slice(0, 7))}</td>
      <td class="num">${fmt.brl(vMat)}</td>
      <td class="num">${fmt.brl(vLav)}</td>
      <td class="num"><strong>${fmt.brl(subtotal)}</strong></td>
      <td class="num">${fmt.pct(pct)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Totalizador
  const totSum = totMat + totLav;
  const totPct = totGeralPeriodo > 0 ? (totSum / totGeralPeriodo * 100) : 0;
  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  totRow.innerHTML = `
    <td>Total</td>
    <td class="num">${fmt.brl(totMat)}</td>
    <td class="num">${fmt.brl(totLav)}</td>
    <td class="num"><strong>${fmt.brl(totSum)}</strong></td>
    <td class="num">${fmt.pct(totPct)}</td>
  `;
  tbody.appendChild(totRow);
}

// =====================================================
// PLANILHA (espelho do controle financeiro)
// =====================================================
function planilhaCellNum(v, opts = {}) {
  const isZero = !v || Math.abs(v) < 0.005;
  if (isZero && opts.allowZero !== true) {
    return `<td class="pl-zero">R$ 0,00</td>`;
  }
  const cls = opts.cls || '';
  const formatted = 'R$ ' + Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  return `<td class="${cls}">${formatted}</td>`;
}

function planilhaCellInt(v) {
  if (!v) return `<td class="pl-zero">0</td>`;
  return `<td>${v}</td>`;
}

// Constrói lookup de despesas por (mes, categoria, apartamento)
function buildDespesasLookup(ano) {
  const lookup = {};
  state.despesasDetalhe.forEach(d => {
    const dt = new Date(d.data + 'T00:00:00');
    if (dt.getFullYear() !== ano) return;
    const m = dt.getMonth(); // 0-11
    const key = `${m}|${d.categoria}|${d.apartamento || 'NULL'}`;
    lookup[key] = (lookup[key] || 0) + Number(d.valor || 0);
  });
  return lookup;
}

function getDesp(lookup, mes, categoria, apto) {
  return lookup[`${mes}|${categoria}|${apto || 'NULL'}`] || 0;
}

function getDespAllAptos(lookup, mes, categoria) {
  return ['IV203', 'IV204', 'BA201', 'BA203', 'BA204', 'NULL']
    .reduce((acc, a) => acc + (lookup[`${mes}|${categoria}|${a}`] || 0), 0);
}

// Internet vem como NULL no banco mas com 2 linhas (BA + IV) por mês
// Heurística: maior valor = BA, menor = IV
function getInternetSplit(ano) {
  const result = {}; // { mes -> { ba, iv } }
  for (let m = 0; m < 12; m++) result[m] = { ba: 0, iv: 0 };

  const byMes = {};
  state.despesasDetalhe.forEach(d => {
    if (d.categoria !== 'Internet') return;
    const dt = new Date(d.data + 'T00:00:00');
    if (dt.getFullYear() !== ano) return;
    const m = dt.getMonth();
    if (!byMes[m]) byMes[m] = [];
    byMes[m].push(Number(d.valor || 0));
  });

  Object.entries(byMes).forEach(([m, vals]) => {
    vals.sort((a, b) => b - a);
    result[m].ba = vals[0] || 0;
    result[m].iv = vals[1] || 0;
    if (vals.length > 2) {
      // soma extras na maior
      result[m].ba += vals.slice(2).reduce((a, v) => a + v, 0);
    }
  });
  return result;
}

// Receita por apto×mes (pos plataforma menos co-host airbnb auto)
function getReceitaApto(ano) {
  const result = {}; // { mes -> { apto -> valor } }
  for (let m = 0; m < 12; m++) {
    result[m] = {};
    APTOS_ORDER.forEach(a => result[m][a] = 0);
  }
  const lookup = buildDespesasLookup(ano);

  state.resumoApto.forEach(r => {
    const dt = new Date(r.mes);
    if (dt.getFullYear() !== ano) return;
    const m = dt.getMonth();
    if (!APTOS_ORDER.includes(r.apartamento)) return;
    const posPlat = Number(r.receita_pos_plataforma || 0);
    const cohostAirbnb = getDesp(lookup, m, 'Co-Host Airbnb', r.apartamento);
    result[m][r.apartamento] = posPlat - cohostAirbnb;
  });
  return result;
}

function getCheckinsApto(ano) {
  const result = {};
  for (let m = 0; m < 12; m++) {
    result[m] = {};
    APTOS_ORDER.forEach(a => result[m][a] = 0);
  }
  state.reservas.forEach(r => {
    if (!r.check_in) return;
    const dt = new Date(r.check_in + 'T00:00:00');
    if (dt.getFullYear() !== ano) return;
    const m = dt.getMonth();
    if (APTOS_ORDER.includes(r.apartamento)) {
      result[m][r.apartamento] = (result[m][r.apartamento] || 0) + 1;
    }
  });
  return result;
}

function renderPlanilha() {
  const ano = parseInt(document.getElementById('planilhaAno').value, 10);
  const lookup = buildDespesasLookup(ano);
  const internet = getInternetSplit(ano);
  const receitaApto = getReceitaApto(ano);
  const checkins = getCheckinsApto(ano);

  const meses = Array.from({ length: 12 }, (_, i) => i);
  const sumMes = (fn) => meses.map(fn);
  const sumLine = (arr) => arr.reduce((a, v) => a + v, 0);

  // Helper: gera uma linha de label + 12 valores + resumo
  const lineRow = (sectionAttrs, label, values, opts = {}) => {
    const total = sumLine(values);
    const cls = opts.cls || '';
    const cells = values.map(v => planilhaCellNum(v, { cls })).join('');
    const resumo = total > 0 ?
      `<td class="resumo-col ${cls}">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>` :
      `<td class="resumo-col pl-zero">—</td>`;
    return `<tr class="pl-row-line">${sectionAttrs}<td class="pl-label-cell">${label}</td>${cells}${resumo}</tr>`;
  };

  const intRow = (sectionAttrs, label, values) => {
    const total = sumLine(values);
    const cells = values.map(v => planilhaCellInt(v)).join('');
    const resumo = total > 0 ?
      `<td class="resumo-col">${total}</td>` :
      `<td class="resumo-col pl-zero">—</td>`;
    return `<tr class="pl-row-line">${sectionAttrs}<td class="pl-label-cell">${label}</td>${cells}${resumo}</tr>`;
  };

  const totalRow = (sectionAttrs, label, values, opts = {}) => {
    const total = sumLine(values);
    const cls = opts.cls || '';
    const grandCls = opts.grand ? ' pl-row-grand' : '';
    const cells = values.map(v => planilhaCellNum(v, { allowZero: true, cls })).join('');
    const resumo = `<td class="resumo-col ${cls}">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
    return `<tr class="pl-row-total${grandCls}">${sectionAttrs}<td class="pl-label-cell">${label}</td>${cells}${resumo}</tr>`;
  };

  // Helper: cria attribute rowspan pra primeira linha do bloco
  const sectionStart = (label, span, color) =>
    `<td rowspan="${span}" class="pl-section-cell ${color}">${label}</td>`;
  const sectionCont = ''; // demais linhas da seção: sem celula (rowspan ocupa)

  let html = '';

  // Header
  html += '<thead><tr>';
  html += `<th class="year-cell" colspan="2">${ano}</th>`;
  MESES_LABEL.forEach(m => { html += `<th>${m}</th>`; });
  html += `<th class="resumo-col">Resumo</th>`;
  html += '</tr></thead><tbody>';

  // ===== RECEITA =====
  const receitaTotalMes = sumMes(m =>
    APTOS_ORDER.reduce((a, apt) => a + receitaApto[m][apt], 0)
  );
  const receitaSpan = APTOS_ORDER.length + 2; // 5 aptos + Resoluções + Total
  APTOS_ORDER.forEach((apt, i) => {
    const values = sumMes(m => receitaApto[m][apt]);
    html += lineRow(
      i === 0 ? sectionStart('Receita', receitaSpan, 'green') : sectionCont,
      apt,
      values,
      { cls: 'pl-receita' }
    );
  });
  html += lineRow(sectionCont, 'Resoluções', sumMes(() => 0), { cls: 'pl-receita' });
  html += totalRow(sectionCont, 'Total', receitaTotalMes, { cls: 'pl-receita' });

  // ===== DESPESAS CONDOMÍNIO + LUZ + INTERNET =====
  const condLuzNetSpan = 5 + 5 + 2 + 1; // Cond×5 + Luz×5 + Internet×2 + Total
  let firstCondLuzNet = true;
  APTOS_ORDER.forEach(apt => {
    const values = sumMes(m => getDesp(lookup, m, 'Condomínio', apt));
    html += lineRow(
      firstCondLuzNet ? sectionStart('Despesas<br>Cond + Luz<br>+ Internet', condLuzNetSpan, 'red') : sectionCont,
      `Condomínio ${apt}`,
      values,
      { cls: 'pl-despesa' }
    );
    firstCondLuzNet = false;
  });
  APTOS_ORDER.forEach(apt => {
    const values = sumMes(m => getDesp(lookup, m, 'Luz', apt));
    html += lineRow(sectionCont, `Luz ${apt}`, values, { cls: 'pl-despesa' });
  });
  html += lineRow(sectionCont, 'Internet BA', sumMes(m => internet[m].ba), { cls: 'pl-despesa' });
  html += lineRow(sectionCont, 'Internet IV', sumMes(m => internet[m].iv), { cls: 'pl-despesa' });

  const condLuzNetTotal = sumMes(m => {
    const cond = APTOS_ORDER.reduce((a, apt) => a + getDesp(lookup, m, 'Condomínio', apt), 0);
    const luz = APTOS_ORDER.reduce((a, apt) => a + getDesp(lookup, m, 'Luz', apt), 0);
    const net = internet[m].ba + internet[m].iv;
    return cond + luz + net;
  });
  html += totalRow(sectionCont, 'Total', condLuzNetTotal, { cls: 'pl-despesa' });

  // ===== OUTRAS DESPESAS =====
  const outras = [
    ['Manutenções', 'Manutenção'],
    ['Compras', 'Compras'],
    ['Materiais de Limpeza', 'Materiais de Limpeza'],
    ['Lavanderia', 'Lavanderia'],
    ['Impostos', 'Impostos DAS'],
    ['Contador', 'Contador'],
    ['Comissão Co-Host Booking.com', 'Co-Host Booking'],
  ];
  const outrasSpan = outras.length + 1;
  outras.forEach(([label, cat], i) => {
    const values = sumMes(m => getDespAllAptos(lookup, m, cat));
    html += lineRow(
      i === 0 ? sectionStart('Outras<br>Despesas', outrasSpan, 'red') : sectionCont,
      label, values, { cls: 'pl-despesa' }
    );
  });
  const outrasTotal = sumMes(m => outras.reduce((a, [, cat]) => a + getDespAllAptos(lookup, m, cat), 0));
  html += totalRow(sectionCont, 'Total', outrasTotal, { cls: 'pl-despesa' });

  // ===== DESPESAS COM FERRAMENTAS =====
  const ferr = [
    ['Stays Mensalidade', 'Stays Mensalidade'],
    ['Stays Comissão', 'Stays Comissão'],
    ['Pricelabs Mensalidade', 'PriceLabs/Beyond Comissão'],
  ];
  const ferrSpan = ferr.length + 1;
  ferr.forEach(([label, cat], i) => {
    const values = sumMes(m => getDespAllAptos(lookup, m, cat));
    html += lineRow(
      i === 0 ? sectionStart('Despesas com<br>Ferramentas', ferrSpan, 'red') : sectionCont,
      label, values, { cls: 'pl-despesa' }
    );
  });
  const ferrTotal = sumMes(m => ferr.reduce((a, [, cat]) => a + getDespAllAptos(lookup, m, cat), 0));
  html += totalRow(sectionCont, 'Total', ferrTotal, { cls: 'pl-despesa' });

  // ===== DESPESA LIMPEZA =====
  const limpSpan = APTOS_ORDER.length + 2; // 5 aptos + Valor Faxina + Total
  APTOS_ORDER.forEach((apt, i) => {
    const values = sumMes(m => checkins[m][apt]);
    html += intRow(
      i === 0 ? sectionStart('Despesa<br>Limpeza', limpSpan, 'red') : sectionCont,
      `Check In ${apt}`,
      values
    );
  });
  // Valor da Faxina = faxina total / total checkins (valor unitário aproximado)
  const faxinaUnit = sumMes(m => {
    const fax = getDespAllAptos(lookup, m, 'Faxina');
    const totCk = APTOS_ORDER.reduce((a, apt) => a + checkins[m][apt], 0);
    return totCk > 0 ? fax / totCk : 0;
  });
  html += lineRow(sectionCont, 'Valor da Faxina', faxinaUnit, { cls: 'pl-despesa' });
  const limpTotal = sumMes(m => getDespAllAptos(lookup, m, 'Faxina'));
  html += totalRow(sectionCont, 'Total', limpTotal, { cls: 'pl-despesa' });

  // ===== IMPOSTOS DAS (referência) =====
  const dasTotal = sumMes(m => getDespAllAptos(lookup, m, 'Impostos DAS'));
  html += totalRow(sectionStart('Impostos DAS', 1, 'red'), 'Total', dasTotal, { cls: 'pl-despesa' });

  // ===== RECEITA - DESPESA =====
  // Soma única (sem duplicar Impostos DAS)
  const resultado = sumMes(m =>
    receitaTotalMes[m] - condLuzNetTotal[m] - outrasTotal[m] - ferrTotal[m] - limpTotal[m]
  );
  html += totalRow(sectionStart('Receita -<br>Despesa', 1, 'green'), 'Total', resultado, { grand: true });

  html += '</tbody>';

  document.getElementById('planilhaTable').innerHTML = html;
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

  // Filtro pivot mensal de despesas
  document.querySelectorAll('#despesasPivotFilter .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#despesasPivotFilter .pill').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
      renderDespesasPivot(p.dataset.period);
    });
  });

  // Filtro tabela detalhe Limpeza & Lavanderia
  document.querySelectorAll('#limpezaFilter .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#limpezaFilter .pill').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
      renderLimpezaTable(p.dataset.period);
    });
  });

  // Seletor de ano da planilha
  document.getElementById('planilhaAno')?.addEventListener('change', renderPlanilha);
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
  renderLimpeza();
  renderPlanilha();
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
