import {
    initializeFirestore, setupFirestoreListeners,
    handleAddTrip, handleUpdateTrip, handleDeleteTrip,
    handleAddEmployee, handleWeekdayFormSubmit, handleRemoveWeekdayProfitData, // Renomeado de handleRemoveWeekday
    handleSundayFormSubmit, handleRemoveSunday,
    toggleWeekdayPayment // Função essencial para marcar/desmarcar pagamento
} from './modules/firestore.js';

import {
    renderTrips, renderEmployees, showEditModal, selectEmployeeUI,
    generateCalendar, changeMonth, calculateAndDisplaySummary,
    showWeekdayModal, showSundayModal // Garante que funções de abrir modal estão importadas
} from './modules/ui.js';

import { initializeCharts, updateAllCharts } from './modules/charts.js';
import { generatePDFReport } from './modules/reports.js';

// --- ESTADO GLOBAL DA APLICAÇÃO ---
export const state = {
    db: null,
    auth: null,
    trips: [],
    employees: [],
    priceTable: {
        standard: { 'A': 1.50, 'B': 1.64, 'C': 1.90, 'Green': 1.55 },
        sunday: { 'A': 1.80, 'B': 1.90, 'C': 2.20, 'Green': 1.40 }
    },
    currentCalendarDate: new Date(),
    selectedEmployeeId: null,
    charts: {} // Objeto para armazenar instâncias dos gráficos
};

// --- FUNÇÕES GLOBAIS (para onclick e chamadas pela UI) ---
window.showEditModal = (tripId) => showEditModal(tripId, state.trips);
window.confirmDeleteTrip = (tripId) => {
    // Adiciona a confirmação aqui para evitar chamadas acidentais
    if (confirm("Você tem certeza que deseja deletar este registro de viagem? A ação não pode ser desfeita.")) {
        handleDeleteTrip(tripId);
    }
};
window.selectEmployee = (employeeId) => {
    state.selectedEmployeeId = employeeId;
    const employee = state.employees.find(e => e.id === employeeId);
    if (employee) {
        selectEmployeeUI(employee.id, employee.name); // Atualiza a UI para mostrar nome e calendário
        state.currentCalendarDate = new Date(); // Reseta para o mês atual ao selecionar funcionário
        generateCalendar(state); // Gera o calendário para o funcionário selecionado
    } else {
        console.warn(`selectEmployee: Employee with ID ${employeeId} not found in state.`);
        // Opcional: Esconder a seção do calendário se o funcionário não for encontrado
        const promptSection = document.getElementById('select-employee-prompt');
        const calendarSection = document.getElementById('calendar-payment-section');
        if(promptSection) promptSection.classList.remove('hidden');
        if(calendarSection) calendarSection.classList.add('hidden');
    }
};
// Expõe a função do Firestore para marcar/desmarcar pagamento, permitindo que a UI a chame
window.toggleWeekdayPayment = toggleWeekdayPayment;

// --- CARREGAMENTO DINÂMICO DE PÁGINAS ---
const contentArea = document.getElementById('content-area');
const navButtons = document.querySelectorAll('.nav-button');

// Função para carregar o HTML da página e chamar o inicializador correspondente (CORRIGIDA)
async function loadPage(pageName = 'dashboard') {
    console.log(`Attempting to load page: ${pageName}`);
    // Usa caminho absoluto a partir da raiz do site
    const pagePath = `/pages/${pageName}.html`;

    try {
        const response = await fetch(pagePath);

        if (!response.ok) {
            // Lança um erro claro se o arquivo HTML não for encontrado
            throw new Error(`Failed to fetch ${pagePath}: ${response.status} ${response.statusText}`);
        }

        contentArea.innerHTML = await response.text(); // Carrega o HTML no container
        console.log(`Page ${pageName} loaded successfully.`);

        // Chama a função de inicialização específica da página APÓS o HTML carregar
        if (pageName === 'dashboard') initDashboard();
        if (pageName === 'viagens') initViagens();
        if (pageName === 'colaboradores') initColaboradores();

        // Atualiza o estado visual dos botões de navegação
        updateNavButtons(pageName);

    } catch (error) {
        // Exibe o erro claramente no console E na interface do usuário
        console.error("Error loading page:", error);
        contentArea.innerHTML = `<div class="bg-red-900 text-white p-4 rounded-lg m-4">
                                    <h3 class="font-bold">Erro ao carregar a página '${pageName}'</h3>
                                    <p>Verifique se o arquivo <code class="bg-red-700 px-1 rounded">${pagePath}</code> existe e está acessível.</p>
                                    <p class="mt-2 text-sm">Detalhes: ${error.message}</p>
                                 </div>`;
        updateNavButtons(pageName); // Atualiza botões mesmo em erro
    }
}

// Atualiza a classe 'tab-active' nos botões da sidebar
function updateNavButtons(activePage) {
    navButtons.forEach(button => {
        button.classList.toggle('tab-active', button.dataset.page === activePage);
    });
}

// --- INICIALIZADORES DE PÁGINA ---

// Inicializa a página Dashboard
function initDashboard() {
    console.log("Initializing Dashboard...");
    initializeCharts(state); // Inicializa os contextos dos gráficos
    updateDashboard(); // Popula KPIs e gráficos com dados
}

// Inicializa a página Controle de Viagens
function initViagens() {
     console.log("Initializing Viagens...");
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener(event, handler);
        else console.warn(`initViagens: Element with ID '${id}' not found.`);
    };

    // Listener para ADICIONAR nova viagem
    safeAddEventListener('trip-form', 'submit', (e) => {
        e.preventDefault();
        const dateInput = document.getElementById('trip-date')?.value;
        const count = parseInt(document.getElementById('trip-count')?.value) || 0;
        const zone = document.getElementById('trip-zone')?.value;
        if (dateInput && count > 0 && zone) {
            const date = new Date(dateInput + 'T00:00:00'); // Garante hora 00:00
            if (isNaN(date.getTime())) return alert("Data inválida."); // Validação da data
            const dayOfWeek = date.getDay();
            const table = (dayOfWeek === 0) ? state.priceTable.sunday : state.priceTable.standard;
            if (!table || table[zone] === undefined) return alert(`Erro: Zona '${zone}' inválida.`);
            const earnings = count * table[zone];
            handleAddTrip({ date, count, zone, earnings }); // Chama Firestore
            e.target.reset(); // Limpa o formulário
            const tripDate = document.getElementById('trip-date');
            if(tripDate) tripDate.valueAsDate = new Date(); // Reseta data para hoje
        } else {
            alert("Por favor, preencha todos os campos da viagem (Data, Nº > 0, Zona).");
        }
    });

    // Listener para SALVAR edição de viagem (modal)
    safeAddEventListener('edit-trip-form', 'submit', (e) => {
        e.preventDefault();
        const tripId = document.getElementById('edit-trip-id')?.value;
        const dateInput = document.getElementById('edit-trip-date')?.value;
        const count = parseInt(document.getElementById('edit-trip-count')?.value) || 0;
        const zone = document.getElementById('edit-trip-zone')?.value;
        if (tripId && dateInput && count > 0 && zone) {
            const date = new Date(dateInput + 'T00:00:00');
            if (isNaN(date.getTime())) return alert("Data inválida.");
            const dayOfWeek = date.getDay();
            const table = (dayOfWeek === 0) ? state.priceTable.sunday : state.priceTable.standard;
            if (!table || table[zone] === undefined) return alert(`Erro: Zona '${zone}' inválida.`);
            const earnings = count * table[zone];
            handleUpdateTrip(tripId, { date, count, zone, earnings }); // Chama Firestore
            document.getElementById('edit-trip-modal')?.classList.add('hidden'); // Esconde modal
        } else {
             alert("Por favor, preencha todos os campos para editar a viagem (Data, Nº > 0, Zona).");
        }
    });

    // Listener para CANCELAR edição (modal)
    safeAddEventListener('cancel-edit-btn', 'click', () => {
        document.getElementById('edit-trip-modal')?.classList.add('hidden');
    });

    // Define a data inicial do formulário de adicionar para hoje
    const tripDateInput = document.getElementById('trip-date');
    if (tripDateInput) tripDateInput.valueAsDate = new Date();

    // Renderiza a tabela de viagens com os dados atuais do estado
    renderTrips(state.trips);
}

// Inicializa a página Colaboradores
function initColaboradores() {
     console.log("Initializing Colaboradores...");
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`initColaboradores: Element with ID '${id}' not found.`);
        }
    };

    // --- Listeners Principais ---
    safeAddEventListener('employee-form', 'submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('employee-name');
        if (nameInput?.value.trim()) {
            handleAddEmployee(nameInput.value.trim()); // Chama Firestore
            nameInput.value = ''; // Limpa campo
        }
    });
    safeAddEventListener('prev-month-btn', 'click', () => changeMonth(-1, state));
    safeAddEventListener('next-month-btn', 'click', () => changeMonth(1, state));
    safeAddEventListener('generate-pdf-btn', 'click', () => generatePDFReport(state));

    // --- Listeners do Modal de DIA DE SEMANA (LUCRO) ---
    safeAddEventListener('weekday-log-form', 'submit', (e) => {
        e.preventDefault();
        const fullDate = document.getElementById('weekday-log-modal-fulldate')?.value;
        const countInput = document.getElementById('weekday-log-count');
        const count = parseInt(countInput?.value) || 0; // Garante que seja número >= 0
        const zone = document.getElementById('weekday-log-zone')?.value;
        if (fullDate && state.selectedEmployeeId) {
            // Chama a função do Firestore para salvar/atualizar DADOS DE LUCRO
            handleWeekdayFormSubmit(fullDate, count, zone, state.priceTable, state.selectedEmployeeId);
            document.getElementById('weekday-log-modal')?.classList.add('hidden');
        } else {
             console.error("Weekday submit failed: Missing date or selectedEmployeeId");
        }
    });
    safeAddEventListener('cancel-weekday-log-btn', 'click', () => document.getElementById('weekday-log-modal')?.classList.add('hidden'));
    // Botão "Remover Dia" no modal de lucro agora chama a função específica para remover lucro
    safeAddEventListener('remove-weekday-log-btn', 'click', () => {
        const fullDate = document.getElementById('weekday-log-modal-fulldate')?.value;
        if (fullDate && state.selectedEmployeeId) {
             if (confirm("Remover apenas os dados de lucro (viagens/zona) deste dia? O pagamento (€40) será mantido.")) {
                 // Chama a função que apaga APENAS os dados de lucro no Firestore
                 handleRemoveWeekdayProfitData(fullDate, state.selectedEmployeeId);
                 document.getElementById('weekday-log-modal')?.classList.add('hidden');
             }
        }
    });

    // --- Listeners do Modal de DOMINGO (PAGAMENTO) ---
    safeAddEventListener('sunday-form', 'submit', (e) => {
        e.preventDefault();
        const fullDate = document.getElementById('sunday-modal-fulldate')?.value;
        const deliveries = parseInt(document.getElementById('sunday-deliveries')?.value) || 0;
        const rate = parseFloat(document.getElementById('sunday-rate')?.value) || 0;
        if (fullDate && state.selectedEmployeeId) {
            handleSundayFormSubmit(fullDate, deliveries, rate, state.selectedEmployeeId); // Chama Firestore
            document.getElementById('sunday-modal')?.classList.add('hidden');
        } else {
             console.error("Sunday submit failed: Missing date or selectedEmployeeId");
        }
    });
    safeAddEventListener('cancel-sunday-btn', 'click', () => document.getElementById('sunday-modal')?.classList.add('hidden'));
    safeAddEventListener('remove-sunday-btn', 'click', () => {
        const fullDate = document.getElementById('sunday-modal-fulldate')?.value;
        if (fullDate && state.selectedEmployeeId) {
             if (confirm("Remover o registro deste domingo?")) {
                 handleRemoveSunday(fullDate, state.selectedEmployeeId); // Chama Firestore
                 document.getElementById('sunday-modal')?.classList.add('hidden');
             }
        }
    });

    // Renderiza a lista inicial de funcionários
    renderEmployees(state.employees);

    // Se um funcionário já estava selecionado (ex: após recarregar a página),
    // tenta reexibir o calendário dele.
    if (state.selectedEmployeeId) {
        const employee = state.employees.find(e => e.id === state.selectedEmployeeId);
        if (employee) {
            selectEmployeeUI(employee.id, employee.name);
            generateCalendar(state);
        } else {
            state.selectedEmployeeId = null; // Limpa se o ID antigo não for mais válido
        }
    }
     // Garante que o prompt seja exibido se NENHUM funcionário estiver selecionado
     if (!state.selectedEmployeeId) {
        const promptSection = document.getElementById('select-employee-prompt');
        const calendarSection = document.getElementById('calendar-payment-section');
        if(promptSection) promptSection.classList.remove('hidden');
        if(calendarSection) calendarSection.classList.add('hidden');
     }
}

// Atualiza os KPIs e gráficos do Dashboard (REVISADO)
function updateDashboard() {
    const dashboardElement = document.getElementById('total-viagens-mes'); // Verifica um elemento essencial
    if (!dashboardElement) return; // Sai se não estiver na página do dashboard

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Filtra viagens do mês/ano atual, tratando datas inválidas
    const monthlyTrips = state.trips.filter(trip => {
        const tripDate = trip?.isoDate; // Acessa isoDate com segurança
        return tripDate instanceof Date && !isNaN(tripDate) &&
               tripDate.getFullYear() === currentYear &&
               tripDate.getMonth() === currentMonth;
    });

    // Calcula KPIs das viagens (com segurança)
    const totalViagensMes = monthlyTrips.reduce((sum, trip) => sum + (trip?.count || 0), 0);
    const ganhosMesViagens = monthlyTrips.reduce((sum, trip) => sum + (trip?.earnings || 0), 0);

    // Calcula KPI de Pagamentos aos Colaboradores (com segurança)
    const pagamentosMesColaboradores = state.employees.reduce((totalPayment, emp) => {
        const workedDays = emp?.worked_days || {}; // Acessa worked_days com segurança
        const monthPayment = Object.keys(workedDays).reduce((sum, dateStr) => {
            try {
                const date = new Date(dateStr + 'T00:00:00'); // Garante hora 00:00
                // Verifica se data é válida E pertence ao mês/ano atual
                if (!isNaN(date.getTime()) && date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
                    const dayData = workedDays[dateStr];
                    // Soma apenas se o dia tiver um 'type' (indicando pagamento)
                    if (dayData && dayData.type === 'weekday') {
                        return sum + 40; // Adiciona diária
                    } else if (dayData && dayData.type === 'sunday') {
                        return sum + (dayData.earnings || 0); // Adiciona ganho de domingo
                    }
                }
            } catch(e) { console.warn(`Invalid date string in worked_days: ${dateStr}`); }
            return sum; // Retorna soma atual se data/tipo inválido
        }, 0);
        return totalPayment + monthPayment;
    }, 0);

    // Atualiza os elementos HTML do Dashboard (com segurança)
    const setElementText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    setElementText('total-viagens-mes', totalViagensMes);
    setElementText('ganhos-mes-viagens', `€ ${ganhosMesViagens.toFixed(2)}`);
    setElementText('total-colaboradores', state.employees.length);
    setElementText('pagamentos-mes-colaboradores', `€ ${pagamentosMesColaboradores.toFixed(2)}`);

    // Atualiza todos os gráficos (função do charts.js)
    updateAllCharts(state);
 }


// --- PONTO DE ENTRADA DA APLICAÇÃO ---
window.addEventListener('auth-ready', () => {
    // Garante que db e auth foram inicializados corretamente pelo script principal (index.html)
    if (window.db && window.auth) {
        state.db = window.db;
        state.auth = window.auth;
        initializeFirestore(state.db, state.auth); // Inicializa o módulo Firestore

        // Callback para quando os dados de VIAGENS mudam
        const onTripsUpdate = (updatedTrips) => {
            console.log("Firestore: Trips updated", updatedTrips.length); // Log
            state.trips = updatedTrips;
            // Re-renderiza partes da UI que dependem das viagens
            if (document.getElementById('trip-history-body')) renderTrips(state.trips);
            if (document.getElementById('total-viagens-mes')) updateDashboard(); // Atualiza dashboard se estiver visível
        };

        // Callback para quando os dados de COLABORADORES mudam
        const onEmployeesUpdate = (updatedEmployees) => {
            console.log("Firestore: Employees updated", updatedEmployees.length); // Log
            state.employees = updatedEmployees;
             // Re-renderiza partes da UI que dependem dos funcionários
            if (document.getElementById('employee-list')) renderEmployees(state.employees);
            // Se um funcionário estiver selecionado E o calendário estiver na tela, regenera o calendário
            if (state.selectedEmployeeId && document.getElementById('calendar-grid')) {
                 console.log("Regenerating calendar due to employee update..."); // Log
                 generateCalendar(state);
             }
            if (document.getElementById('total-viagens-mes')) updateDashboard(); // Atualiza dashboard se estiver visível
        };

        // Inicia os listeners do Firestore e guarda as funções de unsubscribe
        const { unsubscribeTrips, unsubscribeEmployees } = setupFirestoreListeners(onTripsUpdate, onEmployeesUpdate);
        
        // Limpa listeners quando a aba for fechada (boa prática)
        window.addEventListener('beforeunload', () => {
            if (typeof unsubscribeTrips === 'function') unsubscribeTrips();
            if (typeof unsubscribeEmployees === 'function') unsubscribeEmployees();
             console.log("Firestore listeners unsubscribed.");
        });

        loadPage('dashboard'); // Carrega a página inicial do dashboard

        // Adiciona listener para a navegação da Sidebar
        const sidebarNav = document.getElementById('sidebar-nav');
        if (sidebarNav) {
            sidebarNav.addEventListener('click', (e) => {
                const button = e.target.closest('.nav-button');
                if (button?.dataset.page) {
                    loadPage(button.dataset.page); // Carrega a página clicada
                }
            });
        } else {
            console.warn("Sidebar navigation element ('sidebar-nav') not found.");
        }
    } else {
         // Erro crítico se db ou auth não foram definidos globalmente
         console.error("CRITICAL ERROR: Firebase db or auth instance not found on window object. Check Firebase initialization script.");
         contentArea.innerHTML = `<p class="text-red-400 p-4">Erro crítico na inicialização do Firebase. Verifique o console.</p>`;
    }
});

