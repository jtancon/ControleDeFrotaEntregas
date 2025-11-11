// js/modules/charts.js

export function initializeCharts(state) {
    // Destrói gráficos antigos para evitar vazamento de memória
    Object.values(state.charts).forEach(chart => chart?.destroy());

    const commonBarOptions = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af' } }, x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af' } } }, plugins: { legend: { display: false } } };

    const dailyEarningsCtx = document.getElementById('ganhos-diarios-chart')?.getContext('2d');
    if (dailyEarningsCtx) {
        state.charts.dailyEarningsChart = new Chart(dailyEarningsCtx, { type: 'line', data: { labels: [], datasets: [{ label: 'Ganhos (€)', data: [], backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 2, tension: 0.4, fill: true }] }, options: commonBarOptions });
    }

    const earningsCtx = document.getElementById('earningsByZoneChart')?.getContext('2d');
    if (earningsCtx) {
        state.charts.earningsChart = new Chart(earningsCtx, { type: 'doughnut', data: { labels: ['Zona A', 'Zona B', 'Zona C', 'Zona Green'], datasets: [{ label: 'Ganhos', data: [], backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#8b5cf6'], borderColor: '#1f2937', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } } } } });
    }
    // Adicione a inicialização de outros gráficos aqui...
}

export function updateAllCharts(state) {
    if (!state.charts.earningsChart || !state.charts.dailyEarningsChart) return;

    // --- Update Daily Earnings Chart ---
    const daysInCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailyLabels = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
    const dailyEarningsData = Array(daysInCurrentMonth).fill(0);
    state.trips.forEach(trip => {
        if (trip.isoDate.getMonth() === new Date().getMonth()) {
            dailyEarningsData[trip.isoDate.getDate() - 1] += trip.earnings;
        }
    });
    state.charts.dailyEarningsChart.data.labels = dailyLabels;
    state.charts.dailyEarningsChart.data.datasets[0].data = dailyEarningsData;
    state.charts.dailyEarningsChart.update();

    // --- Update Earnings by Zone Chart ---
    const earningsByZone = { 'A': 0, 'B': 0, 'C': 0, 'Green': 0 };
    state.trips.forEach(trip => { earningsByZone[trip.zone] += trip.earnings; });
    state.charts.earningsChart.data.datasets[0].data = Object.values(earningsByZone);
    state.charts.earningsChart.update();

    // Adicione a atualização de outros gráficos aqui...
}