/* Budget Planner: charts.
 *
 * Draws the two charts with the Chart.js library (vendor/chart.umd.js) and saves a chart as a PNG image.
 * The functions get plain data as parameters, so this file does not depend on the rest of the app.
 */
(function (root) {
  'use strict';

  let categoryChart = null;
  let trendChart = null;

  /** Reads the current colours from the CSS variables, so charts follow the light/dark theme. */
  function themeColors() {
    const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return {
      text: css('--text'), textDim: css('--text-dim'), border: css('--border'),
      panel: css('--bg-elev'), pos: css('--pos'), neg: css('--neg'),
    };
  }

  function tooltipStyle(c) {
    return { backgroundColor: c.panel, titleColor: c.text, bodyColor: c.text, borderColor: c.border, borderWidth: 1, padding: 10, cornerRadius: 8 };
  }

  /**
   * Doughnut chart: amount per category.
   * items = [{ label, color, value }]. Returns false (and removes the chart) when there is nothing to draw.
   */
  function drawCategory(canvas, items, formatMoney) {
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    if (items.length === 0) return false;
    const c = themeColors();
    categoryChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: items.map(i => i.label),
        datasets: [{ data: items.map(i => i.value), backgroundColor: items.map(i => i.color), borderWidth: 0, hoverOffset: 8 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({ callbacks: { label: ctx => ' ' + ctx.label + ': ' + formatMoney(ctx.parsed) } }, tooltipStyle(c)),
        },
      },
    });
    return true;
  }

  /** Bar chart: income and expenses for each month. */
  function drawTrend(canvas, labels, income, expense, formatMoney) {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    const c = themeColors();
    trendChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: income, backgroundColor: c.pos, borderRadius: 6, maxBarThickness: 20 },
          { label: 'Expenses', data: expense, backgroundColor: c.neg, borderRadius: 6, maxBarThickness: 20 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: { position: 'bottom', labels: { color: c.textDim, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
          tooltip: Object.assign({ callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + formatMoney(ctx.parsed.y) } }, tooltipStyle(c)),
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.textDim, font: { size: 11 } } },
          y: { grid: { color: c.border }, ticks: { color: c.textDim, font: { size: 10.5 }, callback: v => v.toLocaleString('lv-LV') + ' €' }, border: { display: false } },
        },
      },
    });
  }

  function destroyAll() {
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
  }

  /**
   * Saves a chart as a PNG file. The picture gets a solid background, a title, the period,
   * and (for the category chart) a legend, because the page draws those parts as normal HTML, not on the canvas.
   * `which` is 'category' or 'trend'; legend = [{ label, color }]. Returns false when there is no chart to save.
   */
  function savePng(which, fileName, title, subtitle, legend) {
    const chart = which === 'category' ? categoryChart : trendChart;
    if (!chart) return false;
    const c = themeColors();
    const source = chart.canvas;
    const scale = source.width / Math.max(1, source.clientWidth);
    const pad = 16 * scale;
    const rowH = 20 * scale;
    const headerH = 56 * scale;

    const width = Math.max(source.width + pad * 2, 520 * scale);
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = (12 * scale) + 'px Inter, system-ui, sans-serif';
    // Lay the legend out in rows so long category lists wrap instead of running off the picture.
    const rows = [];
    let row = [], rowWidth = 0;
    (legend || []).forEach(item => {
      const w = probe.measureText(item.label).width + 26 * scale;
      if (row.length && rowWidth + w > width - pad * 2) { rows.push(row); row = []; rowWidth = 0; }
      row.push(Object.assign({ w }, item)); rowWidth += w;
    });
    if (row.length) rows.push(row);
    const legendH = rows.length ? rows.length * rowH + pad : 0;

    const out = document.createElement('canvas');
    out.width = Math.round(width);
    out.height = Math.round(headerH + source.height + legendH + pad);
    const ctx = out.getContext('2d');
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.textBaseline = 'top';
    ctx.fillStyle = c.text;
    ctx.font = '700 ' + (18 * scale) + 'px Inter, system-ui, sans-serif';
    ctx.fillText(title, pad, pad);
    ctx.fillStyle = c.textDim;
    ctx.font = (12 * scale) + 'px Inter, system-ui, sans-serif';
    ctx.fillText(subtitle, pad, pad + 24 * scale);

    ctx.drawImage(source, (out.width - source.width) / 2, headerH);

    let y = headerH + source.height + pad / 2;
    rows.forEach(r => {
      const total = r.reduce((s, i) => s + i.w, 0);
      let x = Math.max(pad, (out.width - total) / 2);
      r.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, y + 3 * scale, 10 * scale, 10 * scale);
        ctx.fillStyle = c.textDim;
        ctx.fillText(item.label, x + 16 * scale, y);
        x += item.w;
      });
      y += rowH;
    });

    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
    return true;
  }

  root.Charts = { drawCategory, drawTrend, destroyAll, savePng };
})(window);
