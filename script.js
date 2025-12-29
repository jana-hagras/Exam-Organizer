let exams = [];
let editingId = null;
let showingSchedule = false;
let formMaterialItems = []; // temporary material items while editing/creating an exam

// Load exams from localStorage on page load
function loadExams() {
    const saved = localStorage.getItem('exams');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                exams = parsed.map(e => {
                    if (!e) return e;
                    // Ensure material is an array of {text, done}
                    if (typeof e.material === 'string') {
                        e.material = e.material ? [{ text: e.material, done: false }] : [];
                    } else if (!Array.isArray(e.material)) {
                        e.material = [];
                    } else {
                        e.material = e.material.map(it => {
                            if (typeof it === 'string') return { text: it, done: false };
                            if (it && typeof it === 'object') return { text: it.text || '', done: !!it.done };
                            return { text: String(it), done: false };
                        });
                    }
                    return e;
                });
            } else {
                console.warn('Saved exams is not an array, resetting.');
                exams = [];
                localStorage.removeItem('exams');
            }
        } catch (err) {
            console.error('Failed to parse saved exams:', err);
            if (confirm('Saved exam data appears corrupted. Reset saved data?')) {
                localStorage.removeItem('exams');
                exams = [];
            } else {
                exams = [];
            }
        }
    }
    renderExams();
}

function saveToStorage() {
    localStorage.setItem('exams', JSON.stringify(exams));
}

function showForm() {
    document.getElementById('formContainer').classList.remove('hidden');
    document.getElementById('addExamBtn').classList.add('hidden');
}

function hideForm() {
    document.getElementById('formContainer').classList.add('hidden');
    document.getElementById('addExamBtn').classList.remove('hidden');
    clearForm();
    editingId = null;
}

function clearForm() {
    document.getElementById('subject').value = '';
    document.getElementById('date').value = '';
    document.getElementById('time').value = '';
    document.getElementById('materialInput') && (document.getElementById('materialInput').value = '');
    document.getElementById('questionTypes').value = '';
    document.getElementById('formTitle').textContent = 'New Exam';
    document.getElementById('saveButtonText').textContent = 'Add Exam';
    formMaterialItems = [];
    renderFormMaterialItems();
}

function saveExam() {
    const subject = document.getElementById('subject').value.trim();
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const questionTypes = document.getElementById('questionTypes').value.trim();

    if (!subject || !date || !time || !questionTypes) {
        alert('Please fill in all required fields');
        return;
    }

    if (!formMaterialItems || formMaterialItems.length === 0) {
        alert('Please add at least one material item');
        return;
    }

    const exam = {
        id: editingId || Date.now(),
        subject,
        date,
        time,
        material: formMaterialItems.slice(),
        questionTypes
    };

    if (editingId) {
        const index = exams.findIndex(e => e.id === editingId);
        exams[index] = exam;
    } else {
        exams.push(exam);
    }

    saveToStorage();
    renderExams();
    hideForm();
} 

function editExam(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;

    document.getElementById('subject').value = exam.subject;
    document.getElementById('date').value = exam.date;
    document.getElementById('time').value = exam.time;
    document.getElementById('questionTypes').value = exam.questionTypes;
    document.getElementById('formTitle').textContent = 'Edit Exam';
    document.getElementById('saveButtonText').textContent = 'Update Exam';

    // Ensure material is in expected array format
    if (Array.isArray(exam.material)) {
        formMaterialItems = exam.material.map(it => ({ text: it.text || '', done: !!it.done }));
    } else if (typeof exam.material === 'string') {
        formMaterialItems = exam.material ? [{ text: exam.material, done: false }] : [];
    } else {
        formMaterialItems = [];
    }
    renderFormMaterialItems();

    editingId = id;
    showForm();
    // Smoothly scroll the form into view and add a subtle highlight so the user notices the edit area
    const formEl = document.getElementById('formContainer');
    const subj = document.getElementById('subject');
    if (formEl) {
        // allow the layout to settle a tiny bit before scrolling
        setTimeout(() => {
            if (typeof formEl.scrollIntoView === 'function') {
                formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                window.scrollTo({ top: formEl.offsetTop - 20, behavior: 'smooth' });
            }
            // add a temporary highlight class for visual attention
            formEl.classList.add('editing-highlight');
            setTimeout(() => formEl.classList.remove('editing-highlight'), 1400);
        }, 60);
    }
    // focus after a short delay so the scroll animation isn't interrupted
    if (subj) setTimeout(() => subj.focus(), 220);
} 

function deleteExam(id) {
    if (confirm('Are you sure you want to delete this exam?')) {
        exams = exams.filter(e => e.id !== id);
        saveToStorage();
        renderExams();
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function getEndTime(startTime) {
    const [hours, minutes] = startTime.split(':');
    const date = new Date();
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    date.setHours(date.getHours() + 2);
    
    const endHours = String(date.getHours()).padStart(2, '0');
    const endMinutes = String(date.getMinutes()).padStart(2, '0');
    return `${endHours}:${endMinutes}`;
}

function getDaysUntil(dateString, timeString) {
    const examDate = new Date(dateString + ' ' + timeString);
    const today = new Date();
    const diff = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return { text: 'Past', class: 'badge-secondary' };
    if (diff === 0) return { text: 'Today!', class: 'badge-danger' };
    if (diff === 1) return { text: 'Tomorrow', class: 'badge-primary' };
    return { text: `${diff} days`, class: 'badge-primary' };
}

// --- Material checklist helpers for the form and display ---
function renderFormMaterialItems() {
    const list = document.getElementById('materialItemsList');
    if (!list) return;
    list.innerHTML = formMaterialItems.map((item, idx) => `
        <li class="${item.done ? 'done' : ''}">
            <label class="material-item">
                <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleFormMaterialDone(${idx})">
                <span class="material-text">${escapeHtml(item.text)}</span>
            </label>
            <button class="icon-btn delete" onclick="removeFormMaterialItem(${idx})" title="Remove">🗑️</button>
        </li>
    `).join('');
}

function addMaterialItem() {
    const input = document.getElementById('materialInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    formMaterialItems.push({ text, done: false });
    input.value = '';
    renderFormMaterialItems();
    input.focus();
}

function toggleFormMaterialDone(index) {
    if (index < 0 || index >= formMaterialItems.length) return;
    formMaterialItems[index].done = !formMaterialItems[index].done;
    renderFormMaterialItems();
}

function removeFormMaterialItem(index) {
    if (index < 0 || index >= formMaterialItems.length) return;
    formMaterialItems.splice(index, 1);
    renderFormMaterialItems();
}

function renderMaterialListHTML(material) {
    // material may be string or array
    if (!material) return '';
    const items = Array.isArray(material) ? material : (typeof material === 'string' ? [{ text: material, done: false }] : []);
    return `<ul style="margin:0;padding-left:1rem">${items.map(it => `<li class="${it.done ? 'done' : ''}" style="margin-bottom:0.25rem">${escapeHtml(it.text)}</li>`).join('')}</ul>`;
}

function exportMaterialHTML(material) {
    const items = Array.isArray(material) ? material : (typeof material === 'string' ? [{ text: material, done: false }] : []);
    return `<ul style="margin:0;padding-left:1rem">${items.map(it => `<li>${it.done ? '<s>' + escapeHtml(it.text) + '</s>' : escapeHtml(it.text)}</li>`).join('')}</ul>`;
}

// Compute material completion stats: completed count, total and percent (rounded)
function materialCompletion(material) {
    const items = Array.isArray(material) ? material : (typeof material === 'string' ? [{ text: material, done: false }] : []);
    const total = items.length;
    if (total === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = items.reduce((sum, it) => sum + (it && it.done ? 1 : 0), 0);
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
}

function toggleSchedule() {
    showingSchedule = !showingSchedule;
    const scheduleContainer = document.getElementById('scheduleContainer');
    const toggleBtn = document.getElementById('toggleScheduleBtn');
    
    if (showingSchedule) {
        scheduleContainer.classList.remove('hidden');
        toggleBtn.textContent = '📊 Hide Schedule';
        renderScheduleTable();
    } else {
        scheduleContainer.classList.add('hidden');
        toggleBtn.textContent = '📊 Show Schedule';
    }
}

function renderScheduleTable() {
    const tbody = document.getElementById('scheduleTableBody');
    const sortedExams = [...exams].sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateA - dateB;
    });

    tbody.innerHTML = sortedExams.map(exam => `
        <tr>
            <td><strong>${escapeHtml(exam.subject)}</strong></td>
            <td>${formatDate(exam.date)}</td>
            <td>${formatTime(exam.time)}</td>
            <td>${formatTime(getEndTime(exam.time))}</td>
            <td>2 hours</td>
            <td style="font-size: 0.875rem;">
                ${renderMaterialListHTML(exam.material)}
                <div style="font-size:0.75rem;color:#6B7280;margin-top:6px">${materialCompletion(exam.material).completed}/${materialCompletion(exam.material).total} (${materialCompletion(exam.material).percent}%)</div>
            </td>
            <td style="font-size: 0.875rem;">${escapeHtml(exam.questionTypes)}</td>
        </tr>
    `).join('');
}

function renderExams() {
    const examsList = document.getElementById('examsList');
    const emptyState = document.getElementById('emptyState');
    const toggleScheduleBtn = document.getElementById('toggleScheduleBtn');

    if (exams.length === 0) {
        examsList.innerHTML = '';
        emptyState.classList.remove('hidden');
        toggleScheduleBtn.classList.add('hidden');
        document.getElementById('scheduleContainer').classList.add('hidden');
        showingSchedule = false;
        return;
    }

    emptyState.classList.add('hidden');
    toggleScheduleBtn.classList.remove('hidden');

    const sortedExams = [...exams].sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateA - dateB;
    });

    examsList.innerHTML = sortedExams.map(exam => {
        const daysUntil = getDaysUntil(exam.date, exam.time);
        const endTime = getEndTime(exam.time);
        const isPast = daysUntil.text === 'Past';
        const isToday = daysUntil.text === 'Today!';
        
        return `
            <div class="exam-card ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}">
                <div class="exam-header">
                    <div style="flex: 1;">
                        <div class="exam-title">${escapeHtml(exam.subject)}</div>
                        <div class="exam-meta">
                            <div class="exam-meta-item">
                                📅 ${formatDate(exam.date)}
                            </div>
                            <div class="exam-meta-item">
                                🕐 ${formatTime(exam.time)} - ${formatTime(endTime)}
                                <span class="badge badge-small">2 hours</span>
                            </div>
                            <div class="exam-meta-item">
                                <span class="badge badge-small">${materialCompletion(exam.material).percent}%</span>
                                <div class="progress" style="margin-left:0.5rem"><span style="width:${materialCompletion(exam.material).percent}%;"></span></div>
                            </div>
                            <div class="badge ${daysUntil.class}">
                                ${daysUntil.text}
                            </div>
                        </div> 
                    </div>
                    <div class="exam-actions">
                        <button class="icon-btn edit" onclick="editExam(${exam.id})" title="Edit">
                            ✏️
                        </button>
                        <button class="icon-btn delete" onclick="deleteExam(${exam.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="exam-details">
                    <div class="exam-detail">
                        <div class="exam-detail-title">
                            📝 Type of Questions:
                        </div>
                        <div class="exam-detail-content">${escapeHtml(exam.questionTypes)}</div>
                    </div>
                    <div class="exam-detail">
                        <div class="exam-detail-title">
                            📚 Material Covered:
                        </div>
                        <div class="exam-detail-content">${renderMaterialListHTML(exam.material)}</div>
                    </div> 
                </div>
            </div>
        `;
    }).join('');

    if (showingSchedule) {
        renderScheduleTable();
    }
}

// Export the visible schedule to a printable window (user can save as PDF)
function exportToPDF() {
    if (!exams || exams.length === 0) {
        alert('No exams to print. Add an exam first.');
        return;
    }

    const sortedExams = [...exams].sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateA - dateB;
    });

    const rows = sortedExams.map(exam => `
        <tr>
            <td><strong>${escapeHtml(exam.subject)}</strong></td>
            <td>${escapeHtml(formatDate(exam.date))}</td>
            <td>${escapeHtml(formatTime(exam.time))}</td>
            <td>${escapeHtml(formatTime(getEndTime(exam.time)))}</td>
            <td>2 hours</td>
            <td style="font-size: 0.875rem;">${exportMaterialHTML(exam.material)}
              <div style="font-size:0.85rem;color:#6B7280;margin-top:6px">${materialCompletion(exam.material).completed}/${materialCompletion(exam.material).total} (${materialCompletion(exam.material).percent}%)</div>
            </td>
            <td style="font-size: 0.875rem;">${escapeHtml(exam.questionTypes)}</td>
        </tr>
    `).join('');

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Exam Schedule</title>
<style>
  body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; padding:20px; color:#111}
  h1{font-size:24px; margin-bottom:4px}
  p.meta{color:#6B7280; margin-top:0; margin-bottom:12px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#4F46E5;color:#fff;padding:10px;text-align:left}
  td{border:1px solid #E5E7EB;padding:8px;vertical-align:top}
  @media print{ body{padding:8mm} }
</style>
</head>
<body>
  <h1>Exam Schedule</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>Date</th>
        <th>Start Time</th>
        <th>End Time</th>
        <th>Duration</th>
        <th>Material</th>
        <th>Question Type</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <script>window.print(); setTimeout(()=>window.close(), 200);</script>
</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
}

// Basic HTML escape for inserted text
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function(ch) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch];
    });
}

// Listen for storage changes in other tabs and reload exams when they occur
window.addEventListener('storage', (e) => {
    if (e.key === 'exams') {
        loadExams();
    }
});

// Initialize on page load
loadExams();