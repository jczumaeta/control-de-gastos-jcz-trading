const STORAGE_KEY = 'gastos-tracker-v1';
const SUPABASE_URL = 'https://sncxzaoofbpwfekdumej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY3h6YW9vZmJwd2Zla2R1bWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODM1ODAsImV4cCI6MjEwNTI1OTU4MH0.xMl7tyuKyGhmgq2jh_etnasWkpdhCaVoqVSA8wZjNYg';
const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  view: 'daily',
  records: loadRecords(),
};

const expenseForm = document.getElementById('expenseForm');
const viewContainer = document.getElementById('viewContainer');
const viewTitle = document.getElementById('viewTitle');
const summaryPill = document.getElementById('summaryPill');
const exportBtn = document.getElementById('exportCsvBtn');
const shareBtn = document.getElementById('shareBtn');
const tabButtons = document.querySelectorAll('.tab-button');
const speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const nativeSpeechRecognition = window.Capacitor?.Plugins?.SpeechRecognition;
const cameraInput = document.getElementById('cameraInput');
const fileInput = document.getElementById('fileInput');
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const receiptStatus = document.getElementById('receiptStatus');
const cameraModal = document.getElementById('cameraModal');
const cameraPreview = document.getElementById('cameraPreview');
const capturePhotoBtn = document.getElementById('capturePhotoBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const shareModal = document.getElementById('shareModal');
const shareExcelBtn = document.getElementById('shareExcelBtn');
const sharePdfBtn = document.getElementById('sharePdfBtn');
const shareBothBtn = document.getElementById('shareBothBtn');
const shareWhatsappBtn = document.getElementById('shareWhatsappBtn');
const closeShareBtn = document.getElementById('closeShareBtn');
const authGate = document.getElementById('authGate');
const appContent = document.getElementById('appContent');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authMessage = document.getElementById('authMessage');
const createAccountBtn = document.getElementById('createAccountBtn');
const resendConfirmationBtn = document.getElementById('resendConfirmationBtn');
const userSession = document.getElementById('userSession');
const userEmail = document.getElementById('userEmail');
const signOutBtn = document.getElementById('signOutBtn');
let cameraStream = null;
let capturedImageFile = null;
let currentUser = null;

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function cloudRecordFromLocal(record) {
  return {
    id: record.id,
    user_id: currentUser.id,
    item: record.item,
    fecha: record.fecha,
    numero_factura: record.numeroFactura || '',
    total_pagado: Number(record.totalPagado || 0),
    descripcion: record.descripcion || '',
    imagen: record.imagen || '',
  };
}

function localRecordFromCloud(record) {
  return {
    id: record.id,
    item: record.item,
    fecha: record.fecha,
    numeroFactura: record.numero_factura || '',
    totalPagado: Number(record.total_pagado || 0),
    descripcion: record.descripcion || '',
    imagen: record.imagen || '',
  };
}

async function loadCloudRecords() {
  const { data, error } = await cloudClient
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw error;

  const localRecords = state.records.slice();
  if (!data?.length && localRecords.length) {
    const { error: migrationError } = await cloudClient
      .from('gastos')
      .insert(localRecords.map(cloudRecordFromLocal));
    if (migrationError) throw migrationError;
    state.records = localRecords;
    return;
  }

  state.records = (data || []).map(localRecordFromCloud);
  saveRecords();
}

async function insertCloudRecord(record) {
  const { error } = await cloudClient.from('gastos').insert(cloudRecordFromLocal(record));
  if (error) throw error;
}

async function deleteCloudRecord(recordId) {
  const { error } = await cloudClient.from('gastos').delete().eq('id', recordId);
  if (error) throw error;
}

function setAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? 'var(--danger)' : 'var(--success)';
}

function showAuthenticatedApp(user) {
  currentUser = user;
  authGate.hidden = true;
  appContent.hidden = false;
  userSession.hidden = false;
  userEmail.textContent = user.email;
}

function showAuthGate() {
  currentUser = null;
  authGate.hidden = false;
  appContent.hidden = true;
  userSession.hidden = true;
}

async function authenticate(email, password, createAccount = false) {
  if (!cloudClient) throw new Error('No se pudo cargar el servicio de autenticación.');
  const result = createAccount
    ? await cloudClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })
    : await cloudClient.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  if (createAccount && !result.data.session) {
    resendConfirmationBtn.hidden = false;
    setAuthMessage('Cuenta creada. Revisa tu correo para confirmar la cuenta.', false);
    return;
  }
  await handleSession(result.data.session);
}

async function handleSession(session) {
  if (!session?.user) {
    showAuthGate();
    return;
  }
  showAuthenticatedApp(session.user);
  try {
    await loadCloudRecords();
    renderView();
  } catch (error) {
    setAuthMessage(`No se pudieron cargar los gastos: ${error.message}`);
    await cloudClient.auth.signOut();
  }
}

function bindAuth() {
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAuthMessage('Conectando...', false);
    try {
      await authenticate(authEmail.value.trim(), authPassword.value, false);
    } catch (error) {
      setAuthMessage(error.message || 'Correo o contraseña incorrectos.');
    }
  });

  createAccountBtn.addEventListener('click', async () => {
    if (!authForm.reportValidity()) return;
    setAuthMessage('Creando cuenta...', false);
    try {
      await authenticate(authEmail.value.trim(), authPassword.value, true);
    } catch (error) {
      setAuthMessage(error.message || 'No se pudo crear la cuenta.');
    }
  });

  resendConfirmationBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    if (!email) {
      setAuthMessage('Escribe tu correo electrónico antes de reenviar la confirmación.');
      return;
    }
    try {
      const { error } = await cloudClient.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setAuthMessage('Correo reenviado. Revisa spam, promociones y correo no deseado.', false);
    } catch (error) {
      setAuthMessage(error.message || 'No se pudo reenviar el correo.');
    }
  });

  signOutBtn.addEventListener('click', async () => {
    await cloudClient.auth.signOut();
    state.records = [];
    renderView();
  });
}

function populateVoiceValue(targetName, spokenText) {
  const input = expenseForm.elements.namedItem(targetName);
  if (!input) return;

  if (targetName === 'totalPagado') {
    const numericText = spokenText.replace(/[^\d,.-]/g, '').replace(',', '.');
    if (numericText) {
      input.value = numericText;
    }
    return;
  }

  if (targetName === 'fecha') {
    const normalized = spokenText.replace(/\s+/g, '').toLowerCase();
    const match = normalized.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      const [day, month, year] = match.slice(1);
      const fullYear = year.length === 2 ? `20${year}` : year;
      input.value = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return;
    }
  }

  input.value = spokenText.trim();
}

function bindVoiceButtons() {
  document.querySelectorAll('.voice-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetName = button.dataset.target;
      if (!speechRecognition && !nativeSpeechRecognition) {
        alert('Este navegador no admite dictado por voz. Abre la app en Google Chrome o Microsoft Edge y permite el acceso al micrófono.');
        return;
      }

      button.textContent = '…';
      button.disabled = true;

      if (nativeSpeechRecognition) {
        try {
          const permission = await nativeSpeechRecognition.requestPermissions();
          if (permission.speechRecognition !== 'granted' && permission.microphone !== 'granted') {
            throw new Error('permission-denied');
          }

          const availability = await nativeSpeechRecognition.available();
          if (!availability.available) {
            throw new Error('unavailable');
          }

          const result = await nativeSpeechRecognition.start({
            language: 'es-PE',
            maxResults: 1,
            partialResults: false,
            popup: true,
          });
          const spokenText = result.matches?.[0] || '';
          if (spokenText) populateVoiceValue(targetName, spokenText);
          button.textContent = '🎙';
          button.disabled = false;
          return;
        } catch (error) {
          button.textContent = '🎙';
          button.disabled = false;
          alert(error.message === 'permission-denied'
            ? 'Permite el micrófono y el reconocimiento de voz en los permisos de Android.'
            : 'El reconocimiento de voz no está disponible en este teléfono. Verifica que Google tenga habilitado el servicio de voz.');
          return;
        }
      }

      const recognition = new speechRecognition();
      recognition.lang = 'es-PE';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      const resetButton = () => {
        button.textContent = '🎙';
        button.disabled = false;
      };

      recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript;
        populateVoiceValue(targetName, spokenText);
      };

      recognition.onend = resetButton;

      recognition.onerror = (event) => {
        resetButton();
        const message = event.error === 'not-allowed'
          ? 'El micrófono está bloqueado. Permite el acceso al micrófono en el navegador y vuelve a intentarlo.'
          : `No se pudo reconocer la voz (${event.error || 'error desconocido'}). Habla cerca del micrófono y vuelve a intentarlo.`;
        alert(message);
      };

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
          microphone.getTracks().forEach((track) => track.stop());
        }
        recognition.start();
      } catch (error) {
        resetButton();
        alert('No se pudo iniciar el micrófono. Revisa que la aplicación tenga permiso para usarlo y vuelve a intentarlo.');
      }
    });
  });
}

function bindReceiptButtons() {
  takePhotoBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInput.click();
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      cameraPreview.srcObject = cameraStream;
      cameraModal.hidden = false;
    } catch (error) {
      alert('No se pudo acceder a la cámara. Permite el acceso a la cámara o usa "Elegir archivo".');
    }
  });

  chooseFileBtn.addEventListener('click', () => fileInput.click());

  cameraInput.addEventListener('change', () => {
    if (cameraInput.files.length) {
      capturedImageFile = cameraInput.files[0];
      fileInput.value = '';
      receiptStatus.textContent = `Comprobante seleccionado: ${capturedImageFile.name}`;
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      capturedImageFile = fileInput.files[0];
      cameraInput.value = '';
      receiptStatus.textContent = `Comprobante seleccionado: ${capturedImageFile.name}`;
    }
  });

  capturePhotoBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = cameraPreview.videoWidth;
    canvas.height = cameraPreview.videoHeight;
    canvas.getContext('2d').drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      capturedImageFile = new File([blob], `comprobante-${Date.now()}.jpg`, { type: 'image/jpeg' });
      receiptStatus.textContent = 'Foto del comprobante capturada.';
      closeCamera();
    }, 'image/jpeg', 0.9);
  });

  closeCameraBtn.addEventListener('click', closeCamera);
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraPreview.srcObject = null;
  cameraModal.hidden = true;
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(numeric);
}

function formatDateShort(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatDateLong(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getWeekStart(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function getMonthWeekNumber(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - offset);
  const diffDays = Math.floor((date - firstMonday) / 86400000) + 1;
  return Math.ceil(diffDays / 7);
}

function getWeekRangeFromDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  return { start, end };
}

function getSummaryTotal(records) {
  return records.reduce((sum, record) => sum + Number(record.totalPagado || 0), 0);
}

function pickImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo debe ser una imagen.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function buildDailyRows() {
  const grouped = state.records.reduce((accumulator, record) => {
    const key = record.fecha;
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(record);
    return accumulator;
  }, {});

  const rows = [];
  Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach((date) => {
    grouped[date].forEach((record, index) => {
      rows.push({
        fecha: date,
        n: index + 1,
        item: record.item,
        numeroFactura: record.numeroFactura || '-',
        totalPagado: Number(record.totalPagado || 0),
        descripcion: record.descripcion || '-',
        imagen: record.imagen ? 'Adjunto' : 'Sin imagen',
      });
    });
  });

  return rows;
}

function buildWeeklyRows() {
  const weekMap = {};

  state.records.forEach((record) => {
    const date = new Date(`${record.fecha}T00:00:00`);
    if (date.getDay() === 0) return;
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().slice(0, 10);
    if (!weekMap[weekKey]) {
      weekMap[weekKey] = [];
    }
    weekMap[weekKey].push(record);
  });

  return Object.entries(weekMap)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([weekKey, items]) => {
      const start = new Date(`${weekKey}T00:00:00`);
      const end = new Date(start);
      end.setDate(start.getDate() + 5);
      return {
        semana: `Semana ${getMonthWeekNumber(weekKey)}`,
        rango: `${formatDateShort(weekKey)} - ${formatDateShort(end.toISOString().slice(0, 10))}`,
        total: getSummaryTotal(items),
      };
    });
}

function buildMonthlyRows() {
  const monthMap = {};

  state.records.forEach((record) => {
    const date = new Date(`${record.fecha}T00:00:00`);
    if (date.getDay() === 0) return;
    const weekNumber = getMonthWeekNumber(record.fecha);
    if (!monthMap[weekNumber]) {
      monthMap[weekNumber] = [];
    }
    monthMap[weekNumber].push(record);
  });

  const rows = Object.entries(monthMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([weekNumber, items]) => ({
      semana: `Semana ${weekNumber}`,
      total: getSummaryTotal(items),
    }));

  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  rows.push({ semana: 'Total del mes', total });
  return rows;
}

async function loadLogoBase64() {
  const response = await fetch('assets/logo.jpg');
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function exportWorkbook() {
  if (!window.XLSX) {
    throw new Error('La librería XLSX no está disponible.');
  }

  const workbook = XLSX.utils.book_new();

  const dailyRows = buildDailyRows();
  const dailyData = [
    ['JCZ Trading'],
    ['N°', 'Item', 'Fecha', 'Numero de factura', 'Total Pagado', 'Descripcion', 'Imagen'],
    ...dailyRows.map((row) => [
      row.n,
      row.item,
      row.fecha,
      row.numeroFactura,
      row.totalPagado,
      row.descripcion,
      row.imagen,
    ]),
  ];

  const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
  dailySheet['!cols'] = [
    { wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 38 }, { wch: 18 },
  ];
  const dailyLogo = document.querySelector('.brand-logo');
  if (dailyLogo) {
    dailySheet['A1'] = { t: 's', v: 'JCZ Trading' };
    dailySheet['A1'].s = { font: { bold: true, color: { rgb: '1D4ED8' }, sz: 18 }, alignment: { horizontal: 'center' } };
    dailySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  }
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Gastos por dia');

  const weeklyRows = buildWeeklyRows();
  const weeklyData = [
    ['JCZ Trading'],
    ['Semana', 'Rango', 'Total'],
    ...weeklyRows.map((row) => [row.semana, row.rango, row.total]),
    ['Total de semanas', '', weeklyRows.reduce((sum, row) => sum + Number(row.total || 0), 0)],
  ];
  const weeklySheet = XLSX.utils.aoa_to_sheet(weeklyData);
  weeklySheet['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Gastos por semana');

  const monthlyRows = buildMonthlyRows();
  const monthlyData = [
    ['JCZ Trading'],
    ['Semana', 'Total'],
    ...monthlyRows.map((row) => [row.semana, row.total]),
  ];
  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData);
  monthlySheet['!cols'] = [{ wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Gastos del mes');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPdfBlob() {
  if (!window.jspdf?.jsPDF) throw new Error('La librería PDF no está disponible.');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 36;
  let y = 42;
  pdf.setFontSize(18);
  pdf.setTextColor(29, 78, 216);
  pdf.text('JCZ Trading', margin, y);
  y += 28;
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Control de gastos', margin, y);
  y += 24;
  const columns = ['N°', 'Item', 'Fecha', 'Factura', 'Total', 'Descripción'];
  const widths = [24, 105, 62, 65, 58, 180];
  const drawRow = (values, header = false) => {
    let x = margin;
    if (header) pdf.setFont(undefined, 'bold');
    values.forEach((value, index) => {
      pdf.text(String(value ?? '-').slice(0, 34), x, y);
      x += widths[index];
    });
    if (header) pdf.setFont(undefined, 'normal');
    y += 17;
    if (y > 770) {
      pdf.addPage();
      y = 42;
    }
  };
  drawRow(columns, true);
  buildDailyRows().forEach((row) => drawRow([
    row.n,
    row.item,
    formatDateShort(row.fecha),
    row.numeroFactura,
    formatCurrency(row.totalPagado),
    row.descripcion,
  ]));
  return pdf.output('blob');
}

function buildCsv() {
  return null;
}

function renderDailyTable(date, records) {
  const total = getSummaryTotal(records);
  const rows = records
    .map((record, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${record.item}</td>
          <td>${formatDateLong(record.fecha)}</td>
          <td>${record.numeroFactura || '-'}</td>
          <td>${formatCurrency(record.totalPagado)}</td>
          <td>${record.descripcion || '-'}</td>
          <td>${record.imagen ? `<img src="${record.imagen}" alt="Comprobante de ${record.item}" />` : 'Sin imagen'}</td>
          <td><button type="button" class="delete-btn" data-delete-id="${record.id}">Eliminar</button></td>
        </tr>
      `;
    })
    .join('');

  return `
    <article class="day-page">
      <div class="page-header">
        <h3>${formatDateLong(date)}</h3>
        <span class="summary-pill">${formatCurrency(total)}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Item</th>
              <th>Fecha</th>
              <th>Número de factura</th>
              <th>Total Pagado</th>
              <th>Descripción</th>
              <th>Imagen</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderDailyView() {
  const grouped = state.records.reduce((accumulator, record) => {
    const key = record.fecha;
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(record);
    return accumulator;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
  const total = getSummaryTotal(state.records);

  if (!sortedDates.length) {
    viewContainer.innerHTML = '<div class="empty-state">Todavía no hay gastos registrados.</div>';
    summaryPill.textContent = formatCurrency(0);
    return;
  }

  viewContainer.innerHTML = sortedDates
    .map((date) => renderDailyTable(date, grouped[date]))
    .join('');

  summaryPill.textContent = formatCurrency(total);
}

function renderWeeklyView() {
  const map = {};

  state.records.forEach((record) => {
    const date = new Date(`${record.fecha}T00:00:00`);
    if (date.getDay() === 0) return;
    const weekKey = getWeekStart(date).toISOString().slice(0, 10);
    if (!map[weekKey]) {
      map[weekKey] = [];
    }
    map[weekKey].push(record);
  });

  const entries = Object.entries(map).sort((a, b) => new Date(b[0]) - new Date(a[0]));

  if (!entries.length) {
    viewContainer.innerHTML = '<div class="empty-state">No hay semanas con gastos registrados.</div>';
    summaryPill.textContent = formatCurrency(0);
    return;
  }

  const cards = entries.map(([weekKey, items], index) => {
    const start = new Date(`${weekKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    const total = getSummaryTotal(items);
    const weekNumber = getMonthWeekNumber(weekKey);

    return `
      <article class="week-card">
        <div class="week-header">
          <h3>Semana ${weekNumber} (${formatDateShort(weekKey)} - ${formatDateShort(end.toISOString().slice(0, 10))})</h3>
          <span class="summary-pill">${formatCurrency(total)}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Item</th>
                <th>Fecha</th>
                <th>Total Pagado</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((record, itemIndex) => `
                  <tr>
                    <td>${itemIndex + 1}</td>
                    <td>${record.item}</td>
                    <td>${formatDateShort(record.fecha)}</td>
                    <td>${formatCurrency(record.totalPagado)}</td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }).join('');

  viewContainer.innerHTML = cards;
  summaryPill.textContent = formatCurrency(entries.reduce((sum, [, items]) => sum + getSummaryTotal(items), 0));
}

function renderMonthlyView() {
  const monthMap = {};

  state.records.forEach((record) => {
    const date = new Date(`${record.fecha}T00:00:00`);
    if (date.getDay() === 0) return;
    const weekNumber = getMonthWeekNumber(record.fecha);
    if (!monthMap[weekNumber]) {
      monthMap[weekNumber] = [];
    }
    monthMap[weekNumber].push(record);
  });

  const weekEntries = Object.entries(monthMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([weekNumber, items]) => ({
      weekNumber: Number(weekNumber),
      total: getSummaryTotal(items),
      items,
    }));

  if (!weekEntries.length) {
    viewContainer.innerHTML = '<div class="empty-state">Aún no hay gastos para el mes actual.</div>';
    summaryPill.textContent = formatCurrency(0);
    return;
  }

  const total = weekEntries.reduce((sum, item) => sum + item.total, 0);

  viewContainer.innerHTML = `
    <article class="month-summary">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Gasto total</th>
            </tr>
          </thead>
          <tbody>
            ${weekEntries
              .map((entry) => `
                <tr>
                  <td>Semana ${entry.weekNumber}</td>
                  <td>${formatCurrency(entry.total)}</td>
                </tr>
              `)
              .join('')}
            <tr class="grand-total">
              <td>Total del mes</td>
              <td>${formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  `;

  summaryPill.textContent = formatCurrency(total);
}

function renderView() {
  viewTitle.textContent = state.view === 'daily'
    ? 'Gastos por día'
    : state.view === 'weekly'
      ? 'Gastos por semanas'
      : 'Gastos del mes';

  if (state.view === 'daily') {
    renderDailyView();
  } else if (state.view === 'weekly') {
    renderWeeklyView();
  } else {
    renderMonthlyView();
  }
}

expenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(expenseForm);
  const file = capturedImageFile || cameraInput.files[0] || fileInput.files[0];

  try {
    const imageValue = await pickImageFile(file instanceof File ? file : null);
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : `gasto-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      item: String(formData.get('item') || '').trim(),
      fecha: String(formData.get('fecha') || ''),
      numeroFactura: String(formData.get('numeroFactura') || '').trim(),
      totalPagado: Number(formData.get('totalPagado') || 0),
      descripcion: String(formData.get('descripcion') || '').trim(),
      imagen: imageValue,
    };

    if (!record.item || !record.fecha || !record.totalPagado) {
      alert('Completa los campos requeridos antes de guardar.');
      return;
    }

    state.records.push(record);
    state.records.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    saveRecords();
    await insertCloudRecord(record);
    expenseForm.reset();
    capturedImageFile = null;
    receiptStatus.textContent = 'No se ha seleccionado ningún comprobante.';
    renderView();
  } catch (error) {
    alert(error.message || 'No se pudo guardar el gasto.');
  }
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    tabButtons.forEach((buttonItem) => buttonItem.classList.toggle('active', buttonItem === button));
    state.view = button.dataset.view;
    renderView();
  });
});

viewContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-id]');
  if (!button) return;

  const { deleteId } = button.dataset;
  try {
    await deleteCloudRecord(deleteId);
    state.records = state.records.filter((record) => record.id !== deleteId);
    saveRecords();
    renderView();
  } catch (error) {
    alert(error.message || 'No se pudo eliminar el gasto en la nube.');
  }
});

exportBtn.addEventListener('click', async () => {
  try {
    const blob = await exportWorkbook();
    downloadBlob(blob, 'gastos-jcz-trading.xlsx');
  } catch (error) {
    alert(error.message || 'No se pudo exportar el archivo Excel.');
  }
});

function getSummaryText() {
  const summaryText = `Control de gastos\n\n${state.records.map((item) => `${item.item}: ${formatCurrency(item.totalPagado)}`).join('\n') || 'Sin registros'}`;
  return summaryText;
}

async function shareReport(format) {
  if (format === 'whatsapp') {
    const whatsappLink = `whatsapp://send?text=${encodeURIComponent(getSummaryText())}`;
    window.location.href = whatsappLink;
    setTimeout(() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(getSummaryText())}`, '_blank'), 800);
    return;
  }

  const files = [];
  if (format === 'excel' || format === 'both') {
    const excelBlob = await exportWorkbook();
    files.push(new File([excelBlob], 'gastos-jcz-trading.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
  if (format === 'pdf' || format === 'both') {
    const pdfBlob = buildPdfBlob();
    files.push(new File([pdfBlob], 'gastos-jcz-trading.pdf', { type: 'application/pdf' }));
  }

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
    try {
      await navigator.share({
        title: 'Gastos del mes',
        text: getSummaryText(),
        files,
      });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  files.forEach((file) => downloadBlob(file, file.name));
  alert('Los archivos se descargaron porque este navegador no permite adjuntarlos directamente.');
}

function closeShareDialog() {
  shareModal.hidden = true;
}

shareBtn.addEventListener('click', () => {
  shareModal.hidden = false;
});

shareExcelBtn.addEventListener('click', async () => { closeShareDialog(); await shareReport('excel'); });
sharePdfBtn.addEventListener('click', async () => { closeShareDialog(); await shareReport('pdf'); });
shareBothBtn.addEventListener('click', async () => { closeShareDialog(); await shareReport('both'); });
shareWhatsappBtn.addEventListener('click', async () => { closeShareDialog(); await shareReport('whatsapp'); });
closeShareBtn.addEventListener('click', closeShareDialog);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // no-op; work offline is optional
    });
  });
}

bindVoiceButtons();
bindReceiptButtons();
bindAuth();

if (cloudClient) {
  cloudClient.auth.getSession().then(({ data }) => handleSession(data.session));
  cloudClient.auth.onAuthStateChange((_event, session) => handleSession(session));
} else {
  setAuthMessage('No se pudo inicializar la conexión con Supabase.');
}
