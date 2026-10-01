const STORAGE_KEY = 'gastos-tracker-v1';
const SUPABASE_URL = 'https://sncxzaoofbpwfekdumej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY3h6YW9vZmJwd2Zla2R1bWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODM1ODAsImV4cCI6MjEwNTI1OTU4MH0.xMl7tyuKyGhmgq2jh_etnasWkpdhCaVoqVSA8wZjNYg';
const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  view: 'daily',
  records: loadRecords(),
  selectedDate: null,
  selectedRecordIds: new Set(),
  shareRecords: null,
  openRecordId: null,
  editingRecordId: null,
};

const expenseForm = document.getElementById('expenseForm');
const datePickerInput = document.getElementById('datePickerInput');
const chooseDateBtn = document.getElementById('chooseDateBtn');
const saveExpenseBtn = document.getElementById('saveExpenseBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const viewContainer = document.getElementById('viewContainer');
const viewTitle = document.getElementById('viewTitle');
const summaryPill = document.getElementById('summaryPill');
const exportBtn = document.getElementById('exportCsvBtn');
const shareBtn = document.getElementById('shareBtn');
const tabButtons = document.querySelectorAll('.tab-button');
const speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const nativeSpeechRecognition = window.Capacitor?.Plugins?.SpeechRecognition;
const nativeFilesystem = window.Capacitor?.Plugins?.Filesystem;
const nativeShare = window.Capacitor?.Plugins?.Share;
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
const profileIconInput = document.getElementById('profileIconInput');
const profileIconPreview = document.getElementById('profileIconPreview');
const userProfileIcon = document.getElementById('userProfileIcon');
const dayTabs = document.getElementById('dayTabs');
const selectionCount = document.getElementById('selectionCount');
const shareSelectedBtn = document.getElementById('shareSelectedBtn');
const recordModal = document.getElementById('recordModal');
const recordDetails = document.getElementById('recordDetails');
const recordBackBtn = document.getElementById('recordBackBtn');
const shareRecordBtn = document.getElementById('shareRecordBtn');
const saveReceiptBtn = document.getElementById('saveReceiptBtn');
const editRecordBtn = document.getElementById('editRecordBtn');
let cameraStream = null;
let capturedImageFile = null;
let currentUser = null;

if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.() === 'android') {
  document.body.classList.add('native-android');
}

function todayLocalDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function setDefaultExpenseDate() {
  const dateInput = expenseForm.elements.namedItem('fecha');
  if (dateInput && !dateInput.value) dateInput.value = formatDateInput(todayLocalDate());
  if (datePickerInput && !datePickerInput.value) datePickerInput.value = todayLocalDate();
}

function formatDateInput(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function normalizeDateInput(dateValue) {
  const match = String(dateValue || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return '';
  return `${year}-${month}-${day}`;
}

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

async function updateCloudRecord(record) {
  const cloudRecord = cloudRecordFromLocal(record);
  const { id, user_id: userId, ...fields } = cloudRecord;
  const { error } = await cloudClient.from('gastos').update(fields).eq('id', id).eq('user_id', userId);
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
  const profileIcon = user.user_metadata?.avatar_url || '';
  userProfileIcon.src = profileIcon;
  userProfileIcon.hidden = !profileIcon;
}

function showAuthGate() {
  currentUser = null;
  authGate.hidden = false;
  appContent.hidden = true;
  userSession.hidden = true;
}

async function authenticate(email, password, createAccount = false) {
  if (!cloudClient) throw new Error('No se pudo cargar el servicio de autenticación.');
  const profileIcon = profileIconInput.files[0]
    ? await readFileAsDataUrl(profileIconInput.files[0])
    : '';
  const result = createAccount
    ? await cloudClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        data: profileIcon ? { avatar_url: profileIcon } : {},
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
  profileIconInput.addEventListener('change', async () => {
    const file = profileIconInput.files[0];
    if (!file) {
      profileIconPreview.hidden = true;
      profileIconPreview.removeAttribute('src');
      return;
    }
    if (!file.type.startsWith('image/')) {
      profileIconInput.value = '';
      setAuthMessage('El icono de perfil debe ser una imagen.');
      return;
    }
    profileIconPreview.src = await readFileAsDataUrl(file);
    profileIconPreview.hidden = false;
  });

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
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getSummaryTotal(records) {
  return records.reduce((sum, record) => sum + Number(record.totalPagado || 0), 0);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function pickImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      reject(new Error('El comprobante debe ser una imagen o un archivo PDF.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('No se pudo leer el comprobante.'));
    reader.readAsDataURL(file);
  });
}

function buildDailyRows(records = state.records) {
  const grouped = records.reduce((accumulator, record) => {
    const key = record.fecha;
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(record);
    return accumulator;
  }, {});

  const rows = [];
  Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach((date) => {
    grouped[date].forEach((record, index) => {
      rows.push({
        fecha: formatDateLong(date),
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

function buildWeeklyRows(records = state.records) {
  const weekMap = {};

  records.forEach((record) => {
    const date = new Date(`${record.fecha}T00:00:00`);
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
      end.setDate(start.getDate() + 6);
      return {
        semana: `Semana ${getMonthWeekNumber(weekKey)}`,
        rango: `${formatDateShort(weekKey)} - ${formatDateShort(end.toISOString().slice(0, 10))}`,
        total: getSummaryTotal(items),
      };
    });
}

function buildMonthlyRows(records = state.records) {
  const monthMap = {};

  records.forEach((record) => {
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

function dailySheetName(date) {
  return formatDateShort(date).replaceAll('/', '-');
}

async function exportWorkbook(records = state.records) {
  if (!window.XLSX) {
    throw new Error('La librería XLSX no está disponible.');
  }

  const workbook = XLSX.utils.book_new();

  const dates = [...new Set(records.map((record) => record.fecha))].sort((a, b) => new Date(b) - new Date(a));
  dates.forEach((date) => {
    const rows = buildDailyRows(records.filter((record) => record.fecha === date));
    const sheet = XLSX.utils.aoa_to_sheet([
      ['JCZ Trading'],
      ['N°', 'Item', 'Fecha', 'Número de factura', 'Total pagado', 'Descripción', 'Comprobante'],
      ...rows.map((row) => [row.n, row.item, row.fecha, row.numeroFactura, row.totalPagado, row.descripcion, row.imagen]),
    ]);
    sheet['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 38 }, { wch: 18 }];
    sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, dailySheetName(date));
  });

  const weeklyRows = buildWeeklyRows(records);
  const weeklyData = [
    ['JCZ Trading'],
    ['Semana', 'Rango', 'Total'],
    ...weeklyRows.map((row) => [row.semana, row.rango, row.total]),
    ['Total de semanas', '', weeklyRows.reduce((sum, row) => sum + Number(row.total || 0), 0)],
  ];
  const weeklySheet = XLSX.utils.aoa_to_sheet(weeklyData);
  weeklySheet['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Por semana');

  const monthlyRows = buildMonthlyRows(records);
  const monthlyData = [
    ['JCZ Trading'],
    ['Semana', 'Total'],
    ...monthlyRows.map((row) => [row.semana, row.total]),
  ];
  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData);
  monthlySheet['!cols'] = [{ wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Resumen mensual');

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

function reportBaseName() {
  const [year, month, day] = todayLocalDate().split('-');
  return `gastos-jcz-trading-al-${day}-${month}-${year.slice(-2)}`;
}

function safeFilename(value) {
  return String(value || 'comprobante').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().slice(0, 80) || 'comprobante';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function shareNativeFiles(files) {
  if (!nativeFilesystem || !nativeShare) return false;

  const fileUris = [];
  for (const file of files) {
    const base64 = await blobToBase64(file.blob);
    const result = await nativeFilesystem.writeFile({
      path: file.name,
      data: base64,
      directory: 'CACHE',
      recursive: true,
    });
    fileUris.push(result.uri);
  }

  await nativeShare.share({
    title: 'Reporte de gastos JCZ Trading',
    text: getSummaryText(),
    files: fileUris,
    dialogTitle: 'Enviar reporte',
  });
  return true;
}

function buildPdfBlob(records = state.shareRecords || state.records) {
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
  buildDailyRows(records).forEach((row) => drawRow([
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderDailyTable(date, records) {
  const total = getSummaryTotal(records);
  const rows = records
    .map((record, index) => {
      const attachment = record.imagen || '';
      const isPdf = attachment.startsWith('data:application/pdf');
      const checked = state.selectedRecordIds.has(record.id) ? 'checked' : '';
      const itemName = escapeHtml(record.item);
      return `
        <tr>
          <td>${index + 1}</td>
          <td><button type="button" class="record-link" data-record-id="${record.id}">${itemName}</button></td>
          <td>${formatDateLong(record.fecha)}</td>
          <td>${escapeHtml(record.numeroFactura || '-')}</td>
          <td>${formatCurrency(record.totalPagado)}</td>
          <td>${escapeHtml(record.descripcion || '-')}</td>
          <td>${attachment ? `<button type="button" class="receipt-open" data-record-id="${record.id}">${isPdf ? 'Ver PDF' : `<img src="${attachment}" alt="Comprobante de ${itemName}" />`}</button>` : 'Sin comprobante'}</td>
          <td><input class="record-select" type="checkbox" data-select-record="${record.id}" aria-label="Seleccionar ${itemName}" ${checked} /></td>
          <td class="record-row-actions"><button type="button" class="edit-btn" data-edit-id="${record.id}">Editar</button><button type="button" class="delete-btn" data-delete-id="${record.id}">Eliminar</button></td>
        </tr>
      `;
    })
    .join('');

  return `
    <article class="day-page">
      <div class="page-header">
        <h3>${formatDateLong(date)}</h3>
        <span class="summary-pill">ACUMULADO: ${formatCurrency(total)}</span>
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
              <th>Comprobante</th>
              <th>Enviar</th>
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
  const selectedDate = sortedDates.includes(state.selectedDate)
    ? state.selectedDate
    : sortedDates.includes(todayLocalDate()) ? todayLocalDate() : sortedDates[0];
  state.selectedDate = selectedDate;
  dayTabs.innerHTML = sortedDates.map((date) => `
    <button type="button" role="tab" aria-selected="${date === selectedDate}" class="day-tab ${date === selectedDate ? 'active' : ''}" data-day-date="${date}">
      ${formatDateLong(date)}
    </button>
  `).join('');
  updateSelectionControls();

  if (!sortedDates.length) {
    dayTabs.innerHTML = '';
    viewContainer.innerHTML = '<div class="empty-state">Todavía no hay gastos registrados.</div>';
    summaryPill.textContent = formatCurrency(0);
    return;
  }

  viewContainer.innerHTML = renderDailyTable(selectedDate, grouped[selectedDate]);

  summaryPill.textContent = formatCurrency(total);
}

function updateSelectionControls() {
  const count = state.selectedRecordIds.size;
  selectionCount.textContent = `${count} ${count === 1 ? 'gasto seleccionado' : 'gastos seleccionados'}`;
  shareSelectedBtn.disabled = count === 0;
}

function openRecordDetails(record) {
  state.openRecordId = record.id;
  const attachment = record.imagen || '';
  const isPdf = attachment.startsWith('data:application/pdf');
  recordDetails.innerHTML = `
    <dl class="record-facts">
      <div><dt>Item</dt><dd>${escapeHtml(record.item)}</dd></div>
      <div><dt>Fecha</dt><dd>${formatDateLong(record.fecha)}</dd></div>
      <div><dt>Número de factura</dt><dd>${escapeHtml(record.numeroFactura || '-')}</dd></div>
      <div><dt>Total pagado</dt><dd>${formatCurrency(record.totalPagado)}</dd></div>
      <div><dt>Descripción</dt><dd>${escapeHtml(record.descripcion || '-')}</dd></div>
    </dl>
    ${attachment ? (isPdf
      ? `<iframe class="receipt-document" title="Comprobante PDF" src="${attachment}"></iframe>`
      : `<img class="receipt-document" src="${attachment}" alt="Comprobante de ${escapeHtml(record.item)}" />`)
      : '<p>Este gasto no tiene comprobante adjunto.</p>'}
  `;
  saveReceiptBtn.hidden = !attachment;
  recordModal.hidden = false;
}

function populateExpenseForm(record) {
  state.editingRecordId = record.id;
  expenseForm.elements.namedItem('item').value = record.item || '';
  expenseForm.elements.namedItem('fecha').value = formatDateInput(record.fecha);
  datePickerInput.value = record.fecha || todayLocalDate();
  expenseForm.elements.namedItem('numeroFactura').value = record.numeroFactura || '';
  expenseForm.elements.namedItem('totalPagado').value = record.totalPagado ?? '';
  expenseForm.elements.namedItem('descripcion').value = record.descripcion || '';
  capturedImageFile = null;
  cameraInput.value = '';
  fileInput.value = '';
  receiptStatus.textContent = record.imagen ? 'Se conservará el comprobante actual si no eliges otro.' : 'No se ha seleccionado ningún comprobante.';
  saveExpenseBtn.textContent = 'Actualizar gasto';
  cancelEditBtn.hidden = false;
  closeRecordDetails();
  expenseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelExpenseEdit() {
  state.editingRecordId = null;
  expenseForm.reset();
  setDefaultExpenseDate();
  capturedImageFile = null;
  receiptStatus.textContent = 'No se ha seleccionado ningún comprobante.';
  saveExpenseBtn.textContent = 'Guardar gasto';
  cancelEditBtn.hidden = true;
}

function closeRecordDetails() {
  recordModal.hidden = true;
  state.openRecordId = null;
}

function dataUrlToBlob(dataUrl) {
  const [metadata, encoded] = dataUrl.split(',');
  const mime = metadata.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

function renderWeeklyView() {
  const map = {};

  state.records.forEach((record) => {
    const date = new Date(`${record.fecha}T00:00:00`);
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
    end.setDate(start.getDate() + 6);
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
    ? 'ACUMULADO'
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

setDefaultExpenseDate();

chooseDateBtn.addEventListener('click', () => {
  if (datePickerInput.showPicker) datePickerInput.showPicker();
  else datePickerInput.click();
});

datePickerInput.addEventListener('change', () => {
  expenseForm.elements.namedItem('fecha').value = formatDateInput(datePickerInput.value);
});

cancelEditBtn.addEventListener('click', cancelExpenseEdit);

expenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(expenseForm);
  const file = capturedImageFile || cameraInput.files[0] || fileInput.files[0];
  const existingRecord = state.records.find((record) => record.id === state.editingRecordId);

  try {
    const selectedImage = await pickImageFile(file instanceof File ? file : null);
    const fecha = normalizeDateInput(formData.get('fecha'));
    const record = {
      id: existingRecord?.id || (crypto.randomUUID ? crypto.randomUUID() : `gasto-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      item: String(formData.get('item') || '').trim(),
      fecha,
      numeroFactura: String(formData.get('numeroFactura') || '').trim(),
      totalPagado: Number(formData.get('totalPagado') || 0),
      descripcion: String(formData.get('descripcion') || '').trim(),
      imagen: selectedImage || existingRecord?.imagen || '',
    };

    if (!record.item || !record.fecha || !record.totalPagado) {
      alert('Completa los campos y escribe la fecha como dd/mm/aaaa.');
      return;
    }

    if (existingRecord) {
      await updateCloudRecord(record);
      state.records = state.records.map((item) => item.id === record.id ? record : item);
    } else {
      await insertCloudRecord(record);
      state.records.push(record);
    }
    state.records.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    state.selectedDate = record.fecha;
    saveRecords();
    cancelExpenseEdit();
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

dayTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-day-date]');
  if (!button) return;
  state.selectedDate = button.dataset.dayDate;
  renderDailyView();
});

viewContainer.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-select-record]');
  if (!checkbox) return;
  const recordId = checkbox.dataset.selectRecord;
  checkbox.checked ? state.selectedRecordIds.add(recordId) : state.selectedRecordIds.delete(recordId);
  updateSelectionControls();
});

viewContainer.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-id]');
  if (editButton) {
    const record = state.records.find((item) => item.id === editButton.dataset.editId);
    if (record) populateExpenseForm(record);
    return;
  }

  const deleteButton = event.target.closest('[data-delete-id]');
  if (deleteButton) {
    const { deleteId } = deleteButton.dataset;
    try {
      await deleteCloudRecord(deleteId);
      state.records = state.records.filter((record) => record.id !== deleteId);
      state.selectedRecordIds.delete(deleteId);
      saveRecords();
      renderView();
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el gasto en la nube.');
    }
    return;
  }

  const recordButton = event.target.closest('[data-record-id]');
  if (recordButton) {
    const record = state.records.find((item) => item.id === recordButton.dataset.recordId);
    if (record) openRecordDetails(record);
  }
});

function beginSharing(records) {
  state.shareRecords = records;
  shareModal.hidden = false;
}

shareSelectedBtn.addEventListener('click', () => {
  const selected = state.records.filter((record) => state.selectedRecordIds.has(record.id));
  if (selected.length) beginSharing(selected);
});

recordBackBtn.addEventListener('click', closeRecordDetails);
recordModal.addEventListener('click', (event) => {
  if (event.target === recordModal) closeRecordDetails();
});

editRecordBtn.addEventListener('click', () => {
  const record = state.records.find((item) => item.id === state.openRecordId);
  if (record) populateExpenseForm(record);
});

shareRecordBtn.addEventListener('click', () => {
  const record = state.records.find((item) => item.id === state.openRecordId);
  if (!record) return;
  closeRecordDetails();
  beginSharing([record]);
});

saveReceiptBtn.addEventListener('click', () => {
  const record = state.records.find((item) => item.id === state.openRecordId);
  if (!record?.imagen) return;
  const isPdf = record.imagen.startsWith('data:application/pdf');
  const extension = isPdf ? 'pdf' : (record.imagen.match(/^data:image\/([^;]+)/)?.[1] || 'jpg');
  const blob = dataUrlToBlob(record.imagen);
  const name = `comprobante-${safeFilename(record.item)}.${extension}`;
  if (nativeFilesystem && nativeShare) {
    shareNativeFiles([{ blob, name }]).catch((error) => alert(error.message || 'No se pudo guardar el comprobante.'));
    return;
  }
  downloadBlob(blob, name);
});

exportBtn.addEventListener('click', async () => {
  try {
    const blob = await exportWorkbook();
    const name = `${reportBaseName()}.xlsx`;
    if (await shareNativeFiles([{ blob, name }])) return;
    downloadBlob(blob, name);
  } catch (error) {
    alert(error.message || 'No se pudo exportar el archivo Excel.');
  }
});

function getSummaryText(records = state.shareRecords || state.records) {
  const summaryText = `Control de gastos\n\n${records.map((item) => `${item.item}: ${formatCurrency(item.totalPagado)}`).join('\n') || 'Sin registros'}`;
  return summaryText;
}

async function shareReport(format, records = state.shareRecords || state.records) {
  const dateSuffix = reportBaseName();
  if (format === 'whatsapp') {
    const receiptFiles = records.filter((record) => record.imagen).map((record) => {
      const mime = record.imagen.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream';
      const extension = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg');
      return new File([dataUrlToBlob(record.imagen)], `comprobante-${safeFilename(record.item)}.${extension}`, { type: mime });
    });
    if (receiptFiles.length && await shareNativeFiles(receiptFiles.map((file) => ({ blob: file, name: file.name })))) return;
    if (receiptFiles.length && navigator.share && (!navigator.canShare || navigator.canShare({ files: receiptFiles }))) {
      await navigator.share({ title: 'Comprobantes JCZ Trading', text: getSummaryText(records), files: receiptFiles });
      return;
    }
    const whatsappLink = `whatsapp://send?text=${encodeURIComponent(getSummaryText(records))}`;
    window.location.href = whatsappLink;
    setTimeout(() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(getSummaryText(records))}`, '_blank'), 800);
    return;
  }

  const files = [];
  if (format === 'excel' || format === 'both') {
    const excelBlob = await exportWorkbook(records);
    files.push(new File([excelBlob], `${dateSuffix}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
  if (format === 'pdf' || format === 'both') {
    const pdfBlob = buildPdfBlob(records);
    files.push(new File([pdfBlob], `${dateSuffix}.pdf`, { type: 'application/pdf' }));
  }

  const receiptFiles = records.filter((record) => record.imagen).map((record) => {
    const mime = record.imagen.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream';
    const extension = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg');
    return new File([dataUrlToBlob(record.imagen)], `comprobante-${safeFilename(record.item)}.${extension}`, { type: mime });
  });
  files.push(...receiptFiles);

  if (await shareNativeFiles(files.map((file) => ({ blob: file, name: file.name })))) return;

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
    try {
      await navigator.share({
        title: 'Gastos del mes',
        text: getSummaryText(records),
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
  state.shareRecords = null;
  shareModal.hidden = false;
});

async function runShare(format) {
  const records = state.shareRecords || state.records;
  closeShareDialog();
  try {
    await shareReport(format, records);
  } catch (error) {
    alert(error.message || 'No se pudo preparar el archivo para compartir.');
  } finally {
    state.shareRecords = null;
  }
}

shareExcelBtn.addEventListener('click', () => runShare('excel'));
sharePdfBtn.addEventListener('click', () => runShare('pdf'));
shareBothBtn.addEventListener('click', () => runShare('both'));
shareWhatsappBtn.addEventListener('click', () => runShare('whatsapp'));
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
