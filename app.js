const STORAGE_KEY = 'gastos-tracker-v1';

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
const cameraInput = document.getElementById('cameraInput');
const fileInput = document.getElementById('fileInput');
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const receiptStatus = document.getElementById('receiptStatus');
const cameraModal = document.getElementById('cameraModal');
const cameraPreview = document.getElementById('cameraPreview');
const capturePhotoBtn = document.getElementById('capturePhotoBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
let cameraStream = null;
let capturedImageFile = null;

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
      if (!speechRecognition) {
        alert('Este navegador no admite dictado por voz. Abre la app en Google Chrome o Microsoft Edge y permite el acceso al micrófono.');
        return;
      }

      const recognition = new speechRecognition();
      recognition.lang = 'es-PE';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      button.textContent = '…';
      button.disabled = true;

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
    const logoCell = { t: 's', v: 'JCZ Trading' };
    dailySheet['A1'] = { t: 's', v: 'JCZ Trading' };
    dailySheet['A1'].s = { font: { bold: true, color: { rgb: '1D4ED8' }, sz: 18 }, alignment: { horizontal: 'center' } };
    dailySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 6 } }];
  }
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Gastos por dia');

  const weeklyRows = buildWeeklyRows();
  const weeklyData = [
    ['Semana', 'Rango', 'Total'],
    ...weeklyRows.map((row) => [row.semana, row.rango, row.total]),
    ['Total de semanas', '', weeklyRows.reduce((sum, row) => sum + Number(row.total || 0), 0)],
  ];
  const weeklySheet = XLSX.utils.aoa_to_sheet(weeklyData);
  weeklySheet['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Gastos por semana');

  const monthlyRows = buildMonthlyRows();
  const monthlyData = [
    ['Semana', 'Total'],
    ...monthlyRows.map((row) => [row.semana, row.total]),
  ];
  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData);
  monthlySheet['!cols'] = [{ wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Gastos del mes');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

viewContainer.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-id]');
  if (!button) return;

  const { deleteId } = button.dataset;
  state.records = state.records.filter((record) => record.id !== deleteId);
  saveRecords();
  renderView();
});

exportBtn.addEventListener('click', async () => {
  try {
    const blob = await exportWorkbook();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gastos-jcz-trading.xlsx';
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message || 'No se pudo exportar el archivo Excel.');
  }
});

shareBtn.addEventListener('click', async () => {
  const csv = buildCsv();
  const summaryText = `Control de gastos\n\n${state.records.map((item) => `${item.item}: ${formatCurrency(item.totalPagado)}`).join('\n') || 'Sin registros'}`;

  if (navigator.share) {
    const file = new File([csv], 'gastos-mes.csv', { type: 'text/csv' });
    try {
      await navigator.share({
        title: 'Gastos del mes',
        text: summaryText,
        files: [file],
      });
      return;
    } catch (error) {
      // Fallback to mail/WhatsApp below.
    }
  }

  const whatsappLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent('Gastos del mes')}&body=${encodeURIComponent(summaryText)}`;

  const shareChoice = window.confirm('¿Quieres enviar por WhatsApp o por correo?');
  if (shareChoice) {
    window.open(whatsappLink, '_blank');
  } else {
    window.location.href = mailtoLink;
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // no-op; work offline is optional
    });
  });
}

bindVoiceButtons();
bindReceiptButtons();
renderView();
