import { collection, onSnapshot, addDoc, doc, updateDoc, deleteField, deleteDoc, Timestamp, query, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let db, auth;
let currentUID;

// Inicializa as instâncias do Firestore e Auth e armazena o UID
export function initializeFirestore(database, authInstance) {
    db = database;
    auth = authInstance;
    currentUID = auth.currentUser?.uid;
    if (!currentUID) {
        console.error("Firestore Error: User not authenticated during initialization.");
    }
}

// Configura os listeners para atualizações em tempo real das coleções
export function setupFirestoreListeners(onTripsUpdate, onEmployeesUpdate) {
    if (!currentUID) {
        console.warn("Firestore listeners not set up: No authenticated user.");
        return { unsubscribeTrips: () => {}, unsubscribeEmployees: () => {} };
    }

    // Listener para a coleção de viagens do usuário atual
    const tripsQuery = query(collection(db, `users/${currentUID}/trips`), orderBy('isoDate', 'desc'));
    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
        const trips = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            // Garante que isoDate seja sempre um objeto Date, ou null se inválido
            isoDate: d.data().isoDate?.toDate ? d.data().isoDate.toDate() : (d.data().isoDate ? new Date(d.data().isoDate) : null)
        })).filter(trip => trip.isoDate instanceof Date && !isNaN(trip.isoDate)); // Filtra entradas com data inválida
        onTripsUpdate(trips); // Chama o callback com os dados atualizados
    }, (error) => console.error("Error listening to trips:", error)); // Log de erro no listener

    // Listener para a coleção de colaboradores do usuário atual
    const employeesRef = collection(db, `users/${currentUID}/employees`);
    const unsubscribeEmployees = onSnapshot(employeesRef, (snapshot) => {
        const employees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        onEmployeesUpdate(employees); // Chama o callback com os dados atualizados
    }, (error) => console.error("Error listening to employees:", error)); // Log de erro no listener

    // Retorna as funções de 'unsubscribe' para limpar os listeners depois
    return { unsubscribeTrips, unsubscribeEmployees };
}

// --- OPERAÇÕES DE VIAGENS (Página Controle de Viagens) ---
// Adiciona um novo registro de viagem
export async function handleAddTrip({ date, count, zone, earnings }) {
    if (!currentUID || !(date instanceof Date)) return alert("Erro: Dados da viagem inválidos.");
    try {
        const tripsRef = collection(db, `users/${currentUID}/trips`);
        await addDoc(tripsRef, {
            date: date.toLocaleDateString('pt-BR'),
            isoDate: Timestamp.fromDate(date), // Salva como Timestamp
            day: date.toLocaleDateString('pt-BR', { weekday: 'long' }),
            count: Number(count) || 0, // Garante que seja número
            zone: zone,
            earnings: Number(earnings) || 0 // Garante que seja número
        });
        console.log("Trip added successfully.");
    } catch (error) {
        console.error("Error adding trip:", error);
        alert("Erro ao adicionar viagem.");
    }
}

// Atualiza um registro de viagem existente
export async function handleUpdateTrip(tripId, { date, count, zone, earnings }) {
    if (!currentUID || !tripId || !(date instanceof Date)) return alert("Erro: Dados da atualização inválidos.");
    const tripDocRef = doc(db, `users/${currentUID}/trips`, tripId);
    try {
        await updateDoc(tripDocRef, {
            date: date.toLocaleDateString('pt-BR'),
            isoDate: Timestamp.fromDate(date),
            day: date.toLocaleDateString('pt-BR', { weekday: 'long' }),
            count: Number(count) || 0,
            zone: zone,
            earnings: Number(earnings) || 0
        });
        console.log("Trip updated successfully.");
    } catch (error) {
        console.error("Error updating trip:", error);
        alert("Erro ao atualizar viagem.");
    }
}

// Deleta um registro de viagem
export async function handleDeleteTrip(tripId) {
    if (!currentUID || !tripId) return;
    const tripDocRef = doc(db, `users/${currentUID}/trips`, tripId);
    try {
        await deleteDoc(tripDocRef);
        console.log("Trip deleted successfully.");
    } catch (error) {
        console.error("Error deleting trip:", error);
        alert("Erro ao deletar viagem.");
    }
}

// --- OPERAÇÕES DE COLABORADORES ---
// Adiciona um novo colaborador
export async function handleAddEmployee(employeeName) {
    if (!currentUID || !employeeName || !employeeName.trim()) return;
    try {
        await addDoc(collection(db, `users/${currentUID}/employees`), {
             name: employeeName.trim(),
             worked_days: {} // Inicializa worked_days como objeto vazio
        });
        console.log("Employee added successfully.");
    } catch (error) {
        console.error("Error adding employee:", error);
        alert("Erro ao adicionar colaborador.");
    }
}

// MARCA/DESMARCA PAGAMENTO de dia de semana (€40)
export async function toggleWeekdayPayment(fullDate, isCurrentlyMarked, selectedEmployeeId) {
    if (!currentUID || !selectedEmployeeId || !fullDate) {
         console.error("toggleWeekdayPayment: Missing required parameters.");
         return Promise.resolve(!!isCurrentlyMarked); // Retorna estado atual se faltar dados
    }
    const employeeDocRef = doc(db, `users/${currentUID}/employees`, selectedEmployeeId);
    try {
        if (isCurrentlyMarked) {
            // Se já está marcado, remove APENAS o 'type' para desmarcar o pagamento,
            // mas mantém os dados de lucro (count, zone, profitEarnings) se existirem.
            await updateDoc(employeeDocRef, { [`worked_days.${fullDate}.type`]: deleteField() });
            console.log(`Weekday ${fullDate} unmarked for payment (profit data kept if exists).`);
            return false; // Dia foi desmarcado para pagamento
        } else {
            // Se não está marcado, marca APENAS com o 'type: weekday'.
            // Usa setDoc com merge: true para não apagar dados de lucro existentes.
            await setDoc(employeeDocRef, { worked_days: { [fullDate]: { type: 'weekday' } } }, { merge: true });
            console.log(`Weekday ${fullDate} marked for payment.`);
            return true; // Dia foi marcado para pagamento
        }
    } catch (error) {
        console.error("Error toggling weekday payment:", error);
        alert("Erro ao marcar/desmarcar o dia.");
        return Promise.resolve(!!isCurrentlyMarked); // Retorna estado anterior em caso de erro
    }
}

// SALVA/ATUALIZA DADOS DE LUCRO para dia de semana (Viagens/Zona)
export async function handleWeekdayFormSubmit(fullDate, count, zone, priceTable, selectedEmployeeId) {
    if (!currentUID || !selectedEmployeeId || !fullDate) return;
    // Se count for 0, chama a função para remover dados de lucro
    if (count === 0) {
        await handleRemoveWeekdayProfitData(fullDate, selectedEmployeeId); // Chama a função correta
        return;
    }
    const profitEarnings = count * (priceTable?.standard?.[zone] || 0);
    const profitData = { count: Number(count) || 0, zone: zone, profitEarnings: Number(profitEarnings) || 0 };
    const employeeDocRef = doc(db, `users/${currentUID}/employees`, selectedEmployeeId);
    try {
        // Usa setDoc com merge para adicionar/atualizar dados de lucro sem apagar 'type'
        await setDoc(employeeDocRef, { worked_days: { [fullDate]: profitData } }, { merge: true });
        console.log(`Profit data saved/updated for weekday ${fullDate}:`, profitData);
    } catch (error) {
        console.error("Error saving weekday profit data:", error);
        alert("Erro ao salvar dados de lucro do dia.");
    }
}

// NOME CORRIGIDO E EXPORTADO
// REMOVE APENAS DADOS DE LUCRO (mantém a marcação de pagamento 'type: weekday')
export async function handleRemoveWeekdayProfitData(fullDate, selectedEmployeeId) {
     if (!currentUID || !selectedEmployeeId || !fullDate) return;
     const employeeDocRef = doc(db, `users/${currentUID}/employees`, selectedEmployeeId);
     try {
         // Apaga apenas os campos relacionados ao lucro
         await updateDoc(employeeDocRef, {
             [`worked_days.${fullDate}.count`]: deleteField(),
             [`worked_days.${fullDate}.zone`]: deleteField(),
             [`worked_days.${fullDate}.profitEarnings`]: deleteField()
         });
         console.log(`Profit data removed for weekday ${fullDate}. Payment mark (type) remains if existed.`);
     } catch (error) {
         console.error("Error removing weekday profit data:", error);
     }
}

// SALVA DOMINGO (Entregas/Taxa)
export async function handleSundayFormSubmit(fullDate, deliveries, rate, selectedEmployeeId) {
    if (!currentUID || !selectedEmployeeId || !fullDate) return;
    const earnings = (Number(deliveries) || 0) * (Number(rate) || 0);
    const sundayData = {
        type: 'sunday',
        deliveries: Number(deliveries) || 0,
        rate: Number(rate) || 0,
        earnings: earnings
    };
    const employeeDocRef = doc(db, `users/${currentUID}/employees`, selectedEmployeeId);
    try {
        await updateDoc(employeeDocRef, { [`worked_days.${fullDate}`]: sundayData });
        console.log(`Sunday data saved/updated for ${fullDate}:`, sundayData);
    } catch (error) {
        console.error("Error saving Sunday:", error);
        alert("Erro ao salvar dados de domingo.");
    }
}

// REMOVE DOMINGO
export async function handleRemoveSunday(fullDate, selectedEmployeeId) {
    if (!currentUID || !selectedEmployeeId || !fullDate) return;
    const employeeDocRef = doc(db, `users/${currentUID}/employees`, selectedEmployeeId);
    try {
        await updateDoc(employeeDocRef, { [`worked_days.${fullDate}`]: deleteField() });
        console.log(`Sunday ${fullDate} removed.`);
    } catch (error) {
        console.error("Error removing Sunday:", error);
        alert("Erro ao remover dados de domingo.");
    }
}

