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
const TANYA_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // Пароль:
const DIMA_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; // Пароль:

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

    // Кнопка редактирования - ИСПРАВЛЕННЫЙ ОБРАБОТЧИК
    document.getElementById('edit-toggle').addEventListener('click', function() {
        if (isEditMode) {
            // Если уже в режиме редактирования - выходим из него
            exitEditMode();
        } else {
            // Если не в режиме редактирования - показываем авторизацию
            showAuthModal();
        }
    });

    // Кнопка сохранения
    document.getElementById('save-changes').addEventListener('click', exitEditMode);

    // Форма авторизации
    document.getElementById('auth-form').addEventListener('submit', handleAuth);

    // Форма добавления заметки
    document.getElementById('add-note-form').addEventListener('submit', handleAddNote);
}

// Рендер календаря
function renderCalendar() {
    const calendar = document.getElementById('monthCalendar');
    calendar.innerHTML = '';

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Обновляем заголовок
    document.getElementById('month-range').textContent = `${monthNames[month]} ${year}`;

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

    document.getElementById('monthCalendar').appendChild(dayElement);
}

// Обработчик клика по дню
function handleDayClick(date, dayKey, isWorkDay) {
    if (isEditMode) {
        // В режиме редактирования
        selectedDay = { date, dayKey, isWorkDay };
        
        if (userRole === 'tanya') {
            // Таня - просто отмечает рабочий день без выбора времени
            toggleWorkDay();
        } else if (userRole === 'dima') {
            // Дима - выбирает время
            showTimeModal();
        }
    } else {
        // В режиме просмотра - показ заметок
        selectedDay = { date, dayKey, isWorkDay };
        showNotesModal();
    }
}

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
    document.getElementById('time-modal').style.display = 'none';
}

function showNotesModal() {
    const modal = document.getElementById('notes-modal');
    const title = document.getElementById('notes-modal-title');
    const notesList = document.getElementById('notes-list');
    
    const dateStr = selectedDay.date.toLocaleDateString('ru-RU');
    title.textContent = `Заметки за ${dateStr}`;
    
    // Показываем заметки
    const dayNotes = notesData[selectedDay.dayKey] || [];
    if (dayNotes.length > 0) {
        notesList.innerHTML = dayNotes.map(note => `
            <div class="note-item">
                <div class="note-text">${note.text}</div>
                <div class="note-time">${new Date(note.timestamp).toLocaleString('ru-RU')}</div>
            </div>
        `).join('');
    } else {
        notesList.innerHTML = '<div class="no-notes">Нет заметок для этого дня</div>';
    }
    
    modal.style.display = 'flex';
}

function closeNotesModal() {
    document.getElementById('notes-modal').style.display = 'none';
}

function showAddNoteForm() {
    closeNotesModal();
    const modal = document.getElementById('add-note-modal');
    const title = document.getElementById('add-note-title');
    
    const dateStr = selectedDay.date.toLocaleDateString('ru-RU');
    title.textContent = `Добавить заметку на ${dateStr}`;
    
    document.getElementById('note-text').value = '';
    modal.style.display = 'flex';
}

function closeAddNoteModal() {
    document.getElementById('add-note-modal').style.display = 'none';
}

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('password-input').value = '';
    document.getElementById('user-type').value = 'tanya';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
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
    
    if (userType === 'tanya' && hashHex === TANYA_PASSWORD_HASH) {
        userRole = 'tanya';
        enterEditMode();
        closeAuthModal();
    } else if (userType === 'dima' && hashHex === DIMA_PASSWORD_HASH) {
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
    showNotesModal();
    renderCalendar(); // Обновляем индикатор заметок
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
    userRole = null; // Очищаем роль пользователя
    document.body.classList.remove('edit-mode', 'role-tanya', 'role-dima');
    document.getElementById('edit-notice').style.display = 'none';
    document.getElementById('edit-toggle').textContent = '✏️ Редактировать';
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
    document.getElementById('total-work-days').textContent = workDays;
    
    if (nextWorkDay) {
        document.getElementById('next-workday').textContent = 
            nextWorkDay.toLocaleDateString('ru-RU');
    } else {
        document.getElementById('next-workday').textContent = 'Нет данных';
    }
// Добавляем в конец файла app.js перед последней закрывающей скобкой

// Функции для работы с событиями и быстрыми заметками
async function loadUpcomingEvents() {
    const eventsList = document.getElementById('upcoming-events');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let upcomingEvents = [];
    
    // Ищем рабочие дни в текущем месяце
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= lastDay; day++) {
        const currentDay = new Date(year, month, day);
        if (currentDay < today) continue;
        
        const dayKey = currentDay.toISOString().split('T')[0];
        const schedule = scheduleData[dayKey];
        
        if (schedule?.isWorkDay) {
            upcomingEvents.push({
                date: currentDay,
                title: 'Рабочий день',
                time: schedule.timeStart && schedule.timeEnd ? 
                      `${schedule.timeStart}-${schedule.timeEnd}` : 'Полный день'
            });
            
            // Ограничиваем количество отображаемых событий
            if (upcomingEvents.length >= 5) break;
        }
    }
    
    if (upcomingEvents.length > 0) {
        eventsList.innerHTML = upcomingEvents.map(event => `
            <div class="event-item">
                <div class="event-title">${event.title}</div>
                <div class="event-date">
                    <span>${event.date.toLocaleDateString('ru-RU')}</span>
                    <span>${event.time}</span>
                </div>
            </div>
        `).join('');
    } else {
        eventsList.innerHTML = '<div class="no-events">Нет предстоящих событий</div>';
    }
}

// Функции для быстрых заметок
async function loadQuickNotes() {
    // Загружаем быстрые заметки из localStorage
    const quickNotes = JSON.parse(localStorage.getItem('quickNotes') || '[]');
    const notesList = document.getElementById('quick-notes-list');
    
    if (quickNotes.length > 0) {
        notesList.innerHTML = quickNotes.map((note, index) => `
            <div class="quick-note-item">
                ${note.text}
                <button onclick="deleteQuickNote(${index})" class="btn btn-outline btn-compact" style="margin-top: 5px; padding: 2px 6px; font-size: 0.8em;">✕</button>
            </div>
        `).join('');
    } else {
        notesList.innerHTML = '';
    }
}

function addQuickNote() {
    const noteText = document.getElementById('quick-note-text').value.trim();
    if (!noteText) return;
    
    const quickNotes = JSON.parse(localStorage.getItem('quickNotes') || '[]');
    quickNotes.push({
        text: noteText,
        timestamp: new Date().toISOString()
    });
    
    localStorage.setItem('quickNotes', JSON.stringify(quickNotes));
    document.getElementById('quick-note-text').value = '';
    loadQuickNotes();
}

function deleteQuickNote(index) {
    const quickNotes = JSON.parse(localStorage.getItem('quickNotes') || '[]');
    quickNotes.splice(index, 1);
    localStorage.setItem('quickNotes', JSON.stringify(quickNotes));
    loadQuickNotes();
}

// Обновляем функцию initializeApp
async function initializeApp() {
    await loadData();
    setupEventListeners();
    renderCalendar();
    updateStats();
    loadUpcomingEvents();
    loadQuickNotes();
}

// Обновляем функцию setupEventListeners
function setupEventListeners() {
    // ... существующие обработчики ...
    
    // Кнопка добавления быстрой заметки
    document.getElementById('add-quick-note').addEventListener('click', addQuickNote);
    
    // Enter для быстрых заметок
    document.getElementById('quick-note-text').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addQuickNote();
        }
    });
}

// Обновляем функцию renderCalendar чтобы обновлять события
function renderCalendar() {
    // ... существующий код ...
    loadUpcomingEvents(); // Обновляем события при смене месяца
}
}
