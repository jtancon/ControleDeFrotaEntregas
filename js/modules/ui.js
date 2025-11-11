// --- RENDERIZAÇÃO DE VIAGENS (Para a página /viagens) ---
export function renderTrips(trips = []) { // Adiciona valor padrão
    const tripHistoryBody = document.getElementById('trip-history-body');
    // Verifica se o elemento existe (pode não estar na página atual)
    if (!tripHistoryBody) return;

    const table = tripHistoryBody.closest('table'); // Encontra a tabela pai
    if (!table) return; // Sai se não encontrar a tabela

    const headerRow = table.querySelector('thead tr');
    // Adiciona cabeçalho de Ações dinamicamente se não existir
    if (headerRow && !headerRow.querySelector('.actions-header')) {
        headerRow.insertAdjacentHTML('beforeend', `<th scope="col" class="px-6 py-3 text-center actions-header">Ações</th>`);
    }

    // Ajusta o colspan do tfoot para a nova coluna
    const tfootCell = table.querySelector('tfoot tr td:first-child');
    if (tfootCell) tfootCell.setAttribute('colspan', '5'); // 5 Colunas + 1 Ação

    // Preenche o corpo da tabela
    tripHistoryBody.innerHTML = trips.length === 0
        ? `<tr><td colspan="6" class="text-center py-4 text-gray-400">Nenhuma viagem registrada.</td></tr>`
        : trips.map(trip => {
            // Usa valores padrão seguros caso algum dado esteja faltando
            if (!trip || !trip.id) return ''; // Pula linha se não houver dados ou id
            const displayDate = trip.date || 'N/A';
            const displayDay = trip.day || 'N/A';
            const displayCount = trip.count || 0;
            const displayZone = trip.zone || 'N/A';
            const displayEarnings = (trip.earnings || 0).toFixed(2);
            const tripId = trip.id; // Garante que o ID exista

            return `
                <tr class="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                    <td class="px-6 py-4 font-medium text-white whitespace-nowrap">${displayDate}</td>
                    <td class="px-6 py-4 capitalize">${displayDay}</td>
                    <td class="px-6 py-4">${displayCount}</td>
                    <td class="px-6 py-4">${displayZone}</td>
                    <td class="px-6 py-4 font-semibold">€ ${displayEarnings}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="window.showEditModal('${tripId}')" class="text-blue-400 hover:text-blue-300 font-medium mr-4">Editar</button>
                        <button onclick="window.confirmDeleteTrip('${tripId}')" class="text-red-400 hover:text-red-300 font-medium">Deletar</button>
                    </td>
                </tr>`;
        }).join('');

    // Calcula e exibe o total
    const totalEarnings = trips.reduce((sum, trip) => sum + (trip?.earnings || 0), 0);
    const totalEarningsEl = document.getElementById('total-earnings-trips');
    if (totalEarningsEl) totalEarningsEl.textContent = `€ ${totalEarnings.toFixed(2)}`;
}

// Mostra o modal para EDITAR uma viagem (na página /viagens)
export function showEditModal(tripId, trips = []) { // Adiciona valor padrão
    if (!tripId) return;
    const tripToEdit = trips.find(t => t.id === tripId);
    if (!tripToEdit) {
        console.warn(`showEditModal: Trip with ID ${tripId} not found.`);
        return;
    }
    const modal = document.getElementById('edit-trip-modal');
    if (!modal) return; // Verifica se o modal existe

    modal.querySelector('#edit-trip-id').value = tripToEdit.id;
    // Converte Timestamp do Firestore (ou Date) para formato YYYY-MM-DD
    let isoDate = tripToEdit.isoDate;
    if (isoDate && typeof isoDate.toDate === 'function') { // Se for Timestamp do Firestore
        isoDate = isoDate.toDate();
    } else if (!(isoDate instanceof Date)) { // Tenta converter se não for Date
        try { // Adiciona try-catch para datas inválidas
           isoDate = new Date(isoDate);
        } catch(e) { isoDate = null; }
    }
    // Define o valor apenas se a data for válida
    modal.querySelector('#edit-trip-date').value = isoDate && !isNaN(isoDate.getTime()) ? isoDate.toISOString().split('T')[0] : '';
    modal.querySelector('#edit-trip-count').value = tripToEdit.count || '';
    modal.querySelector('#edit-trip-zone').value = tripToEdit.zone || 'A'; // Padrão 'A' se não definido
    modal.classList.remove('hidden');
}


// --- RENDERIZAÇÃO DE COLABORADORES ---
export function renderEmployees(employees = []) { // Adiciona valor padrão
    const employeeList = document.getElementById('employee-list');
    if (!employeeList) return; // Sai se o elemento não existir
    employeeList.innerHTML = employees.length === 0
        ? `<p class="text-gray-400">Nenhum colaborador cadastrado.</p>`
        : employees.map(emp => {
            // Garante que emp exista e tenha id antes de criar o HTML
            if (!emp || !emp.id) return '';
            return `
                <div class="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow">
                    <span class="font-medium">${emp.name || 'Nome Indefinido'}</span>
                    <button onclick="window.selectEmployee('${emp.id}')" class="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-md transition-colors duration-150">Gerenciar</button>
                </div>`;
        }).join('');
}

// Atualiza a UI quando um colaborador é selecionado
export function selectEmployeeUI(employeeId, employeeName) {
    const promptSection = document.getElementById('select-employee-prompt');
    const calendarSection = document.getElementById('calendar-payment-section');
    const nameEl = document.getElementById('selected-employee-name');

    if (promptSection) promptSection.classList.add('hidden'); // Esconde prompt
    if (calendarSection) calendarSection.classList.remove('hidden'); // Mostra calendário
    if (nameEl) nameEl.textContent = employeeName || 'Colaborador'; // Define o nome
}


// --- LÓGICA DO CALENDÁRIO DE COLABORADORES ---
export function changeMonth(direction, state) {
    if (!state) return;
    state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + direction);
    generateCalendar(state); // Regenera o calendário para o novo mês
}

// Mostra o modal para registrar LUCRO em dias de semana
export function showWeekdayModal(fullDate, dayData) {
    const modal = document.getElementById('weekday-log-modal');
    if (!modal) return; // Sai se o modal não existir
    const dateDisplay = new Date(fullDate + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' });
    modal.querySelector('#weekday-log-modal-date').textContent = dateDisplay;
    modal.querySelector('#weekday-log-modal-fulldate').value = fullDate;
    // Usa ?? para tratar null/undefined como 0 para count
    modal.querySelector('#weekday-log-count').value = dayData?.count ?? '0';
    modal.querySelector('#weekday-log-zone').value = dayData?.zone || 'A'; // Padrão 'A'
    // Mostra botão de remover APENAS se o dia já tem dados de LUCRO registrados (profitEarnings existe e não é null)
    const hasProfitData = dayData && (dayData.profitEarnings !== undefined && dayData.profitEarnings !== null);
    modal.querySelector('#remove-weekday-log-btn').classList.toggle('hidden', !hasProfitData);
    modal.classList.remove('hidden'); // Exibe o modal
}

// Mostra o modal para registrar PAGAMENTO de domingos (LÓGICA ORIGINAL)
export function showSundayModal(fullDate, dayData) {
    const modal = document.getElementById('sunday-modal');
    if(!modal) return; // Sai se o modal não existir
    const dateDisplay = new Date(fullDate + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' });
    modal.querySelector('#sunday-modal-date').textContent = dateDisplay;
    modal.querySelector('#sunday-modal-fulldate').value = fullDate;
    modal.querySelector('#sunday-deliveries').value = dayData?.deliveries || ''; // Usa dados existentes ou vazio
    modal.querySelector('#sunday-rate').value = dayData?.rate || ''; // Usa dados existentes ou vazio
    // Mostra botão remover apenas se o dia tem dados registrados (type existe)
    modal.querySelector('#remove-sunday-btn').classList.toggle('hidden', !(dayData && dayData.type === 'sunday'));
    modal.classList.remove('hidden'); // Exibe o modal
}


// Gera o calendário INTERATIVO (RESTAURADO E CORRIGIDO)
export function generateCalendar(state) {
    if (!state || !state.selectedEmployeeId) return;
    const { currentCalendarDate, selectedEmployeeId, employees } = state;
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('month-year-display');
    if (!calendarGrid || !monthYearDisplay) {
        console.error("generateCalendar: Calendar grid or display element not found.");
        return;
    }

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    monthYearDisplay.textContent = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    calendarGrid.innerHTML = ''; // Limpa calendário anterior
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Domingo, 1=Segunda,...
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Adiciona divs vazias para alinhar o primeiro dia
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarGrid.insertAdjacentHTML('beforeend', `<div class="aspect-square"></div>`);
    }

    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (!employee) {
        console.error(`generateCalendar: Employee data not found for ID ${selectedEmployeeId}`);
        return; // Interrompe se não encontrar o funcionário
    }
    const workedDays = employee.worked_days || {}; // Pega os dias trabalhados

    // Loop para criar cada dia do calendário
    for (let day = 1; day <= daysInMonth; day++) {
        const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(fullDate + 'T00:00:00'); // Garante hora 00:00
        const dayOfWeek = dateObj.getDay(); // 0=Domingo, 1=Segunda,...
        const dayData = workedDays[fullDate]; // Dados salvos para este dia
        // Verifica se o dia está marcado para pagamento (tem 'type')
        const isWorkedForPayment = !!(dayData && dayData.type);

        const dayElement = document.createElement('div'); // Cria o elemento do dia
        let paymentForDay = 0;
        let profitIndicator = ''; // Ícone para indicar lucro registrado

        // Calcula o valor do PAGAMENTO a ser exibido no dia e verifica se há lucro
        if (isWorkedForPayment) {
            paymentForDay = (dayData.type === 'weekday') ? 40 : (dayData.earnings || 0);
            // Adiciona ícone se for dia de semana E tiver dados de lucro salvos (profitEarnings existe e é numérico)
            if (dayData.type === 'weekday' && typeof dayData.profitEarnings === 'number' && !isNaN(dayData.profitEarnings)) {
                profitIndicator = '<span class="absolute top-1 right-1 text-xs text-yellow-300" title="Lucro registrado">💰</span>';
            }
        }

        // Define as classes CSS (azul se trabalhado, cinza caso contrário)
        dayElement.className = `p-1 md:p-2 rounded-md cursor-pointer flex flex-col items-center justify-center aspect-square transition-colors duration-200 relative text-xs md:text-sm ${isWorkedForPayment ? 'bg-blue-600 text-white font-bold shadow-lg' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`;
        // Define o conteúdo HTML (número do dia, valor do pagamento e indicador de lucro)
        dayElement.innerHTML = `
            <span>${day}</span>
            ${isWorkedForPayment ? `<span class="text-[10px] md:text-xs mt-1 opacity-80">€${paymentForDay.toFixed(2)}</span>` : ''}
            ${profitIndicator}
        `;

        // **ADICIONA O LISTENER DE CLIQUE CORRETAMENTE**
        dayElement.addEventListener('click', () => {
            console.log(`Clicked on ${fullDate}, isWorkedForPayment: ${isWorkedForPayment}, dayOfWeek: ${dayOfWeek}`); // Log de depuração
            if (dayOfWeek === 0) { // Se for Domingo
                console.log("Opening Sunday Modal"); // Log
                showSundayModal(fullDate, dayData); // Abre modal de domingo (lógica original)
            } else { // Se for Dia de Semana (Seg-Sáb)
                console.log("Toggling Weekday Payment..."); // Log
                // 1. Chama a função do Firestore para MARCAR/DESMARCAR o pagamento
                window.toggleWeekdayPayment(fullDate, isWorkedForPayment, selectedEmployeeId)
                    .then(nowIsMarked => {
                         console.log(`toggleWeekdayPayment result for ${fullDate}: ${nowIsMarked}`); // Log
                        // 'nowIsMarked' será true se o dia ficou MARCADO, false se DESMARCADO
                        if (nowIsMarked) {
                            // 2. SE o dia ficou MARCADO, REBUSCA os dados atualizados
                            //    (o listener onSnapshot já deve ter atualizado o 'state')
                            //    e ABRE o modal de lucro.
                             console.log("Day is now marked, opening Weekday Modal..."); // Log
                            // É crucial esperar um pouco para o onSnapshot atualizar o 'state'
                            // ou usar os dados retornados pelo toggle, se possível (precisa ajustar firestore.js)
                            // Por segurança, buscamos do estado global após um pequeno delay
                            setTimeout(() => {
                                const currentEmployeeData = state.employees.find(e => e.id === selectedEmployeeId);
                                const currentDayData = currentEmployeeData?.worked_days?.[fullDate];
                                console.log("Data passed to showWeekdayModal:", currentDayData); // Log
                                showWeekdayModal(fullDate, currentDayData);
                            }, 150); // Delay para garantir atualização do estado via onSnapshot
                        } else {
                            console.log("Day is now unmarked, profit modal not opened."); // Log
                            // Se 'nowIsMarked' for false (dia foi desmarcado), não abre modal de lucro.
                        }
                    })
                    .catch(err => {
                        console.error("Error in weekday click sequence:", err);
                        // Adiciona um feedback visual temporário de erro
                        dayElement.classList.add('border-2', 'border-red-500');
                        setTimeout(() => dayElement.classList.remove('border-2', 'border-red-500'), 1000);
                    });
            }
        });
        calendarGrid.appendChild(dayElement); // Adiciona o dia pronto ao grid
    }
    // Calcula e exibe o resumo após gerar todos os dias
    calculateAndDisplaySummary(state);
}


// Calcula e exibe o resumo semanal com Lucro E Pagamento (REVISADO)
export function calculateAndDisplaySummary(state) {
    if (!state || !state.selectedEmployeeId) return;
    const { currentCalendarDate, selectedEmployeeId, employees } = state;
    const summaryDiv = document.getElementById('monthly-summary'); // Garante que o ID está correto
    const monthlyTotalDiv = document.getElementById('monthly-total');
    if (!summaryDiv || !monthlyTotalDiv) {
        console.error("calculateAndDisplaySummary: Summary or Total element not found.");
        return;
    }

    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    if (!employee) {
        summaryDiv.innerHTML = `<p class="text-red-400 p-4 text-center">Erro: Funcionário não encontrado.</p>`;
        monthlyTotalDiv.querySelector('span:last-child').textContent = `€ 0,00`;
        return;
    }
    const workedDays = employee.worked_days || {};

    const weeklyTotals = {}; // Objeto para agrupar por semana
    let monthTotalPayment = 0; // Total a pagar no mês

    // 1. Agrupa os dados por semana
    for (const dateStr in workedDays) {
         try {
            const date = new Date(dateStr + 'T00:00:00'); // Usa T00:00 para consistência
            // Processa apenas dias do mês/ano atual do calendário E que tenham 'type'
            if (!isNaN(date.getTime()) &&
                date.getFullYear() === currentCalendarDate.getFullYear() &&
                date.getMonth() === currentCalendarDate.getMonth() &&
                workedDays[dateStr]?.type) // Garante que 'type' existe
            {
                const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                const dayOfMonth = date.getDate();
                // Cálculo correto da semana do mês (considerando o dia da semana do dia 1º)
                const weekNumber = Math.ceil((dayOfMonth + startOfMonth.getDay()) / 7);

                if (!weeklyTotals[weekNumber]) { // Inicializa a semana se for a primeira vez
                    weeklyTotals[weekNumber] = { days: [], subtotalPayment: 0 };
                }

                const dayData = workedDays[dateStr];
                // Calcula pagamento e lucro baseado no 'type'
                const paymentForDay = (dayData.type === 'weekday') ? 40 : (dayData.earnings || 0);
                // Lucro só existe em dias de semana E se foi registrado (profitEarnings existe)
                const profitForDay = (dayData.type === 'weekday') ? dayData.profitEarnings : undefined;

                weeklyTotals[weekNumber].days.push({ date, dayData, paymentForDay, profitForDay });
                weeklyTotals[weekNumber].subtotalPayment += paymentForDay;
                monthTotalPayment += paymentForDay; // Acumula total do mês
            }
         } catch(e) { console.error(`Error processing date ${dateStr} in summary:`, e); }
    }

    // 2. Gera o HTML do resumo
    if (Object.keys(weeklyTotals).length === 0) {
        summaryDiv.innerHTML = `<p class="text-gray-400 p-4 text-center">Nenhum dia de pagamento registrado neste mês.</p>`;
        monthlyTotalDiv.querySelector('span:last-child').textContent = `€ 0,00`;
        return;
    }

    summaryDiv.innerHTML = Object.keys(weeklyTotals)
        .sort((a, b) => parseInt(a) - parseInt(b)) // Ordena as semanas numericamente
        .map(week => {
            const weekData = weeklyTotals[week];
            // Gera o HTML para cada dia dentro da semana
            const daysHtml = weekData.days
                .sort((a, b) => a.date - b.date) // Ordena os dias dentro da semana
                .map(({ date, dayData, paymentForDay, profitForDay }) => {
                    let profitHtml = '';
                    let paymentHtml = '';
                    let details = ''; // Detalhes da atividade (viagens ou entregas)

                    if (dayData.type === 'weekday') {
                        details = `(${dayData.count || 0} viagens)`;
                        // Mostra lucro apenas se 'profitForDay' tiver um valor numérico válido
                        profitHtml = (typeof profitForDay === 'number' && !isNaN(profitForDay))
                            ? `<span class="text-xs text-gray-400 w-40 text-right">Lucro Gerado: €${profitForDay.toFixed(2)}</span>`
                            : `<span class="text-xs text-gray-600 w-40 text-right">(Lucro não reg.)</span>`; // Indica que lucro não foi registrado
                        paymentHtml = `<span class="font-bold text-green-400 w-48 text-right">A Pagar: €${paymentForDay.toFixed(2)} (Diária)</span>`;
                    } else if (dayData.type === 'sunday') {
                        details = `(${dayData.deliveries || 0} entregas)`;
                        profitHtml = `<span class="text-xs text-gray-600 w-40 text-right">-</span>`; // Sem lucro explícito no domingo
                        paymentHtml = `<span class="font-bold text-green-400 w-48 text-right">A Pagar: €${paymentForDay.toFixed(2)}</span>`;
                    } else { return ''; } // Ignora tipos desconhecidos

                    // Monta a linha HTML para o dia
                    return `
                        <div class="flex justify-between items-center text-sm ml-4 py-1.5 border-b border-gray-700 last:border-b-0">
                            <span class="font-semibold w-28">${date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })} ${details}</span>
                            <div class="flex items-center gap-4 flex-grow justify-end">
                                ${profitHtml}
                                ${paymentHtml}
                            </div>
                        </div>
                    `;
                }).join(''); // Junta as linhas dos dias

            // Monta o bloco HTML da semana
            return `
                <div class="bg-gray-800 p-3 rounded-lg mb-3 shadow-md border border-gray-700">
                    <p class="font-bold mb-2 text-base text-blue-300">Semana ${week}</p>
                    <div class="space-y-1">${daysHtml}</div>
                    <div class="flex justify-end font-semibold border-t border-gray-600 mt-2 pt-2 text-base text-blue-300">
                        <span>Subtotal a Pagar: € ${weekData.subtotalPayment.toFixed(2)}</span>
                    </div>
                </div>`;
        }).join(''); // Junta os blocos das semanas

    // Atualiza o total do mês
    monthlyTotalDiv.querySelector('span:last-child').textContent = `€ ${monthTotalPayment.toFixed(2)}`;
}

