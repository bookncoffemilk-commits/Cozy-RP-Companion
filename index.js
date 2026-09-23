import {
    characters,
    this_chid,
    eventSource,
    event_types,
    name1,
    user_avatar,
    getThumbnailUrl,
    chat_metadata,
} from '../../../../script.js';
import { getContext } from '../../../extensions.js';
import { getTokenCountAsync } from '../../../tokenizers.js';

let state = {
    theme: 'sakura',
    particlesOn: true,
    location: '🏡 Лесная хижина',
    room: 'Мансарда травницы',
    time: '🌙 Глубокая ночь',
    weather: '🌧 Осенний туман',
    charOutfit: 'Изумрудное платье, вязаная шаль.',
    charHolding: 'Глиняная кружка с мятным отваром.',
    userOutfit: 'Походная рубаха, тёмные бриджи.',
    userStatus: 'Перевязанное плечо, лёгкая слабость.',
};

function injectSideDock() {
    if (document.getElementById('cozy-fab-trigger')) return;

    // Слой частиц
    const ambientLayer = document.createElement('div');
    ambientLayer.id = 'cozy-ambient';
    document.body.prepend(ambientLayer);

    // 1. ПЕРЕТАСКИВАЕМАЯ НЕЙТРАЛЬНАЯ КНОПКА (✦ ИСКРА / ДРАГОЦЕННЫЙ РОМБ)
    const fab = document.createElement('div');
    fab.id = 'cozy-fab-trigger';
    fab.title = 'Перетащите в любое место или нажмите для открытия';
    fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 9L12 22L21 9L12 2ZM7.5 9L12 4.5L16.5 9H7.5ZM5.2 9.8L10.8 18.2L5.8 11.2L5.2 9.8ZM13.2 18.2L18.8 9.8L18.2 11.2L13.2 18.2ZM12 19L8.6 10H15.4L12 19Z"/></svg>';
    
    // Восстанавливаем позицию если была сохранена
    const savedPos = localStorage.getItem('cozy_fab_pos');
    if (savedPos) {
        try {
            const pos = JSON.parse(savedPos);
            fab.style.left = pos.left + 'px';
            fab.style.top = pos.top + 'px';
            fab.style.bottom = 'auto';
            fab.style.right = 'auto';
        } catch(e) {}
    }
    
    document.body.appendChild(fab);
    makeDraggable(fab);

    // 2. БОКОВАЯ ПАНЕЛЬ
    const panel = document.createElement('div');
    panel.id = 'cozy-side-panel';
    panel.dataset.theme = state.theme;
    panel.innerHTML = `
        <div class="cozy-p-head">
            <span class="cozy-p-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 9L12 22L21 9L12 2ZM7.5 9L12 4.5L16.5 9H7.5ZM5.2 9.8L10.8 18.2L5.8 11.2L5.2 9.8ZM13.2 18.2L18.8 9.8L18.2 11.2L13.2 18.2ZM12 19L8.6 10H15.4L12 19Z"/></svg>
                <span>Состояние сцены</span>
            </span>
            <button class="cozy-p-close" id="cozy-p-close-btn" title="Спрятать">✕</button>
        </div>
        
        <div class="cozy-p-body">
            <!-- Память / Токены -->
            <div class="cz-box">
                <div class="cz-box-head">
                    <span class="cz-box-label">✦ Контекст & Токены</span>
                    <span class="cz-tag">Memory</span>
                </div>
                <div class="cz-bar-bg">
                    <div id="cz-tok-bar" class="cz-bar-fill" style="width: 58%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10.5px; font-weight:700; margin-top:4px;">
                    <span class="cz-val-highlight">Токены: ~4,800 t</span>
                    <span class="cz-accent-sub">Свободно: 3,380 t</span>
                </div>
            </div>

            

            <!-- Сцена -->
            <div class="cz-box">
                <div class="cz-box-head">
                    <span class="cz-box-label">✦ Окружение & Время</span>
                    <span class="cz-tag">Scene</span>
                </div>
                <div class="cz-grid">
                    <div class="cz-tile" id="cz-t-loc">
                        <div class="cz-tile-lbl"><span>Локация</span> <span>✎</span></div>
                        <div class="cz-tile-val" id="cz-v-loc">${state.location}</div>
                    </div>
                    <div class="cz-tile" id="cz-t-room">
                        <div class="cz-tile-lbl"><span>Комната</span> <span>✎</span></div>
                        <div class="cz-tile-val" id="cz-v-room">${state.room}</div>
                    </div>
                    <div class="cz-tile" id="cz-t-time">
                        <div class="cz-tile-lbl"><span>Время</span> <span>✎</span></div>
                        <div class="cz-tile-val" id="cz-v-time">${state.time}</div>
                    </div>
                    <div class="cz-tile" id="cz-t-weather">
                        <div class="cz-tile-lbl"><span>Погода</span> <span>✎</span></div>
                        <div class="cz-tile-val" id="cz-v-weather">${state.weather}</div>
                    </div>
                </div>
            </div>

            <!-- Компаньон -->
            <div class="cz-box">
                <div class="cz-box-head">
                    <span class="cz-box-label cz-lbl-comp">✦ Компаньон</span>
                    <span class="cz-tag cz-tag-comp">Companion</span>
                </div>
                <div class="cz-char-block">
                    <div class="cz-ava" id="cz-char-ava">S</div>
                    <div>
                        <div class="cz-char-name" id="cz-char-name">Seraphina</div>
                        <div style="font-size:10.5px; font-weight:700;" class="cz-accent-sub">● В диалоге</div>
                    </div>
                </div>
                <div class="cz-props-box">
                    <div class="cz-prop-row">
                        <span class="cz-prop-k">Наряд:</span>
                        <span class="cz-prop-v" id="cz-v-char-outfit">${state.charOutfit}</span>
                        <span class="cz-prop-ed" id="cz-ed-char-outfit">✎</span>
                    </div>
                    <div class="cz-prop-row">
                        <span class="cz-prop-k">В руках:</span>
                        <span class="cz-prop-v" id="cz-v-char-holding">${state.charHolding}</span>
                        <span class="cz-prop-ed" id="cz-ed-char-holding">✎</span>
                    </div>
                </div>
            </div>

            <!-- Игрок -->
            <div class="cz-box">
                <div class="cz-box-head">
                    <span class="cz-box-label cz-lbl-user">✦ Игрок</span>
                    <span class="cz-tag cz-tag-user">Player</span>
                </div>
                <div class="cz-char-block">
                    <div class="cz-ava cz-ava-user">U</div>
                    <div>
                        <div class="cz-char-name cz-lbl-user">Wanderer</div>
                        <div style="font-size:10.5px; font-weight:700;" class="cz-prop-k">● В сознании</div>
                    </div>
                </div>
                <div class="cz-props-box">
                    <div class="cz-prop-row">
                        <span class="cz-prop-k">Наряд:</span>
                        <span class="cz-prop-v" id="cz-v-user-outfit">${state.userOutfit}</span>
                        <span class="cz-prop-ed" id="cz-ed-user-outfit">✎</span>
                    </div>
                    <div class="cz-prop-row">
                        <span class="cz-prop-k">Статус:</span>
                        <span class="cz-prop-v" id="cz-v-user-status">${state.userStatus}</span>
                        <span class="cz-prop-ed" id="cz-ed-user-status">✎</span>
                    </div>
                </div>
            </div>

            <!-- НИЖНИЙ БЛОК: ТЕМЫ И ЧАСТИЦЫ -->
            <div class="cz-box cz-footer-box">
                <div class="cz-theme-selector">
                    <div class="cz-subhead">Стилизация панели:</div>
                    <div class="cz-theme-btn-group">
                        <button class="cz-thm-btn ${state.theme === 'sakura' ? 'active' : ''}" data-thm="sakura">🌸 Сакура</button>
                        <button class="cz-thm-btn ${state.theme === 'forest' ? 'active' : ''}" data-thm="forest">🌲 Лес</button>
                        <button class="cz-thm-btn ${state.theme === 'autumn' ? 'active' : ''}" data-thm="autumn">🍂 Осень</button>
                        <button class="cz-thm-btn ${state.theme === 'lavender' ? 'active' : ''}" data-thm="lavender">💜 Лаванда</button>
                    </div>
                </div>

                <div class="cz-particles-toggle-row">
                    <span>Парящие эффекты:</span>
                    <button id="cz-toggle-particles" class="cz-part-btn ${state.particlesOn ? 'active' : ''}">
                        ${state.particlesOn ? '✨ Вкл' : '✕ Выкл'}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    document.getElementById('cozy-p-close-btn').onclick = togglePanel;

    bindEdits();
    bindThemeControls();


    updateChar();
    updateTokens();
}

// ПЕРЕТАСКИВАНИЕ ДЛЯ КНОПКИ БЕЗ ЛОЖНЫХ КЛИКОВ
function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, origX, origY;
    let hasMoved = false;

    el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = el.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        
        el.style.transition = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        let newX = origX + dx;
        let newY = origY + dy;

        // ПЛАВНОЕ ДВИЖЕНИЕ 1:1, НИКАКИХ ПРИЛИПАНИЙ И СЕТОК 8px!
        // ТОЛЬКО БАМПЕР ОТ КРАЁВ ЭКРАНА:
        newX = Math.max(8, Math.min(newX, window.innerWidth - 56));
        newY = Math.max(8, Math.min(newY, window.innerHeight - 56));

        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
    }

    function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;
        el.style.transition = 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease, fill 0.15s ease';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (hasMoved) {
            const rect = el.getBoundingClientRect();
            localStorage.setItem('cozy_fab_pos', JSON.stringify({ left: rect.left, top: rect.top }));
        } else {
            togglePanel();
        }
    }
}

function togglePanel() {
    const panel = document.getElementById('cozy-side-panel');
    const fab = document.getElementById('cozy-fab-trigger');
    if (!panel) return;
    
    const isOpen = panel.classList.toggle('open');
    if (fab) fab.classList.toggle('active', isOpen);
    if (isOpen) updateChar();
    updateTokens();
}

function bindThemeControls() {
    document.querySelectorAll('.cz-thm-btn').forEach(btn => {
        btn.onclick = () => {
            const thm = btn.dataset.thm;
            state.theme = thm;
            document.getElementById('cozy-side-panel').dataset.theme = thm;
            document.querySelectorAll('.cz-thm-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const layer = document.getElementById('cozy-ambient');
            if (layer) layer.innerHTML = '';
        };
    });

    const partBtn = document.getElementById('cz-toggle-particles');
    if (partBtn) {
        partBtn.onclick = () => {
            state.particlesOn = !state.particlesOn;
            partBtn.classList.toggle('active', state.particlesOn);
            partBtn.innerText = state.particlesOn ? '✨ Вкл' : '✕ Выкл';
            const layer = document.getElementById('cozy-ambient');
            if (layer && !state.particlesOn) layer.innerHTML = '';
        };
    }
}

function bindEdits() {
    const edit = (label, currentVal, callback) => {
        const val = prompt(`Изменить ${label}:`, currentVal);
        if (val !== null && val.trim() !== '') callback(val.trim());
    };

    document.getElementById('cz-t-loc').onclick = () => edit('локацию', state.location, v => { state.location = v; document.getElementById('cz-v-loc').innerText = v; });
    document.getElementById('cz-t-room').onclick = () => edit('комнату', state.room, v => { state.room = v; document.getElementById('cz-v-room').innerText = v; });
    document.getElementById('cz-t-time').onclick = () => edit('время', state.time, v => { state.time = v; document.getElementById('cz-v-time').innerText = v; });
    document.getElementById('cz-t-weather').onclick = () => edit('погоду', state.weather, v => { state.weather = v; document.getElementById('cz-v-weather').innerText = v; });

    document.getElementById('cz-ed-char-outfit').onclick = () => edit('наряд персонажа', state.charOutfit, v => { state.charOutfit = v; document.getElementById('cz-v-char-outfit').innerText = v; });
    document.getElementById('cz-ed-char-holding').onclick = () => edit('в руках у персонажа', state.charHolding, v => { state.charHolding = v; document.getElementById('cz-v-char-holding').innerText = v; });
    document.getElementById('cz-ed-user-outfit').onclick = () => edit('ваш наряд', state.userOutfit, v => { state.userOutfit = v; document.getElementById('cz-v-user-outfit').innerText = v; });
    document.getElementById('cz-ed-user-status').onclick = () => edit('ваш статус', state.userStatus, v => { state.userStatus = v; document.getElementById('cz-v-user-status').innerText = v; });
}


function updateLoreDisplay() {
    try {
        const nameEl = document.getElementById('cz-lore-active-name');
        const countEl = document.getElementById('cz-lore-entries-count');
        const previewEl = document.getElementById('cz-lore-preview');
        
        let activeName = 'Не выбран';
        if (selected_world_info && selected_world_info.length > 0) {
            activeName = selected_world_info[0];
        } else if (this_chid !== undefined && characters && characters[this_chid] && characters[this_chid].data && characters[this_chid].data.character_book) {
            activeName = characters[this_chid].data.character_book.name || 'Книга персонажа';
        }

        if (nameEl) nameEl.innerText = activeName;
        
        if (world_info && world_info[activeName]) {
            const entries = world_info[activeName].entries || {};
            const keys = Object.keys(entries);
            if (countEl) countEl.innerText = `Записей: ${keys.length}`;
            if (keys.length > 0 && previewEl) {
                const first = entries[keys[0]];
                previewEl.innerText = (first.comment || first.content || 'Запись активна').slice(0, 85) + '...';
            }
        } else {
            if (countEl) countEl.innerText = 'Память активна';
            if (previewEl) previewEl.innerText = 'Записи лора автоматически внедряются в контекст.';
        }
    } catch(e) {}
}


async function updateTokens() {
    try {
        const context = getContext();
        if (!context || !context.chat || !context.chat.length) return;

        // Собираем весь текст чата для подсчета
        const allText = context.chat.map(m => m.mes).join('
');
        
        let tokenCount = 0;
        if (typeof getTokenCountAsync === 'function') {
            tokenCount = await getTokenCountAsync(allText);
        } else {
            // Фолбэк, если функция недоступна: примерный подсчет
            tokenCount = Math.round(allText.length / 4);
        }
        
        const maxTokens = context.maxContext || 4096;
        const freeTokens = Math.max(0, maxTokens - tokenCount);
        
        // Считаем процент заполнения (минимум 1%, максимум 100%)
        let fillPercent = Math.min(100, Math.max(1, (tokenCount / maxTokens) * 100));

        // Обновляем UI
        const barEl = document.getElementById('cz-tok-bar');
        if (barEl) {
            barEl.style.width = `${fillPercent}%`;
        }

        const labels = document.querySelectorAll('.cz-val-highlight');
        const subLabels = document.querySelectorAll('.cz-accent-sub');
        
        // Ищем метки токенов (первая в списке)
        labels.forEach(el => {
            if (el.innerText.includes('Токены:') || el.innerText.includes('Tokens:')) {
                el.innerText = `Токены: ~${tokenCount.toLocaleString()} t`;
            }
        });
        
        subLabels.forEach(el => {
            if (el.innerText.includes('Свободно:')) {
                el.innerText = `Свободно: ${freeTokens.toLocaleString()} t`;
            }
        });

    } catch (e) {
        console.error("Cozy Companion Token Error:", e);
    }
}

function updateChar() {
    if (this_chid !== undefined && characters && characters[this_chid]) {
        const ch = characters[this_chid];
        const nameEl = document.getElementById('cz-char-name');
        const avaEl = document.getElementById('cz-char-ava');
        if (nameEl) nameEl.innerText = ch.name || 'Персонаж';
        if (avaEl) {
            if (ch.avatar) {
                avaEl.innerHTML = `<img src="/characters/${encodeURIComponent(ch.avatar)}" style="width:100%;height:100%;object-fit:cover;">`;
            } else {
                avaEl.innerText = (ch.name || 'S')[0].toUpperCase();
            }
        }
    }
    
    // ОБНОВЛЯЕМ ИГРОКА (Имя + Аватарка)
    try {
        const userName = name1 || 'Игрок';
        
        const userBlocks = document.querySelectorAll('.cz-lbl-user');
        const userAvaBlocks = document.querySelectorAll('.cz-ava-user');
        
        // Обновляем имя во всех блоках, кроме бейджей
        userBlocks.forEach(el => {
            if (el.tagName !== 'SPAN') { 
                el.innerText = userName;
            }
        });
        
        // Обновляем аватарку пользователя
        if (user_avatar) {
            // В SillyTavern пользовательские аватары (персоны) лежат по этому пути или получаются через getThumbnailUrl
            let avatarImgUrl = `/User Avatars/${encodeURIComponent(user_avatar)}`;
            if (typeof getThumbnailUrl === 'function') {
                avatarImgUrl = getThumbnailUrl('persona', user_avatar);
            }
            
            userAvaBlocks.forEach(el => {
                el.innerHTML = `<img src="${avatarImgUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerText='${userName[0].toUpperCase()}'">`;
            });
        } else {
            userAvaBlocks.forEach(el => {
                el.innerText = userName[0].toUpperCase();
            });
        }
    } catch(e) {
        console.error("Cozy Companion Error:", e);
    }
}

function spawnAmbient() {
    if (!state.particlesOn) return;
    const layer = document.getElementById('cozy-ambient');
    if (!layer) return;

    const p = document.createElement('div');
    const startX = 2 + Math.random() * 96;
    p.style.left = `${startX}vw`;

    // Пылинок стало больше (45% шанс)
    let isDust = Math.random() < 0.45;
    const dur = isDust ? (12 + Math.random() * 15) : (14 + Math.random() * 7);
    p.style.animationDuration = `${dur}s`;

    if (isDust) {
        // Пылинки появляются по всему экрану (от 5% до 90% высоты) и ПАРЯТ, а не падают!
        p.style.top = `${5 + Math.random() * 85}vh`;
        p.style.animationName = Math.random() > 0.5 ? 'czDustHover1' : 'czDustHover2';
    }

    const roll = Math.random();

    if (state.theme === 'sakura') {
        if (isDust) {
            if (roll < 0.2) p.className = 'cz-dust cz-dust-sakura-green';
            else if (roll > 0.85) p.className = 'cz-dust cz-dust-sakura-white';
            else p.className = 'cz-dust cz-dust-sakura-pink';
        } else {
            if (roll < 0.22) {
                p.className = 'cz-part-sakura-leaf';
                p.innerHTML = '🍃';
            } else {
                p.className = 'cz-part-sakura-petal';
                p.innerHTML = '🌸';
                if (roll > 0.65) p.classList.add('cz-pale');
                if (roll > 0.88) p.classList.add('cz-white-pink');
            }
        }
    } else if (state.theme === 'forest' || state.theme === 'cottage') {
        if (isDust) {
            if (roll < 0.15) p.className = 'cz-dust cz-dust-forest-red';
            else if (roll > 0.8) p.className = 'cz-dust cz-dust-forest-neutral';
            else p.className = 'cz-dust cz-dust-forest-green';
        } else {
            if (roll < 0.18) {
                p.className = 'cz-part-forest-berry';
                p.innerHTML = '🍒';
            } else {
                p.className = 'cz-part-forest-leaf';
                p.innerHTML = roll > 0.5 ? '🌿' : '🍃';
                if (roll > 0.75) p.classList.add('cz-deep-moss');
            }
        }
    } else if (state.theme === 'autumn') {
        if (isDust) {
            if (roll < 0.15) p.className = 'cz-dust cz-dust-autumn-green';
            else if (roll < 0.5) p.className = 'cz-dust cz-dust-autumn-gold';
            else if (roll < 0.8) p.className = 'cz-dust cz-dust-autumn-orange';
            else p.className = 'cz-dust cz-dust-autumn-amber';
        } else {
            if (roll < 0.18) {
                p.className = 'cz-part-autumn-green';
                p.innerHTML = '🍃';
            } else {
                p.className = 'cz-part-autumn-leaf';
                p.innerHTML = roll > 0.55 ? '🍁' : '🍂';
                if (roll > 0.45 && roll <= 0.75) p.classList.add('cz-amber');
                if (roll > 0.75) p.classList.add('cz-gold');
            }
        }
    } else if (state.theme === 'lavender') {
        if (isDust) {
            // БАЛАНС: 20% желтые, 20% синие, 20% молочные, 40% лавандовые
            if (roll < 0.20) p.className = 'cz-dust cz-dust-lavender-yellow';
            else if (roll < 0.40) p.className = 'cz-dust cz-dust-lavender-blue';
            else if (roll < 0.60) p.className = 'cz-dust cz-dust-lavender-white';
            else p.className = 'cz-dust cz-dust-lavender-purple';
        } else {
            // БАЛАНС: 25% желтые звездочки, 40% синие искры, 35% лавандовые искры
            if (roll < 0.25) {
                p.className = 'cz-part-star-warm';
                p.innerHTML = '★';
            } else {
                p.className = roll < 0.65 ? 'cz-part-mote-blue' : 'cz-part-mote-lavender';
                p.innerHTML = '✦';
            }
        }
    }

    if (isDust) {
        // Большой разброс размеров, чтобы создать перспективу: от 3px до 11px
        const size = 3 + Math.random() * 8; 
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.opacity = 0.2 + Math.random() * 0.6; // от 20% до 80% яркости
    }

    layer.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000);
}

function parseAiStatus(data) {
    if (!data) return;
    const text = typeof data === 'string' ? data : (data.mes || '');
    let matchedSomething = false;

    // Пытаемся поймать формат с пайпами: [STATUS: Локация=... | Комната=...]
    const matchLine = text.match(/\[STATUS:\s*([^\]]+)\]/i);
    if (matchLine) {
        matchedSomething = true;
        const items = matchLine[1].split('|');
        items.forEach(item => {
            const [k, v] = item.split('=').map(s => s && s.trim());
            if (!k || !v) return;
            applyStatus(k, v);
        });
    }

    // Если пайпов нет, пытаемся поймать построчный формат:
    // LOCATION: ...
    // WEATHER: ...
    // OUTFIT: ...
    const lineRegex = /^(LOCATION|ЛОКАЦИЯ|ROOM|КОМНАТА|TIME|ВРЕМЯ|WEATHER|ПОГОДА|OUTFIT|НАРЯД|ОДЕЖДА|HOLDING|В РУКАХ|STATUS|СТАТУС):\s*(.+)$/gim;
    let matchDict;
    while ((matchDict = lineRegex.exec(text)) !== null) {
        matchedSomething = true;
        applyStatus(matchDict[1], matchDict[2]);
    }

    function applyStatus(k, v) {
        if (!k || !v) return;
        const kl = k.toLowerCase();
        const el = (id) => document.getElementById(id);
        if (kl.includes('лок') || kl.includes('location')) { state.location = v; if (el('cz-v-loc')) el('cz-v-loc').innerText = v; }
        else if (kl.includes('комн') || kl.includes('room')) { state.room = v; if (el('cz-v-room')) el('cz-v-room').innerText = v; }
        else if (kl.includes('врем') || kl.includes('time')) { state.time = v; if (el('cz-v-time')) el('cz-v-time').innerText = v; }
        else if (kl.includes('погод') || kl.includes('weather')) { state.weather = v; if (el('cz-v-weather')) el('cz-v-weather').innerText = v; }
        else if (kl.includes('одежд') || kl.includes('наряд') || kl.includes('outfit')) { state.charOutfit = v; if (el('cz-v-char-outfit')) el('cz-v-char-outfit').innerText = v; }
        else if (kl.includes('рук') || kl.includes('holding')) { state.charHolding = v; if (el('cz-v-char-holding')) el('cz-v-char-holding').innerText = v; }
        else if (kl.includes('статус') || kl.includes('status')) { state.userStatus = v; if (el('cz-v-user-status')) el('cz-v-user-status').innerText = v; }
    }

    if (matchedSomething) updateChar();
    updateTokens();
}

jQuery(() => {
    injectSideDock();
    setInterval(spawnAmbient, 2200);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, parseAiStatus);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, () => { updateChar(); updateTokens(); });
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateChar();
        parseAiStatus('');
    });
});
