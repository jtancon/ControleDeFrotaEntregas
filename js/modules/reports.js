// js/modules/reports.js

export function generatePDFReport(state) {
    const { selectedEmployeeId, employees, currentCalendarDate } = state;
    if (!selectedEmployeeId) {
        return alert("Por favor, selecione um colaborador primeiro.");
    }
    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    if (!employee) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthName = currentCalendarDate.toLocaleDateString('pt-BR', { month: 'long' });

    doc.setFontSize(18);
    doc.text(`Relatório de Pagamento - ${employee.name}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Período: ${monthName} de ${year}`, 14, 30);

    const tableColumn = ["Data", "Dia da Semana", "Tipo", "Detalhes", "Ganhos (€)"];
    const tableRows = [];
    let monthTotal = 0;

    const workedDays = employee.worked_days || {};
    const daysInMonth = Object.keys(workedDays)
        .filter(dateStr => new Date(dateStr).getMonth() === month && new Date(dateStr).getFullYear() === year)
        .sort((a, b) => new Date(a) - new Date(b));

    daysInMonth.forEach(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        const dayData = workedDays[dateStr];
        let earnings = 0, details = '-', type = 'Dia de Semana';
        
        if (dayData.type === 'weekday') {
            earnings = 40;
        } else if (dayData.type === 'sunday') {
            type = 'Domingo';
            earnings = dayData.earnings || 0;
            details = `${dayData.deliveries || 0} entregas x € ${dayData.rate || 0}`;
        }
        monthTotal += earnings;
        tableRows.push([
            date.toLocaleDateString('pt-BR'),
            date.toLocaleDateString('pt-BR', { weekday: 'long' }),
            type, details, earnings.toFixed(2)
        ]);
    });

    doc.autoTable({
        startY: 40,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
    });

    doc.setFontSize(14);
    doc.text(`Total a Pagar: € ${monthTotal.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 15);
    doc.save(`relatorio_${employee.name.replace(/\s/g, '_')}_${monthName}_${year}.pdf`);
}