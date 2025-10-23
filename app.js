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
const ADMIN_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"; 

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
let userRole = null;
let currentUser = null;
let selectedDay = null;
let selectedNote = null;
let scheduleData = {};
let notesData = {};
let currentTheme = 'light';

// Переменные для real-time listeners
let scheduleUnsubscribe = null;
let notesUnsubscribe = null;

// Переменные для свайпов
let touchStartX = 0;
let touchEndX = 0;

const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// Время окончания работы по дням недели
const endTimeOptions = {
    1: ["16:30", "18:00", "21:00"], // Пн
    2: ["16:30", "18:00", "21:00"], // Вт
    3: ["16:30", "18:00", "21:00"], // Ср
    4: ["16:30", "18:00", "21:00"], // Чт
    5: ["15:15", "16:45", "17:00", "18:00", "21:00"], // Пт
    0: ["16:30", "16:45", "17:00", "18:00", "21:00"], // Вс
    6: ["16:30", "16:45", "17:00", "18:00", "21:00"] // Сб
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    checkSavedAuth();
    setupEventListeners();
    setupSwipeHandlers();
});

// Инициализация темы
function initTheme() {
    const savedTheme = localStorage.getItem('calendarTheme');
    if (savedTheme) {
        currentTheme = savedTheme;
        applyTheme(savedTheme);
    } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            currentTheme = 'dark';
            applyTheme('dark');
        }
    }
}

// Применение темы
function applyTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('calendarTheme', theme);
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Переключение темы
function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Проверка сохраненной авторизации
function checkSavedAuth() {
    const savedUser = localStorage.getItem('calendarUser');
    const savedRole = localStorage.getItem('calendarUserRole');
    
    if (savedUser && savedRole) {
        userRole = savedRole;
        currentUser = savedUser;
        
        document.getElementById('login-modal').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
        document.getElementById('current-user').textContent = currentUser;
        
        loadData();
        
        console.log('✅ Пользователь авторизован из localStorage:', currentUser);
    } else {
        document.getElementById('login-modal').style.display = 'flex';
    }
}

// Сохранение авторизации
function saveAuth() {
    if (currentUser && userRole) {
        localStorage.setItem('calendarUser', currentUser);
        localStorage.setItem('calendarUserRole', userRole);
    }
}

// Выход из системы
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        // Отписываемся от real-time listeners
        if (scheduleUnsubscribe) {
            scheduleUnsubscribe();
            scheduleUnsubscribe = null;
        }
        if (notesUnsubscribe) {
            notesUnsubscribe();
            notesUnsubscribe = null;
        }
        
        localStorage.removeItem('calendarUser');
        localStorage.removeItem('calendarUserRole');
        
        userRole = null;
        currentUser = null;
        isEditMode = false;
        
        document.getElementById('login-modal').style.display = 'flex';
        document.querySelector('.container').style.display = 'none';
        document.getElementById('login-password-input').value = '';
        
        console.log('✅ Пользователь вышел из системы');
    }
}

// Загрузка данных из Firebase с real-time listeners
function loadData() {
    if (!db) {
        console.warn('Firebase не инициализирован');
        return;
    }

    // Отписываемся от предыдущих listeners если они есть
    if (scheduleUnsubscribe) {
        scheduleUnsubscribe();
    }
    if (notesUnsubscribe) {
        notesUnsubscribe();
    }

    // Real-time listener для расписания
    scheduleUnsubscribe = db.collection('schedule').onSnapshot((scheduleSnapshot) => {
        scheduleData = {};
        scheduleSnapshot.forEach(doc => {
            scheduleData[doc.id] = doc.data();
        });
        
        console.log('✅ Расписание обновлено в реальном времени');
        renderCalendar();
        updateStats();
          // Автоматически выбираем сегодня после загрузки данных
    if (!selectedDay) {
        setTimeout(selectToday, 100);
    }
    }, (error) => {
        console.error('❌ Ошибка real-time расписания:', error);
    });

    // Real-time listener для заметок
    notesUnsubscribe = db.collection('notes').orderBy('timestamp', 'desc').onSnapshot((notesSnapshot) => {
        notesData = {};
        notesSnapshot.forEach(doc => {
            const noteData = doc.data();
            const dateKey = noteData.date;
            
            if (!notesData[dateKey]) {
                notesData[dateKey] = [];
            }
            
            notesData[dateKey].push({
                id: doc.id,
                ...noteData
            });
        });
        
        console.log('✅ Заметки обновлены в реальном времени');
        renderCalendar();
        
        if (selectedDay) {
            showDayNotes(selectedDay.date, selectedDay.dayKey);
        }
    }, (error) => {
        console.error('❌ Ошибка real-time заметок:', error);
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма входа при запуске
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Кнопка выхода
    document.getElementById('logout-btn').addEventListener('click', logout);

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
          selectToday(); // ← добавляем выбор сегодняшнего дня
    });

    // Кнопка редактирования
    document.getElementById('edit-toggle').addEventListener('click', function() {
        if (isEditMode) {
            exitEditMode();
        } else {
            enterEditMode();
        }
    });

    // Кнопка переключения темы
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Форма добавления заметки
    document.getElementById('add-note-form').addEventListener('submit', handleAddNote);

    // Форма ответа на заметку
    document.getElementById('reply-note-form').addEventListener('submit', handleReplyNote);

    // Кнопка добавления заметки в боковой панели
    document.getElementById('add-day-note').addEventListener('click', function() {
        if (selectedDay) {
            showAddNoteForm();
        } else {
            alert('Сначала выберите день');
        }
    });

    // Запрещаем закрытие модального окна авторизации при клике вне его
    document.getElementById('login-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

// Настройка обработчиков свайпов
function setupSwipeHandlers() {
    const calendarSection = document.querySelector('.calendar-section');
    
    if (calendarSection) {
        calendarSection.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        calendarSection.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);
    }
}

// Обработка свайпов
function handleSwipe() {
    const swipeThreshold = 50;
    
    if (touchEndX < touchStartX - swipeThreshold) {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
        updateStats();
    } else if (touchEndX > touchStartX + swipeThreshold) {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
        updateStats();
    }
}

// Обработка входа в систему
async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('login-password-input').value;
    const userType = document.getElementById('login-user-type').value;
    
    // Хешируем пароль и проверяем
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if ((userType === 'tanya' || userType === 'dima') && hashHex === ADMIN_PASSWORD_HASH) {
        userRole = userType;
        currentUser = userType === 'tanya' ? 'Таня' : 'Дима';
        
        saveAuth();
        
        document.getElementById('login-modal').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
        document.getElementById('current-user').textContent = currentUser;
        
        loadData();
        
        console.log('✅ Пользователь авторизован:', currentUser);
    } else {
        alert('❌ Неверный пароль');
    }
}
function selectToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatDate(today);
    
    selectedDay = { 
        date: today, 
        dayKey: todayKey, 
        isWorkDay: scheduleData[todayKey]?.isWorkDay || false 
    };
    
    showDayNotes(today, todayKey);
    
    // Прокручиваем к сегодняшнему дню в календаре
    scrollToToday();
}
function scrollToToday() {
    const todayElement = document.querySelector('.month-day.today');
    if (todayElement) {
        todayElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center' 
        });
    }
}

// Рендер календаря
function renderCalendar() {
    const calendar = document.getElementById('monthCalendar');
    if (!calendar) return;
    
    calendar.innerHTML = '';

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
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
    const totalCells = 35;
    const existingCells = firstDayOfWeek + lastDay.getDate();
    for (let i = 1; i <= totalCells - existingCells; i++) {
        const nextMonthDay = new Date(year, month + 1, i);
        createDayElement(nextMonthDay, true);
    }
      // Автоматически выбираем сегодняшний день при первой загрузке
    if (!selectedDay) {
        setTimeout(selectToday, 100);
    }
}

// Создание элемента дня
function createDayElement(date, isOtherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'month-day';
    
    const dayKey = formatDate(date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWorkDay = scheduleData[dayKey]?.isWorkDay || false;
    const workTimeStart = scheduleData[dayKey]?.timeStart || '';
    const workTimeEnd = scheduleData[dayKey]?.timeEnd || '';
    const customText = scheduleData[dayKey]?.customText || '';
    const hasNotes = notesData[dayKey] && notesData[dayKey].length > 0;
    const hasWorkTime = workTimeStart && workTimeStart !== '';
    const hasCustomText = customText && customText !== '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();

    if (isOtherMonth) dayElement.classList.add('other-month');
    if (isWeekend) dayElement.classList.add('weekend');
    if (isToday) dayElement.classList.add('today');
    if (isWorkDay) dayElement.classList.add('work-day');
    if (hasNotes) dayElement.classList.add('has-notes');
    if (hasWorkTime) dayElement.classList.add('has-work-time');
    if (hasCustomText) dayElement.classList.add('has-custom-text');

    // Номер дня
    const dayNumber = document.createElement('div');
    dayNumber.className = 'month-day-number';
    dayNumber.textContent = date.getDate();
    dayElement.appendChild(dayNumber);

    // Время работы (если есть)
    if (hasWorkTime) {
        const timeElement = document.createElement('div');
        timeElement.className = 'month-day-time';
        
        // Форматируем время: убираем нули, заменяем тире на перенос строки
        const formatTime = (timeStr) => timeStr.replace(/^0/, '');
        const startFormatted = formatTime(workTimeStart);
        const endFormatted = formatTime(workTimeEnd);
        
        timeElement.textContent = `${startFormatted}\n${endFormatted}`;
        dayElement.appendChild(timeElement);
    }

    // Кастомный текст (если есть)
    if (hasCustomText) {
        const customTextElement = document.createElement('div');
        customTextElement.className = 'month-day-custom-text';
        customTextElement.textContent = customText;
        dayElement.appendChild(customTextElement);
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
    
    if (!selectedDayInfo || !dayNotesList) return;
    
    const dateStr = date.toLocaleDateString('ru-RU', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    selectedDayInfo.textContent = dateStr;
    
    const dayNotes = notesData[dayKey] || [];
    
    if (dayNotes.length > 0) {
        dayNotesList.innerHTML = dayNotes.map((note, index) => `
            <div class="day-note-item">
                <div class="day-note-meta">
                    <span class="day-note-author">${note.author || 'Автор'}</span>
                    <span class="day-note-time">${new Date(note.timestamp).toLocaleString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                    })}</span>
                </div>
                <div class="day-note-text">${note.text}</div>
                ${note.replies && note.replies.length > 0 ? `
                    <div class="replies-list">
                        ${note.replies.map(reply => `
                            <div class="reply-item">
                                <div class="reply-meta">
                                    <span class="reply-author">${reply.author || 'Автор'}</span>
                                    <span class="reply-time">${new Date(reply.timestamp).toLocaleString('ru-RU', { 
                                        hour: '2-digit', 
                                        minute: '2-digit',
                                        day: '2-digit',
                                        month: '2-digit'
                                    })}</span>
                                </div>
                                <div class="reply-text">${reply.text}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="day-note-actions">
                    <button class="btn btn-reply" onclick="showReplyModal('${dayKey}', '${note.id}')">
                        💬 Ответить
                    </button>
                    <button class="btn btn-danger" onclick="deleteNote('${note.id}')">
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
async function deleteNote(noteId) {
    if (!confirm('Удалить заметку?')) {
        return;
    }
    
    if (!db) {
        alert('Firebase не инициализирован');
        return;
    }
    
    try {
        await db.collection('notes').doc(noteId).delete();
        
        console.log('✅ Заметка удалена из Firebase');
    } catch (error) {
        console.error('❌ Ошибка удаления заметки:', error);
        alert('Ошибка при удалении заметки');
    }
}

// Функция показа модального окна ответа
function showReplyModal(dayKey, noteId) {
    const note = notesData[dayKey]?.find(n => n.id === noteId);
    if (!note) return;
    
    selectedNote = { dayKey, noteId, note };
    
    const modal = document.getElementById('reply-note-modal');
    const originalNote = document.getElementById('original-note-content');
    
    if (modal && originalNote) {
        originalNote.innerHTML = `
            <strong>Оригинальная заметка:</strong><br>
            <div class="day-note-meta">
                <span class="day-note-author">${note.author || 'Автор'}</span>
                <span class="day-note-time">${new Date(note.timestamp).toLocaleString('ru-RU')}</span>
            </div>
            ${note.text}
        `;
        
        document.getElementById('reply-text').value = '';
        modal.style.display = 'flex';
    }
}

// Функция обработки ответа на заметку
async function handleReplyNote(e) {
    e.preventDefault();
    
    if (!selectedNote || !db) return;
    
    const replyText = document.getElementById('reply-text').value.trim();
    if (!replyText) return;
    
    try {
        const replyData = {
            text: replyText,
            author: currentUser,
            timestamp: new Date().toISOString()
        };
        
        const noteDoc = await db.collection('notes').doc(selectedNote.noteId).get();
        const noteData = noteDoc.data();
        
        const replies = noteData.replies || [];
        replies.push(replyData);
        
        await db.collection('notes').doc(selectedNote.noteId).update({
            replies: replies
        });
        
        closeReplyModal();
        console.log('✅ Ответ сохранен в Firebase');
    } catch (error) {
        console.error('❌ Ошибка сохранения ответа:', error);
        alert('Ошибка при сохранении ответа');
    }
}

// Закрытие модального окна ответа
function closeReplyModal() {
    const modal = document.getElementById('reply-note-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedNote = null;
}

// Функция для переключения рабочего дня (для Тани)
async function toggleWorkDay() {
    if (!db) {
        alert('Firebase не инициализирован');
        return;
    }
    
    const wasWorkDay = scheduleData[selectedDay.dayKey]?.isWorkDay || false;
    const newWorkDayState = !wasWorkDay;
    
    const existingTimeStart = scheduleData[selectedDay.dayKey]?.timeStart || '';
    const existingTimeEnd = scheduleData[selectedDay.dayKey]?.timeEnd || '';
    const existingCustomText = scheduleData[selectedDay.dayKey]?.customText || '';
    
    try {
        await db.collection('schedule').doc(selectedDay.dayKey).set({
            isWorkDay: newWorkDayState,
            timeStart: existingTimeStart,
            timeEnd: existingTimeEnd,
            customText: existingCustomText,
            date: selectedDay.dayKey,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        scheduleData[selectedDay.dayKey] = {
            isWorkDay: newWorkDayState,
            timeStart: existingTimeStart,
            timeEnd: existingTimeEnd,
            customText: existingCustomText
        };
        
        renderCalendar();
        updateStats();
        console.log('✅ Рабочий день обновлен в Firebase');
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        alert('Ошибка при сохранении изменений');
    }
}

// Модальное окно времени/текста для Димы
function showTimeModal() {
    const modal = document.getElementById('time-modal');
    const title = document.getElementById('time-modal-title');
    const timeStartSelect = document.getElementById('work-time-start');
    const timeEndSelect = document.getElementById('work-time-end');
    
    if (!modal || !title || !timeStartSelect || !timeEndSelect) return;
    
    const dateStr = selectedDay.date.toLocaleDateString('ru-RU');
    title.textContent = `${dateStr}`;
    
    // Заполняем данные если есть
    const dayData = scheduleData[selectedDay.dayKey];
    if (dayData) {
        if (dayData.timeStart) {
            timeStartSelect.value = dayData.timeStart;
            // Заполняем варианты окончания работы
            updateEndTimeOptions(dayData.timeStart, selectedDay.date.getDay());
            timeEndSelect.value = dayData.timeEnd;
        } else {
            timeStartSelect.value = '';
            timeEndSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
        }
        
        if (dayData.customText) {
            document.getElementById('custom-text').value = dayData.customText;
        } else {
            document.getElementById('custom-text').value = '';
        }
    } else {
        // Сбрасываем значения если данных нет
        timeStartSelect.value = '';
        timeEndSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
        document.getElementById('custom-text').value = '';
    } 
    // Обработчик изменения времени начала
    timeStartSelect.onchange = () => {
        if (timeStartSelect.value) {
            updateEndTimeOptions(timeStartSelect.value, selectedDay.date.getDay());
        } else {
            timeEndSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
        }
    };
    modal.style.display = 'flex';
}

// Функция обновления опций времени окончания
function updateEndTimeOptions(startTime, dayOfWeek) {
    const endSelect = document.getElementById('work-time-end');
    const options = endTimeOptions[dayOfWeek] || endTimeOptions[1];
    
    endSelect.innerHTML = '';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- Не выбрано --';
    endSelect.appendChild(emptyOption);
    
    options.forEach(time => {
        if (time > startTime) {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            endSelect.appendChild(option);
        }
    });
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
    
    if (!modal || !title) return;
    
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

async function handleAddNote(e) {
    e.preventDefault();
    
    if (!selectedDay || !db) return;
    
    const noteText = document.getElementById('note-text').value.trim();
    if (!noteText) return;
    
    try {
        const noteData = {
            text: noteText,
            author: currentUser,
            timestamp: new Date().toISOString(),
            date: selectedDay.dayKey
        };
        
        await db.collection('notes').add(noteData);
        
        closeAddNoteModal();
        console.log('✅ Заметка сохранена в Firebase');
    } catch (error) {
        console.error('❌ Ошибка сохранения заметки:', error);
        alert('Ошибка при сохранении заметки');
    }
}

// Сохранение времени работы или кастомного текста
async function saveWorkTime() {
    if (!selectedDay || !db) return;
    
    const workTimeStart = document.getElementById('work-time-start').value;
    const workTimeEnd = document.getElementById('work-time-end').value;
    const customText = document.getElementById('custom-text').value.trim();
    
    // Если выбрано время начала, но не выбрано окончание - показываем ошибку
    if (workTimeStart && !workTimeEnd) {
        alert('❌ Выберите время окончания работы');
        return;
    }
    
    // Если выбрано время окончания, но не выбрано начало - показываем ошибку
    if (workTimeEnd && !workTimeStart) {
        alert('❌ Выберите время начала работы');
        return;
    }
    
    try {
        const updateData = {
            date: selectedDay.dayKey,
            updatedAt: new Date().toISOString()
        };
        
        // Сохраняем время если оно выбрано
        if (workTimeStart && workTimeEnd) {
            updateData.timeStart = workTimeStart;
            updateData.timeEnd = workTimeEnd;
        } else {
            // Если время не выбрано - очищаем его
            updateData.timeStart = '';
            updateData.timeEnd = '';
        }
        
        // Сохраняем текст если он есть
        if (customText) {
            updateData.customText = customText;
        } else {
            updateData.customText = '';
        }
        
        // Сохраняем статус рабочего дня Тани если он есть
        if (scheduleData[selectedDay.dayKey]?.isWorkDay) {
            updateData.isWorkDay = true;
        }
        
        await db.collection('schedule').doc(selectedDay.dayKey).set(updateData, { merge: true });
        
        closeTimeModal();
        renderCalendar();
        updateStats();
        console.log('✅ Данные дня сохранены в Firebase');
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        alert('Ошибка при сохранении');
    }
}

// Управление режимом редактирования
function enterEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode', `role-${userRole}`);
    
    document.getElementById('edit-toggle').textContent = 'Сохранить';
    document.getElementById('edit-toggle').classList.remove('btn-primary');
    document.getElementById('edit-toggle').classList.add('btn-secondary');
}

function exitEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode', 'role-tanya', 'role-dima');
    document.getElementById('edit-toggle').textContent = '✏️';
    document.getElementById('edit-toggle').classList.remove('btn-secondary');
    document.getElementById('edit-toggle').classList.add('btn-primary');
}

// Статистика
function updateStats() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    let workDays = 0;
    let workHours = 0;
    const today = new Date();
    let nextWorkDay = null;
    
    // Разная логика для Тани и Димы
    if (userRole === 'tanya') {
        // Для Тани: считаем рабочие дни и умножаем на 12 часов
        for (let day = 1; day <= lastDay; day++) {
            const currentDay = new Date(year, month, day);
            const dayKey = formatDate(currentDay);
            
            if (scheduleData[dayKey]?.isWorkDay) {
                workDays++;
                
                if (!nextWorkDay && currentDay >= today) {
                    nextWorkDay = currentDay;
                }
            }
        }
        workHours = workDays * 12;
        
    } else if (userRole === 'dima') {
        // Для Димы: считаем дни с указанным временем работы или кастомным текстом и умножаем на 8 часов
        for (let day = 1; day <= lastDay; day++) {
            const currentDay = new Date(year, month, day);
            const dayKey = formatDate(currentDay);
            
            const hasWorkTime = scheduleData[dayKey]?.timeStart && scheduleData[dayKey]?.timeStart !== '';
            const hasCustomText = scheduleData[dayKey]?.customText && scheduleData[dayKey]?.customText !== '';
            
            if (hasWorkTime || hasCustomText) {
                workDays++;
                
                if (!nextWorkDay && currentDay >= today) {
                    nextWorkDay = currentDay;
                }
            }
        }
        workHours = workDays * 8;
    }
    
    // Обновляем статистику
    const totalWorkDays = document.getElementById('total-work-days');
    const totalWorkHours = document.getElementById('total-work-hours');
    const workHoursLabel = document.getElementById('work-hours-label');
    const nextWorkday = document.getElementById('next-workday');
    
    if (totalWorkDays) {
        totalWorkDays.textContent = workDays;
    }
    
    if (totalWorkHours) {
        totalWorkHours.textContent = workHours;
    }
    
    if (workHoursLabel) {
        workHoursLabel.textContent = userRole === 'tanya' ? 'Часов (12ч/день)' : 'Часов (8ч/день)';
    }
    
    if (nextWorkday) {
        if (nextWorkDay) {
            nextWorkday.textContent = nextWorkDay.toLocaleDateString('ru-RU');
        } else {
            nextWorkday.textContent = 'Нет данных';
        }
    }
}

// Вспомогательная функция для форматирования даты
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Закрытие модальных окон при клике вне их (кроме авторизации)
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal && modal.id !== 'login-modal') {
            modal.style.display = 'none';
        }
    });
});
