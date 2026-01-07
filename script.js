let exams = [];
let editingId = null;
let showingSchedule = false;
let formMaterialItems = []; // temporary material items while editing/creating an exam

// Study state
let globalTimerInterval = null;
let audioCtx = null; // for WebAudio beeps
let soundMuted = (localStorage.getItem('soundMuted') ?? 'true') === 'true'; // default: muted
let soundStyle = localStorage.getItem('soundStyle') || 'classic'; // 'classic' | 'soft' | 'none' (global control)

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

                    // Ensure study tracking fields exist
                    e.studySessions = Array.isArray(e.studySessions) ? e.studySessions : [];
                    e.totalStudySeconds = typeof e.totalStudySeconds === 'number' ? e.totalStudySeconds : (e.totalStudySeconds ? Number(e.totalStudySeconds) : 0);
                    e.timerRunningStart = e.timerRunningStart ? Number(e.timerRunningStart) : null;

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

    // Start countdown/timer updates
    startGlobalTimerUpdates();
    updateDashboard();
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
        questionTypes,
        // study tracking defaults
        studySessions: [],
        totalStudySeconds: 0,
        timerRunningStart: null
    };

    if (editingId) {
        const index = exams.findIndex(e => e.id === editingId);
        // Preserve existing study data when editing
        if (index !== -1) {
            exam.studySessions = exams[index].studySessions || [];
            exam.totalStudySeconds = exams[index].totalStudySeconds || 0;
            exam.timerRunningStart = exams[index].timerRunningStart || null;
            exams[index] = exam;
        }
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
    const start = new Date(dateString + ' ' + timeString);
    const end = new Date(start);
    end.setHours(end.getHours() + 2); // exams are 2 hours by default

    const today = new Date();
    // compare calendar days (midnight-to-midnight) to avoid time-of-day anomalies
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = Math.round((startMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

    // If the exam is today but already finished, treat it as Past
    if (diff === 0 && Date.now() > end.getTime()) return { text: 'Past', class: 'badge-secondary' };
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
        updateDashboard();
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
        const completion = materialCompletion(exam.material).percent;
        const timeRem = getTimeRemaining(exam.date, exam.time);
        const elapsed = (exam.totalStudySeconds || 0) + (exam.timerRunningStart ? Math.floor((Date.now() - exam.timerRunningStart) / 1000) : 0);

        return `
            <div class="exam-card ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}" id="exam-${exam.id}">
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
                                <span class="badge badge-small">${completion}%</span>
                                <div class="progress" style="margin-left:0.5rem"><span style="width:${completion}%;"></span></div>
                            </div>
                            <div class="exam-meta-item">
                                ⏳ <span id="timeRem-${exam.id}">${escapeHtml(timeRem.text)}</span>
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
                    <div class="exam-detail">
                        <div class="exam-detail-title">⏱️ Study Timer</div>
                        <div class="exam-detail-content" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
                            <div id="studyElapsed-${exam.id}" style="font-weight:600">${formatDuration(elapsed)}</div>
                            <div style="display:flex;gap:0.5rem">
                                <button class="btn btn-primary" onclick="openStudyModal(${exam.id})">Open Timer</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Ensure UI and dashboard are updated
    updateCountdowns();
    updateDashboard();
    // ensure modal UI reflects any saved sound/mode state
    const muteBtn = document.getElementById('modalMuteBtn'); if (muteBtn) muteBtn.textContent = soundMuted ? '🔕' : '🔔';

    if (showingSchedule) {
        renderScheduleTable();
    }
}

// -----------------------------
// Study timers, dashboard & notification helpers
// -----------------------------

function formatDuration(totalSeconds) {
    totalSeconds = Number(totalSeconds) || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;
    return `${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;
}

function getTimeRemaining(dateString, timeString) {
    const start = new Date(dateString + ' ' + timeString);
    const end = new Date(start);
    end.setHours(end.getHours() + 2); // default exam duration is 2 hours

    const now = Date.now();
    if (now >= end.getTime()) return { seconds: 0, text: 'Finished' };

    const diffMs = start - now;
    if (diffMs <= 0) return { seconds: 0, text: 'Started' };
    const sec = Math.floor(diffMs / 1000);
    if (sec >= 86400 * 3) {
        const days = Math.floor(sec / 86400);
        return { seconds: sec, text: `${days} days` };
    }
    if (sec >= 3600) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return { seconds: sec, text: `${h}h ${m}m` };
    }
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return { seconds: sec, text: `${m}m ${s}s` };
}

function startStudyTimer(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    ensurePomodoroState(exam);
    if (exam.pomodoro && exam.pomodoro.mode === 'pomodoro') {
        startPomodoro(id);
        return;
    }
    if (exam.timerRunningStart) return; // already running
    exam.timerRunningStart = Date.now();
    saveToStorage();
    updateCountdowns();
}

function pauseStudyTimer(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    ensurePomodoroState(exam);
    if (exam.pomodoro && exam.pomodoro.mode === 'pomodoro') {
        pausePomodoro(id);
        renderExams();
        return;
    }
    if (!exam.timerRunningStart) return;
    const now = Date.now();
    const elapsedSec = Math.floor((now - exam.timerRunningStart) / 1000);
    if (elapsedSec > 0) {
        exam.totalStudySeconds = (exam.totalStudySeconds || 0) + elapsedSec;
        exam.studySessions = exam.studySessions || [];
        exam.studySessions.push({ start: exam.timerRunningStart, end: now, seconds: elapsedSec });
    }
    exam.timerRunningStart = null;
    saveToStorage();
    renderExams();
}

function resetStudyTimer(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    ensurePomodoroState(exam);
    if (exam.pomodoro && exam.pomodoro.mode === 'pomodoro') {
        resetPomodoro(id);
        renderExams();
        return;
    }
    if (!confirm('Reset study time and sessions for this exam?')) return;
    exam.studySessions = [];
    exam.totalStudySeconds = 0;
    exam.timerRunningStart = null;
    saveToStorage();
    renderExams();
}

let currentModalExamId = null;

function updateCountdowns() {
    exams.forEach(exam => {
        const timeRemEl = document.getElementById(`timeRem-${exam.id}`);
        const studyEl = document.getElementById(`studyElapsed-${exam.id}`);

        const timeRem = getTimeRemaining(exam.date, exam.time);
        if (timeRemEl) timeRemEl.textContent = timeRem.text;

        // normal elapsed
        const elapsed = (exam.totalStudySeconds || 0) + (exam.timerRunningStart ? Math.floor((Date.now() - exam.timerRunningStart) / 1000) : 0);
        if (studyEl) studyEl.textContent = formatDuration(elapsed);

        // handle pomodoro automatic transitions
        if (exam.pomodoro && exam.pomodoro.phaseEnd) {
            const p = exam.pomodoro;
            const remaining = Math.max(0, Math.ceil((p.phaseEnd - Date.now())/1000));
            if (remaining <= 0) {
                // advance phase
                advancePomodoroPhase(exam);
            }
        }

        // if modal open for this exam, update modal display
        if (currentModalExamId === exam.id) {
            const modalDisp = document.getElementById('modalTimerDisplay');
            const modalInfo = document.getElementById('modalExamInfo');
            const startBtn = document.getElementById('modalStartBtn');
            const pauseBtn = document.getElementById('modalPauseBtn');
            const skipBtn = document.getElementById('modalSkipPhaseBtn');
            if (modalInfo) modalInfo.textContent = `${escapeHtml(exam.subject)} • ${formatDate(exam.date)} ${formatTime(exam.time)}`;

            // if exam in pomodoro mode show phase timer
            if (exam.pomodoro && exam.pomodoro.mode === 'pomodoro') {
                ensurePomodoroState(exam);
                const p = exam.pomodoro;
                const phase = p.phase || 'idle';
                const phaseRemaining = p.phaseEnd ? Math.max(0, Math.ceil((p.phaseEnd - Date.now())/1000)) : p.remaining || 0;
                if (modalDisp) {
                    modalDisp.textContent = `${formatDuration(phaseRemaining)} ` + (phase === 'focus' ? '• Focus' : (phase === 'short' ? '• Short Break' : (phase === 'long' ? '• Long Break' : '')));
                }
                const modalPhase = document.getElementById('modalPhaseDisplay');
                if (modalPhase) modalPhase.textContent = `Phase: ${phase}`;
                const cycleEl = document.getElementById('modalCycleCount');
                if (cycleEl) cycleEl.textContent = `Cycles: ${p.focusCount || 0}`;
                // enable/disable buttons based on running
                if (startBtn) startBtn.disabled = !!p.phaseEnd;
                if (pauseBtn) pauseBtn.disabled = !p.phaseEnd;
                if (skipBtn) skipBtn.disabled = !(p.phase === 'short' || p.phase === 'long');
            } else {
                // standard timer UI
                if (modalDisp) modalDisp.textContent = formatDuration(elapsed);
                if (startBtn) startBtn.disabled = !!exam.timerRunningStart;
                if (pauseBtn) pauseBtn.disabled = !exam.timerRunningStart;
                if (skipBtn) skipBtn.disabled = true;
            }

            renderModalSessionsList(exam);
            renderModalPomodoroState(exam);
        }
    });
    updateDashboard();
}

function openStudyModal(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    currentModalExamId = id;
    const overlay = document.getElementById('studyModalOverlay');
    overlay.classList.remove('hidden');
    document.getElementById('modalTitle').textContent = `${escapeHtml(exam.subject)} — Study Timer`;
    document.getElementById('modalExamInfo').textContent = `${formatDate(exam.date)} ${formatTime(exam.time)}`;
    // set mode select and mute button
    ensurePomodoroState(exam);
    const modeSel = document.getElementById('modalModeSelect');
    if (modeSel) modeSel.value = exam.pomodoro.mode || 'timer';
    const soundSel = document.getElementById('modalSoundStyle'); if (soundSel) soundSel.value = soundStyle || 'classic';
    const muteBtn = document.getElementById('modalMuteBtn');
    if (muteBtn) muteBtn.textContent = soundMuted ? '🔕' : '🔔';
    // immediate UI update
    updateCountdowns();
    // focus modal for accessibility
    setTimeout(() => document.getElementById('modalStartBtn') && document.getElementById('modalStartBtn').focus(), 80);
}

function closeStudyModal() {
    currentModalExamId = null;
    const overlay = document.getElementById('studyModalOverlay');
    if (overlay) overlay.classList.add('hidden');
    // restore modal controls to default
    const modeSel = document.getElementById('modalModeSelect'); if (modeSel) modeSel.value = 'timer';
}

function renderModalSessionsList(exam) {
    const list = document.getElementById('modalSessionsList');
    if (!list || !exam) return;
    const sessions = (exam.studySessions || []).slice().reverse();
    if (sessions.length === 0) {
        list.innerHTML = '<li style="color:#6B7280">No sessions yet</li>';
        return;
    }
    list.innerHTML = sessions.map(s => {
        const start = new Date(s.start); const end = new Date(s.end || Date.now());
        return `<li>${start.toLocaleString()} — ${end.toLocaleTimeString()} • ${formatDuration(s.seconds)}</li>`;
    }).join('');
}

function renderModalPomodoroState(exam) {
    if (!exam) return;
    ensurePomodoroState(exam);
    const p = exam.pomodoro;
    const modeSel = document.getElementById('modalModeSelect'); if (modeSel) modeSel.value = p.mode || 'timer';
    const soundSel = document.getElementById('modalSoundStyle'); if (soundSel) soundSel.value = soundStyle || 'classic';
    const phaseEl = document.getElementById('modalPhaseDisplay'); if (phaseEl) phaseEl.textContent = `Phase: ${p.phase || 'idle'}`;
    const cycleEl = document.getElementById('modalCycleCount'); if (cycleEl) cycleEl.textContent = `Cycles: ${p.focusCount || 0}`;
    const muteBtn = document.getElementById('modalMuteBtn'); if (muteBtn) muteBtn.textContent = soundMuted ? '🔕' : '🔔';
}

function setModalMode(id, mode) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    ensurePomodoroState(exam);
    exam.pomodoro.mode = mode;
    if (mode !== 'pomodoro') {
        // clear pomodoro state when switching back to timer
        exam.pomodoro.phase = 'idle';
        exam.pomodoro.phaseEnd = null;
        exam.pomodoro.remaining = 0;
    }
    saveToStorage();
    renderModalPomodoroState(exam);
}

// close modal on escape key
window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && currentModalExamId !== null) closeStudyModal();
});

// close modal when clicking outside modal content (overlay click)
(function() {
    const overlay = document.getElementById('studyModalOverlay');
    if (!overlay) return;
    overlay.addEventListener('click', function (e) {
        // only close when clicking the overlay itself (not modal content)
        if (e.target === overlay) closeStudyModal();
    });
})();

function startGlobalTimerUpdates() {
    if (globalTimerInterval) clearInterval(globalTimerInterval);
    globalTimerInterval = setInterval(updateCountdowns, 1000);
}



function updateDashboard() {
    // Keep this lightweight: update mute button text (modal) if present
    const muteBtn = document.getElementById('modalMuteBtn');
    if (muteBtn) muteBtn.textContent = soundMuted ? '🔕' : '🔔';
}

// -----------------------------
// Sound controls
// -----------------------------
function toggleSound() {
    soundMuted = !soundMuted;
    localStorage.setItem('soundMuted', soundMuted ? 'true' : 'false');
    updateDashboard();
}

function setSoundStyle(val) {
    soundStyle = val || 'classic';
    localStorage.setItem('soundStyle', soundStyle);
    updateDashboard();
    // keep modal UI synced when changed
    const soundSel = document.getElementById('modalSoundStyle'); if (soundSel) soundSel.value = soundStyle;
} 

function ensureAudioContext() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
}

function playBeep(type = 'click') {
    if (soundMuted) return;
    if (soundStyle === 'none') return;
    ensureAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Master gain to control overall level
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
    master.connect(audioCtx.destination);

    // helper to create a gentle delay/reverb for 'soft' style
    const makeDelay = () => {
        const delay = audioCtx.createDelay(0.6);
        const fb = audioCtx.createGain();
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
        fb.gain.setValueAtTime(0.22, now);
        delay.connect(fb); fb.connect(delay); delay.connect(lp); lp.connect(master);
        return delay;
    };

    const playTone = (freq, dur = 0.18, startOffset = 0, wave='sine', gainLevel = 0.12, detune=0) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq, now + startOffset);
        if (detune) o.detune.setValueAtTime(detune, now + startOffset);
        g.gain.setValueAtTime(0.0001, now + startOffset);
        g.gain.exponentialRampToValueAtTime(gainLevel, now + startOffset + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur + 0.02);
        o.connect(g);
        if (soundStyle === 'soft') {
            const d = makeDelay();
            g.connect(d);
            g.connect(master);
        } else {
            g.connect(master);
        }
        o.start(now + startOffset);
        o.stop(now + startOffset + dur + 0.05);
    };

    const s = soundStyle || 'classic';
    if (type === 'start') {
        if (s === 'soft') {
            playTone(660, 0.22, 0, 'sine', 0.06, -5);
            playTone(820, 0.18, 0.06, 'sine', 0.07, 3);
            playTone(1047, 0.14, 0.12, 'sine', 0.06, 5);
        } else {
            playTone(880, 0.16, 0, 'sine', 0.09);
            playTone(1047, 0.12, 0.06, 'sine', 0.08);
            playTone(1318, 0.09, 0.12, 'sine', 0.06);
        }
    } else if (type === 'pause') {
        if (s === 'soft') {
            playTone(392, 0.3, 0, 'sine', 0.08, -8);
            playTone(330, 0.24, 0.08, 'sine', 0.06, -6);
        } else {
            playTone(440, 0.24, 0, 'sine', 0.09, -10);
            playTone(330, 0.18, 0.06, 'sine', 0.07, -8);
        }
    } else if (type === 'break') {
        if (s === 'soft') {
            playTone(520, 0.34, 0, 'sine', 0.1, -2);
            playTone(780, 0.34, 0.06, 'sine', 0.09, 4);
        } else {
            playTone(660, 0.32, 0, 'sine', 0.12);
            playTone(990, 0.32, 0.06, 'sine', 0.11, 6);
        }
    } else if (type === 'done') {
        playTone(1244, 0.26, 0, 'sine', 0.11);
        playTone(1568, 0.18, 0.06, 'sine', 0.09);
    } else {
        playTone(600, 0.12, 0, 'sine', 0.1);
    }
}

// Pomodoro defaults (seconds)
const POMODORO_FOCUS = 25*60;
const POMODORO_SHORT = 5*60;
const POMODORO_LONG = 20*60;
const POMODORO_CYCLES = 4;

function ensurePomodoroState(exam) {
    exam.pomodoro = exam.pomodoro || { mode: 'timer', phase: 'idle', phaseEnd: null, remaining: 0, focusCount: 0 };
}

function startPomodoro(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    ensurePomodoroState(exam);
    const p = exam.pomodoro;
    if (!p.phase || p.phase === 'idle') { p.phase = 'focus'; p.remaining = POMODORO_FOCUS; }
    // resume from pause
    if (p.phaseEnd === null && p.remaining > 0) {
        p.phaseEnd = Date.now() + p.remaining*1000;
    } else if (!p.phaseEnd) {
        const duration = (p.phase === 'focus' ? POMODORO_FOCUS : (p.phase === 'short' ? POMODORO_SHORT : POMODORO_LONG));
        p.phaseEnd = Date.now() + duration*1000;
    }
    saveToStorage();
    playBeep('start');
}

function pausePomodoro(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam || !exam.pomodoro) return;
    const p = exam.pomodoro;
    if (!p.phaseEnd) return;
    p.remaining = Math.max(0, Math.ceil((p.phaseEnd - Date.now())/1000));
    p.phaseEnd = null;
    saveToStorage();
    playBeep('pause');
}

function resetPomodoro(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    if (!confirm('Reset Pomodoro state and counts for this exam?')) return;
    exam.pomodoro = { mode: 'timer', phase: 'idle', phaseEnd: null, remaining: 0, focusCount: 0 };
    saveToStorage();
}

function skipPhase(id) {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    ensurePomodoroState(exam);
    const p = exam.pomodoro;
    if (!p || p.mode !== 'pomodoro') return;
    // If currently in focus, finish it immediately (logs session and advances to break)
    if (p.phase === 'focus') {
        advancePomodoroPhase(exam);
    } else if (p.phase === 'short' || p.phase === 'long') {
        // If in a break, confirm when it's a long break, then jump to focus immediately
        if (p.phase === 'long') {
            if (!confirm('Skip the long break and start the next focus session now?')) return;
        }
        p.phase = 'focus';
        p.phaseEnd = Date.now() + POMODORO_FOCUS*1000;
        p.remaining = 0;
        saveToStorage();
        playBeep('start');
    }
    renderExams();
    if (currentModalExamId === id) {
        renderModalPomodoroState(exam);
        updateCountdowns();
    }
}

function advancePomodoroPhase(exam) {
    ensurePomodoroState(exam);
    const p = exam.pomodoro;
    if (p.phase === 'focus') {
        // finish a focus session
        const elapsed = p.remaining && p.remaining < POMODORO_FOCUS ? (POMODORO_FOCUS - p.remaining) : POMODORO_FOCUS;
        const now = Date.now();
        const start = now - elapsed*1000;
        const end = now;
        exam.totalStudySeconds = (exam.totalStudySeconds || 0) + elapsed;
        exam.studySessions = exam.studySessions || [];
        exam.studySessions.push({ start: start, end: end, seconds: elapsed });
        p.focusCount = (p.focusCount || 0) + 1;
        if (p.focusCount % POMODORO_CYCLES === 0) { p.phase = 'long'; p.phaseEnd = Date.now() + POMODORO_LONG*1000; }
        else { p.phase = 'short'; p.phaseEnd = Date.now() + POMODORO_SHORT*1000; }
        playBeep('break');
    } else if (p.phase === 'short' || p.phase === 'long') {
        p.phase = 'focus'; p.phaseEnd = Date.now() + POMODORO_FOCUS*1000; playBeep('start');
    }
    p.remaining = 0;
    saveToStorage();
}










// -----------------------------
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