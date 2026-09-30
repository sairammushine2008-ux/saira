/**
 * FutureFit - Dashboard Module
 * Dynamic Stats, Chart.js Weekly Jump Improvement Chart,
 * Athletic Competency Radar Chart, and Quick Launch Assessment.
 */

document.addEventListener('DOMContentLoaded', () => {
  const jumpChartCanvas = document.getElementById('weekly-jump-chart');
  const radarChartCanvas = document.getElementById('athletic-radar-chart');

  let jumpChartInstance = null;
  let radarChartInstance = null;

  // Chart Data Sets
  const chartDatasets = {
    '7d': {
      labels: ['Sep 19', 'Sep 20', 'Sep 21', 'Sep 22', 'Sep 23', 'Sep 24', 'Sep 25 (Today)'],
      data: [61.2, 62.5, 63.8, 64.9, 66.1, 67.3, 68.5]
    },
    '30d': {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      data: [57.4, 60.1, 64.5, 68.5]
    },
    'all': {
      labels: ['Jun', 'Jul', 'Aug', 'Sep'],
      data: [52.0, 56.5, 61.8, 68.5]
    }
  };

  // Initialize Jump Chart
  if (jumpChartCanvas && typeof Chart !== 'undefined') {
    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
    const textColor = isLight ? '#475569' : '#94a3b8';

    jumpChartInstance = new Chart(jumpChartCanvas, {
      type: 'line',
      data: {
        labels: chartDatasets['7d'].labels,
        datasets: [{
          label: 'Vertical Jump (cm)',
          data: chartDatasets['7d'].data,
          borderColor: '#00f0ff',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
            return gradient;
          },
          borderWidth: 3,
          fill: true,
          tension: 0.38,
          pointBackgroundColor: '#00f0ff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#00f0ff',
            bodyColor: '#ffffff',
            borderColor: 'rgba(0, 240, 255, 0.3)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => ` Peak Jump: ${context.parsed.y} cm`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
          },
          y: {
            min: 50,
            max: 75,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${val} cm`
            }
          }
        }
      }
    });

    // Timeline Filter Buttons
    const filterButtons = document.querySelectorAll('.chart-filter-btn');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.dataset.period || '7d';

        if (chartDatasets[period] && jumpChartInstance) {
          jumpChartInstance.data.labels = chartDatasets[period].labels;
          jumpChartInstance.data.datasets[0].data = chartDatasets[period].data;
          jumpChartInstance.update();
          showToast(`Displaying ${btn.textContent.trim()} jump progression.`, 'info');
        }
      });
    });
  }

  // Initialize Athletic Radar Chart
  if (radarChartCanvas && typeof Chart !== 'undefined') {
    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const textColor = isLight ? '#0f172a' : '#f8fafc';

    radarChartInstance = new Chart(radarChartCanvas, {
      type: 'radar',
      data: {
        labels: [
          'Explosive Power',
          'Lateral Agility',
          'Anaerobic Stamina',
          'Bilateral Balance',
          'Reaction Speed',
          'Ankle Stiffness'
        ],
        datasets: [{
          label: 'Current Biometric Rating',
          data: [94, 88, 82, 90, 86, 92],
          fill: true,
          backgroundColor: 'rgba(16, 185, 129, 0.25)',
          borderColor: '#10b981',
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: {
              color: textColor,
              font: { family: 'Inter', size: 11, weight: '600' }
            },
            ticks: {
              backdropColor: 'transparent',
              color: isLight ? '#64748b' : '#94a3b8',
              stepSize: 20
            },
            suggestedMin: 50,
            suggestedMax: 100
          }
        }
      }
    });
  }

  // Quick Launch Button Handler
  const quickLaunchBtn = document.getElementById('quick-launch-assessment-btn');
  if (quickLaunchBtn) {
    quickLaunchBtn.addEventListener('click', () => {
      showToast('Launching AI Jump Assessment Camera Engine...', 'info');
      setTimeout(() => {
        window.location.href = '/tracker';
      }, 300);
    });
  }

  // Refresh Stats Handler
  const refreshStatsBtn = document.getElementById('refresh-stats-btn');
  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', async () => {
      refreshStatsBtn.classList.add('spin-animate');
      try {
        const res = await fetch('/api/athlete/stats');
        const data = await res.json();
        if (data.success) {
          const peakEl = document.getElementById('peak-jump-display');
          if (peakEl) peakEl.textContent = `${data.peak_jump_cm} cm`;
          const sessionsEl = document.getElementById('total-sessions-display');
          if (sessionsEl) sessionsEl.textContent = data.total_sessions;
          const calEl = document.getElementById('calories-display');
          if (calEl) calEl.textContent = `${data.calories_burned.toLocaleString()} kcal`;
          const streakEl = document.getElementById('streak-display');
          if (streakEl) streakEl.textContent = `${data.streak_days} Days`;
          const rankEl = document.getElementById('rank-display');
          if (rankEl) rankEl.textContent = `#${data.national_rank}`;

          showToast('Biometric performance metrics refreshed from server!', 'success');
        }
      } catch (e) {
        showToast('Telemetry refreshed locally.', 'info');
      } finally {
        setTimeout(() => refreshStatsBtn.classList.remove('spin-animate'), 500);
      }
    });
  }
});
