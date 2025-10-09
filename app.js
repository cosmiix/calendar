// app.js
// 🔧 КОНФИГУРАЦИЯ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCB_bwtspz0GuQeialypinwih1VQ1E30wo",
  authDomain: "my-schedule-b323f.firebaseapp.com",
  projectId: "my-schedule-b323f",
  storageBucket: "my-schedule-b323f.firebasestorage.app",
  messagingSenderId: "2949606491",
  appId: "1:2949606491:web:2a0f37da954c0d1267237e"
};

// 🔐 ПАРОЛИ ДЛЯ РЕДАКТИРОВАНИЯ (sha256 хеш)
const ADMIN_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // Пароль: 123456
const MANAGER_PASSWORD_HASH = "b2d78a0f6f3d76b28d5367d65bdd031f6704f25f2d3fe6c3d2d3b4a6f6c1a2c6"; // Пароль: manager123

// Инициализация Firebase
let db = null;
try {
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('✅ Firebase инициализирован');
    }
} catch (error) {
    console.error('❌ Ошибка Firebase:', error);
}

// Глобальные переменные
let currentMonth = new Date();
let isEditMode = false;
let userRole = null; // 'tanya' или 'dima'
let selectedDay = null;
let selectedNote = null;
let scheduleData = {};
let notesData = {};
const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// Время окончания работы по дням недели
const endTimeOptions = {
    // Пн-Чт
    1: ["16:30", "18:00", "21:00"],
    2: ["16:30", "18:00", "21:00"],
    3: ["16:30", "18:00", "21:00"],
    4: ["16:30", "18:00", "21:00"],
    // Пт
    5: ["15:15", "16:45", "21:00"],
    // Сб-Вс (по умолчанию)
    0: ["16:30", "18:00", "21:00"],
    6: ["16:30", "18:00", "21:00"]
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    await loadData();
    setupEventListeners();
    renderCalendar();
    updateStats();
}

// Загрузка данных
async function loadData() {
    if (db) {
        try {
            // Загружаем расписание
            const scheduleSnapshot = await db.collection('schedule').get();
            scheduleData = {};
            scheduleSnapshot.forEach(doc => {
                scheduleData[doc.id] = doc.data();
            });

            // Загружаем заметки
            const notesSnapshot = await db.collection('notes').get();
            notesData = {};
            notesSnapshot.forEach(doc => {
                const data = doc.data();
                if (!notesData[data.date]) notesData[data.date] = [];
                notesData[data.date].push(data);
            });
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация по месяцам
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
        updateStats();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
        updateStats();
    });

    document.getElementById('current-month').addEventListener('click', () => {
        currentMonth = new Date();
        renderCalendar();
        updateStats();
    });

    // Кнопка редактирования
    document.getElementById('edit-toggle').addEventListener('click', function() {
        if (isEditMode) {
            exitEditMode();
        } else {
            showAuthModal();
        }
    });

    // Кнопка сохранения
    document.getElementById('save-changes').addEventListener('click', exitEditMode);

    // Форма авторизации
    document.getElementById('auth-form').addEventListener('submit', handleAuth);

    // Форма добавления заметки
    document.getElementById('add-note-form').addEventListener('submit', handleAddNote);

    // Форма ответа на заметку
    document.getElementById('reply-note-form').addEventListener('submit', handleReplyNote);

    // Кнопка добавления заметки в боковой панели
    const addDayNoteBtn = document.getElementById('add-day-note');
    if (addDayNoteBtn) {
        addDayNoteBtn.addEventListener('click', function() {
            if (selectedDay) {
                showAddNoteForm();
            } else {
                alert('Сначала выберите день');
            }
        });
    }
}

// Рендер календаря
function renderCalendar() {
    const calendar = document.getElementById('monthCalendar');
    if (!calendar) {
        console.error('Элемент monthCalendar не найден');
        return;
    }
    calendar.innerHTML = '';

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Обновляем заголовок
    const monthRange = document.getElementById('month-range');
    if (monthRange) {
        monthRange.textContent = `${monthNames[month]} ${year}`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Дни предыдущего месяца
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const prevMonthDay = new Date(year, month, -i);
        createDayElement(prevMonthDay, true);
    }

    // Дни текущего месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDay = new Date(year, month, day);
        createDayElement(currentDay, false);
    }

    // Дни следующего месяца
    const totalCells = 42;
    const existingCells = firstDayOfWeek + lastDay.getDate();
    for (let i = 1; i <= totalCells - existingCells; i++) {
        const nextMonthDay = new Date(year, month + 1, i);
        createDayElement(nextMonthDay, true);
    }
}

// Создание элемента дня
function createDayElement(date, isOtherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'month-day';
    
    const dayKey = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkDay = scheduleData[dayKey]?.isWorkDay || false;
    const workTimeStart = scheduleData[dayKey]?.timeStart || '';
    const workTimeEnd = scheduleData[dayKey]?.timeEnd || '';
    const hasNotes = notesData[dayKey] && notesData[dayKey].length > 0;
    const hasWorkTime = workTimeStart && workTimeStart !== '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();

    if (isOtherMonth) dayElement.classList.add('other-month');
    if (isWeekend) dayElement.classList.add('weekend');
    if (isToday) dayElement.classList.add('today');
    if (isWorkDay) dayElement.classList.add('work-day');
    if (hasNotes) dayElement.classList.add('has-notes');
    if (hasWorkTime) dayElement.classList.add('has-work-time');

    // Номер дня
    const dayNumber = document.createElement('div');
    dayNumber.className = 'month-day-number';
    dayNumber.textContent = date.getDate();
    dayElement.appendChild(dayNumber);

    // Время работы (если есть)
    if (hasWorkTime) {
        const timeElement = document.createElement('div');
        timeElement.className = 'month-day-time';
        timeElement.textContent = `${workTimeStart}-${workTimeEnd}`;
        dayElement.appendChild(timeElement);
    }

    // Обработчики кликов
    if (!isOtherMonth) {
        dayElement.addEventListener('click', () => handleDayClick(date, dayKey, isWorkDay));
    }

    const monthCalendar = document.getElementById('monthCalendar');
    if (monthCalendar) {
        monthCalendar.appendChild(dayElement);
    }
}

// Обработчик клика по дню
function handleDayClick(date, dayKey, isWorkDay) {
    if (isEditMode) {
        selectedDay = { date, dayKey, isWorkDay };
        
        if (userRole === 'tanya') {
            toggleWorkDay();
        } else if (userRole === 'dima') {
            showTimeModal();
        }
    } else {
        selectedDay = { date, dayKey, isWorkDay };
        showDayNotes(date, dayKey);
    }
}

// Функция для отображения заметок выбранного дня
function showDayNotes(date, dayKey) {
    const selectedDayInfo = document.getElementById('selected-day-info');
    const dayNotesList = document.getElementById('day-notes-list');
    
    if (!selectedDayInfo || !dayNotesList) {
        console.warn('Элементы боковой панели не найдены');
        return;
    }
    
    // Обновляем информацию о выбранном дне
    const dateStr = date.toLocaleDateString('ru-RU', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    selectedDayInfo.textContent = dateStr;
    
    // Получаем заметки для этого дня
    const dayNotes = notesData[dayKey] || [];
    
    if (dayNotes.length > 0) {
        // Показываем заметки с кнопками действий
        dayNotesList.innerHTML = dayNotes.map((note, index) => `
            <div class="day-note-item">
                <div class="day-note-text">${note.text}</div>
                <div class="day-note-time">${new Date(note.timestamp).toLocaleString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                })}</div>
                ${note.reply ? `
                    <div class="note-reply">
                        <div class="reply-text"><strong>Ответ:</strong> ${note.reply.text}</div>
                        <div class="reply-time">${new Date(note.reply.timestamp).toLocaleString('ru-RU', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit'
                        })}</div>
                    </div>
                ` : ''}
                <div class="day-note-actions">
                    <button class="btn btn-reply" onclick="showReplyModal('${dayKey}', ${index})">
                        💬 Ответить
                    </button>
                    <button class="btn btn-danger" onclick="deleteNote('${dayKey}', ${index})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        dayNotesList.innerHTML = '<div class="no-notes">Заметок нет</div>';
    }
}

// Функция удаления заметки
async function deleteNote(dayKey, noteIndex) {
    if (!confirm('Вы уверены, что хотите удалить эту заметку?')) {
        return;
    }
    
    if (notesData[dayKey] && notesData[dayKey][noteIndex]) {
        // Удаляем из локальных данных
        notesData[dayKey].splice(noteIndex, 1);
        
        // Если массив пустой, удаляем ключ
        if (notesData[dayKey].length === 0) {
            delete notesData[dayKey];
        }
        
        // Обновляем отображение
        showDayNotes(selectedDay.date, dayKey);
        renderCalendar();
        
        // TODO: Удаление из Firebase (нужно хранить ID заметок)
        console.log('Заметка удалена локально');
    }
}

// Функция показа модального окна ответа
function showReplyModal(dayKey, noteIndex) {
    const note = notesData[dayKey][noteIndex];
    if (!note) return;
    
    selectedNote = { dayKey, noteIndex, note };
    
    const modal = document.getElementById('reply-note-modal');
    const originalNote = document.getElementById('original-note-content');
    
    if (modal && originalNote) {
        originalNote.innerHTML = `
            <strong>Оригинальная заметка:</strong><br>
            ${note.text}<br>
            <small>${new Date(note.timestamp).toLocaleString('ru-RU')}</small>
        `;
        
        document.getElementById('reply-text').value = '';
        modal.style.display = 'flex';
    }
}

// Функция обработки ответа на заметку
async function handleReplyNote(e) {
    e.preventDefault();
    const replyText = document.getElementById('reply-text').value.trim();
    
    if (!replyText || !selectedNote) return;
    
    const { dayKey, noteIndex, note } = selectedNote;
    
    // Добавляем ответ к заметке
    note.reply = {
        text: replyText,
        timestamp: new Date().toISOString()
    };
    
    // Обновляем локальные данные
    notesData[dayKey][noteIndex] = note;
    
    // Обновляем отображение
    showDayNotes(selectedDay.date, dayKey);
    closeReplyModal();
    
    // TODO: Сохранение в Firebase
    console.log('Ответ добавлен локально');
}

// Закрытие модального окна ответа
function closeReplyModal() {
    const modal = document.getElementById('reply-note-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedNote = null;
}

// Остальные функции остаются без изменений...
// [Здесь должны быть все остальные функции из предыдущего кода: toggleWorkDay, showTimeModal, closeTimeModal, showAddNoteForm, closeAddNoteModal, showAuthModal, closeAuthModal, handleAuth, handleAddNote, saveWorkTime, enterEditMode, exitEditMode, updateStats]

// Новая функция для переключения рабочего дня (для Тани)
async function toggleWorkDay() {
    const wasWorkDay = scheduleData[selectedDay.dayKey]?.isWorkDay || false;
    const newWorkDayState = !wasWorkDay;
    
    // Сохраняем существующее время при переключении
    const existingTimeStart = scheduleData[selectedDay.dayKey]?.timeStart || '';
    const existingTimeEnd = scheduleData[selectedDay.dayKey]?.timeEnd || '';
    
    // Обновляем локальные данные - сохраняем время
    scheduleData[selectedDay.dayKey] = {
        isWorkDay: newWorkDayState,
        timeStart: existingTimeStart, // Сохраняем время
        timeEnd: existingTimeEnd      // Сохраняем время
    };
    
    // Сохраняем в Firebase
    if (db) {
        try {
            await db.collection('schedule').doc(selectedDay.dayKey).set({
                isWorkDay: newWorkDayState,
                timeStart: existingTimeStart, // Сохраняем время
                timeEnd: existingTimeEnd,     // Сохраняем время
                date: selectedDay.dayKey
            }, { merge: true });
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }
    
    renderCalendar();
    updateStats();
}

// Модальные окна
function showTimeModal() {
    const modal = document.getElementById('time-modal');
    const title = document.getElementById('time-modal-title');
    const timeStartSelect = document.getElementById('work-time-start');
    const timeEndSelect = document.getElementById('work-time-end');
    
    if (!modal || !title || !timeStartSelect || !timeEndSelect) {
        console.error('Элементы модального окна времени не найдены');
        return;
    }
    
    const dateStr = selectedDay.date.toLocaleDateString('ru-RU');
    title.textContent = `Время работы на ${dateStr}`;
    
    // Устанавливаем текущее время если есть
    if (scheduleData[selectedDay.dayKey]?.timeStart) {
        timeStartSelect.value = scheduleData[selectedDay.dayKey].timeStart;
    } else {
        timeStartSelect.value = '09:00'; // значение по умолчанию
    }
    
    // Заполняем варианты окончания работы в зависимости от дня недели
    const dayOfWeek = selectedDay.date.getDay();
    const endTimes = endTimeOptions[dayOfWeek] || endTimeOptions[1]; // По умолчанию Пн-Чт
    
    timeEndSelect.innerHTML = '';
    endTimes.forEach(time => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        timeEndSelect.appendChild(option);
    });
    
    // Устанавливаем текущее время окончания если есть
    if (scheduleData[selectedDay.dayKey]?.timeEnd) {
        timeEndSelect.value = scheduleData[selectedDay.dayKey].timeEnd;
    } else {
        timeEndSelect.value = endTimes[0]; // первое значение по умолчанию
    }
    
    modal.style.display = 'flex';
}

function closeTimeModal() {
    const modal = document.getElementById('time-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showAddNoteForm() {
    const modal = document.getElementById('add-note-modal');
    const title = document.getElementById('add-note-title');
    
    if (!modal || !title) {
        console.error('Элементы модального окна добавления заметки не найдены');
        return;
    }
    
    const dateStr = selectedDay.date.toLocaleDateString('ru-RU');
    title.textContent = `Добавить заметку на ${dateStr}`;
    
    document.getElementById('note-text').value = '';
    modal.style.display = 'flex';
}

function closeAddNoteModal() {
    const modal = document.getElementById('add-note-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('password-input').value = '';
        document.getElementById('user-type').value = 'tanya';
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Обработчики форм
async function handleAuth(e) {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    const userType = document.getElementById('user-type').value;
    
    // Хешируем пароль и проверяем
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (userType === 'tanya' && hashHex === ADMIN_PASSWORD_HASH) {
        userRole = 'tanya';
        enterEditMode();
        closeAuthModal();
    } else if (userType === 'dima' && hashHex === MANAGER_PASSWORD_HASH) {
        userRole = 'dima';
        enterEditMode();
        closeAuthModal();
    } else {
        alert('❌ Неверный пароль');
    }
}

async function handleAddNote(e) {
    e.preventDefault();
    const noteText = document.getElementById('note-text').value.trim();
    
    if (!noteText) return;
    
    const note = {
        text: noteText,
        timestamp: new Date().toISOString(),
        date: selectedDay.dayKey
    };
    
    // Сохраняем локально
    if (!notesData[selectedDay.dayKey]) notesData[selectedDay.dayKey] = [];
    notesData[selectedDay.dayKey].push(note);
    
    // Сохраняем в Firebase
    if (db) {
        try {
            await db.collection('notes').add(note);
        } catch (error) {
            console.error('Ошибка сохранения заметки:', error);
        }
    }
    
    closeAddNoteModal();
    
    // Обновляем отображение заметок в боковой панели
    showDayNotes(selectedDay.date, selectedDay.dayKey);
    
    // Обновляем индикатор заметок в календаре
    renderCalendar();
}

async function saveWorkTime() {
    const workTimeStart = document.getElementById('work-time-start').value;
    const workTimeEnd = document.getElementById('work-time-end').value;
    
    // Обновляем локальные данные - ТОЛЬКО время, не меняем статус рабочего дня
    scheduleData[selectedDay.dayKey] = {
        ...scheduleData[selectedDay.dayKey],
        timeStart: workTimeStart,
        timeEnd: workTimeEnd
    };
    
    // Сохраняем в Firebase
    if (db) {
        try {
            await db.collection('schedule').doc(selectedDay.dayKey).set({
                ...scheduleData[selectedDay.dayKey],
                timeStart: workTimeStart,
                timeEnd: workTimeEnd,
                date: selectedDay.dayKey
            }, { merge: true });
        } catch (error) {
            console.error('Ошибка сохранения времени:', error);
        }
    }
    
    closeTimeModal();
    renderCalendar();
    updateStats();
}

// Управление режимом редактирования
function enterEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode', `role-${userRole}`);
    
    // Обновляем текст уведомления в зависимости от роли
    const notice = document.getElementById('edit-notice');
    if (userRole === 'tanya') {
        notice.innerHTML = `<strong>🔧 Режим Тани активен</strong>
            <p>Нажимайте на дни для отметки рабочих/выходных дней</p>
            <button id="save-changes" class="btn btn-secondary" style="margin-top: 10px;">💾 Сохранить изменения</button>`;
    } else if (userRole === 'dima') {
        notice.innerHTML = `<strong>🔧 Режим Димы активен</strong>
            <p>Нажимайте на дни для выбора времени работы</p>
            <button id="save-changes" class="btn btn-secondary" style="margin-top: 10px;">💾 Сохранить изменения</button>`;
    }
    
    document.getElementById('edit-notice').style.display = 'block';
    document.getElementById('edit-toggle').textContent = '🚫 Завершить редактирование';
    document.getElementById('edit-toggle').classList.remove('btn-primary');
    document.getElementById('edit-toggle').classList.add('btn-secondary');
    
    // Перепривязываем обработчик для кнопки сохранения
    document.getElementById('save-changes').addEventListener('click', exitEditMode);
}

function exitEditMode() {
    isEditMode = false;
    userRole = null;
    document.body.classList.remove('edit-mode', 'role-tanya', 'role-dima');
    document.getElementById('edit-notice').style.display = 'none';
    document.getElementById('edit-toggle').textContent = 'Edit';
    document.getElementById('edit-toggle').classList.remove('btn-secondary');
    document.getElementById('edit-toggle').classList.add('btn-primary');
}

// Статистика
function updateStats() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    let workDays = 0;
    const today = new Date();
    let nextWorkDay = null;
    
    // Считаем рабочие дни и находим ближайший
    for (let day = 1; day <= lastDay; day++) {
        const currentDay = new Date(year, month, day);
        const dayKey = currentDay.toISOString().split('T')[0];
        
        if (scheduleData[dayKey]?.isWorkDay) {
            workDays++;
            
            // Ищем ближайший рабочий день
            if (!nextWorkDay && currentDay >= today) {
                nextWorkDay = currentDay;
            }
        }
    }
    
    // Обновляем статистику
    const totalWorkDays = document.getElementById('total-work-days');
    const nextWorkday = document.getElementById('next-workday');
    
    if (totalWorkDays) {
        totalWorkDays.textContent = workDays;
    }
    
    if (nextWorkday) {
        if (nextWorkDay) {
            nextWorkday.textContent = nextWorkDay.toLocaleDateString('ru-RU');
        } else {
            nextWorkday.textContent = 'Нет данных';
        }
    }
}
