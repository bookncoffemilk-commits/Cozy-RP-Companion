import {
    characters,
    this_chid,
    eventSource,
    event_types,
    saveSettingsDebounced,
} from '../../../../script.js';

import { extension_settings } from '../../../extensions.js';

const MODULE_KEY = 'cozy_rp_companion';

const defaultSettings = {
    theme: 'sakura',
    particlesOn: true,
    apiUrl: '',
    apiKey: '',
    model: '',
    autoAnalyze: true,
    systemPrompt: `Ты — модуль контекстного анализа для RPG панели статуса.
Твоя задача — внимательно прочитать текущие сообщения ролевого чата и извлечь актуальное состояние сцены.
Ответь СТРОГО в формате JSON без кавычек markdown и без вводных слов:
{
  "location": "🏡 Краткое название общей локации (с подходящим эмодзи)",
  "room": "Конкретная зона / комната / участок местности",
  "time": "Время суток (например: 🌙 Глубокая ночь, ⛅ Полдень)",
  "weather": "Текущая погода и условия (например: 🌧 Осенний туман, 48°F)",
  "charOutfit": "Во что одет компаньон (персонаж {{char}})",
  "charHolding": "Что компаньон держит в руках или рядом",
  "userOutfit": "Во что одет игрок (пользователь {{user}})",
  "userStatus": "Текущее состояние игрока"
}`,
    state: {
        location: '🏡 Лесная хижина',
        room: 'Мансарда травницы',
        time: '🌙 Глубокая ночь',
        weather: '🌧 Осенний туман',
        charOutfit: 'Изумрудное платье, вязаная шаль.',
        charHolding: 'Глиняная кружка с мятным отваром.',
        userOutfit: 'Походная рубаха, тёмные бриджи.',
        userStatus: 'Перевязанное плечо, лёгкая слабость.',
    }
};

function getSettings() {
    extension_settings[MODULE_KEY] = extension_settings[MODULE_KEY] || {};
    const s = Object.assign({}, defaultSettings, extension_settings[MODULE_KEY]);
    s.state = Object.assign({}, defaultSettings.state, extension_settings[MODULE_KEY].state || {});
    return s;
}

function saveModuleSettings() {
    saveSettingsDebounced();
}

let settings = getSettings();
let state = settings.state;

function injectSideDock() {
    if (document.getElementById('cozy-fab-trigger')) return;

    // Слой частиц
    let ambientLayer = document.getElementById('cozy-ambient');
    if (!ambientLayer) {
        ambientLayer = document.createElement('div');
        ambientLayer.id = 'cozy-ambient';
        document.body.prepend(ambientLayer);
    }

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
    panel.dataset.theme = settings.theme;
    panel.innerHTML = `
        <div class="cozy-p-head">
            <span class="cozy-p-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 9L12 22L21 9L12 2ZM7.5 9L12 4.5L16.5 9H7.5ZM5.2 9.8L10.8 18.2L5.8 11.2L5.2 9.8ZM13.2 18.2L18.8 9.8L18.2 11.2L13.2 18.2ZM12 19L8.6 10H15.4L12 19Z"/></svg>
                <span>Состояние сцены</span>
            </span>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="cz-btn-sync" id="cz-btn-analyze-now" title="Запустить анализ сцены через ИИ">⚡ Анализ</button>
                <button class="cozy-p-close" id="cozy-p-close-btn" title="Спрятать">✕</button>
            </div>
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

            <!-- БЛОК АНАЛИЗАТОРА И КЛЮЧЕЙ ИИ -->
            <div class="cz-box cz-ai-box">
                <button class="cz-accordion-toggle" id="cz-toggle-ai-settings">
                    <span>⚙️ Анализатор сцены (API, Ключ, Промпт)</span>
                    <span id="cz-ai-toggle-arrow">▼</span>
                </button>
                <div class="cz-accordion-content" id="cz-ai-settings-box" style="display:none;">
                    <label class="cz-field-label">
                        API Endpoint (URL):
                        <input type="text" id="cz-ai-url" class="cz-input" placeholder="https://openrouter.ai/api/v1/chat/completions" value="${settings.apiUrl || ''}">
                    </label>
                    <label class="cz-field-label">
                        API Key:
                        <input type="password" id="cz-ai-key" class="cz-input" placeholder="sk-..." value="${settings.apiKey || ''}">
                    </label>
                    <label class="cz-field-label">
                        ID Модели (Model):
                        <input type="text" id="cz-ai-model" class="cz-input" placeholder="anthropic/claude-3.5-haiku или openai/gpt-4o-mini" value="${settings.model || ''}">
                    </label>
                    <label class="cz-field-label">
                        Промпт Анализатора:
                        <textarea id="cz-ai-prompt" class="cz-textarea">${settings.systemPrompt || ''}</textarea>
                    </label>
                    <div class="cz-ai-opts-row">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" id="cz-ai-auto" ${settings.autoAnalyze ? 'checked' : ''}>
                            <span>Авто-анализ после каждого ответа</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- НИЖНИЙ БЛОК: ТЕМЫ И ЧАСТИЦЫ -->
            <div class="cz-box cz-footer-box">
                <div class="cz-theme-selector">
                    <div class="cz-subhead">Стилизация панели:</div>
                    <div class="cz-theme-btn-group">
                        <button class="cz-thm-btn ${settings.theme === 'sakura' ? 'active' : ''}" data-thm="sakura">🌸 Сакура</button>
                        <button class="cz-thm-btn ${settings.theme === 'forest' ? 'active' : ''}" data-thm="forest">🌲 Лес</button>
                        <button class="cz-thm-btn ${settings.theme === 'autumn' ? 'active' : ''}" data-thm="autumn">🍂 Осень</button>
                        <button class="cz-thm-btn ${settings.theme === 'lavender' ? 'active' : ''}" data-thm="lavender">💜 Лаванда</button>
                    </div>
                </div>

                <div class="cz-particles-toggle-row">
                    <span>Парящие эффекты:</span>
                    <button id="cz-toggle-particles" class="cz-part-btn ${settings.particlesOn ? 'active' : ''}">
                        ${settings.particlesOn ? '✨ Вкл' : '✕ Выкл'}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    document.getElementById('cozy-p-close-btn').onclick = togglePanel;

    bindEdits();
    bindThemeControls();
    bindAiSettings();

    updateChar();
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
}

function bindThemeControls() {
    document.querySelectorAll('.cz-thm-btn').forEach(btn => {
        btn.onclick = () => {
            const thm = btn.dataset.thm;
            settings.theme = thm;
            extension_settings[MODULE_KEY].theme = thm;
            saveModuleSettings();

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
            settings.particlesOn = !settings.particlesOn;
            extension_settings[MODULE_KEY].particlesOn = settings.particlesOn;
            saveModuleSettings();

            partBtn.classList.toggle('active', settings.particlesOn);
            partBtn.innerText = settings.particlesOn ? '✨ Вкл' : '✕ Выкл';
            const layer = document.getElementById('cozy-ambient');
            if (layer && !settings.particlesOn) layer.innerHTML = '';
        };
    }
}

function bindEdits() {
    const edit = (label, currentVal, callback) => {
        const val = prompt(`Изменить ${label}:`, currentVal);
        if (val !== null && val.trim() !== '') {
            callback(val.trim());
            extension_settings[MODULE_KEY].state = state;
            saveModuleSettings();
        }
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

function bindAiSettings() {
    const toggleBtn = document.getElementById('cz-toggle-ai-settings');
    const box = document.getElementById('cz-ai-settings-box');
    const arrow = document.getElementById('cz-ai-toggle-arrow');
    
    if (toggleBtn && box) {
        toggleBtn.onclick = () => {
            const isOpen = box.style.display !== 'none';
            box.style.display = isOpen ? 'none' : 'block';
            if (arrow) arrow.innerText = isOpen ? '▼' : '▲';
        };
    }

    const aiUrl = document.getElementById('cz-ai-url');
    if (aiUrl) {
        aiUrl.onchange = (e) => {
            settings.apiUrl = e.target.value.trim();
            extension_settings[MODULE_KEY].apiUrl = settings.apiUrl;
            saveModuleSettings();
        };
    }

    const aiKey = document.getElementById('cz-ai-key');
    if (aiKey) {
        aiKey.onchange = (e) => {
            settings.apiKey = e.target.value.trim();
            extension_settings[MODULE_KEY].apiKey = settings.apiKey;
            saveModuleSettings();
        };
    }

    const aiModel = document.getElementById('cz-ai-model');
    if (aiModel) {
        aiModel.onchange = (e) => {
            settings.model = e.target.value.trim();
            extension_settings[MODULE_KEY].model = settings.model;
            saveModuleSettings();
        };
    }

    const aiPrompt = document.getElementById('cz-ai-prompt');
    if (aiPrompt) {
        aiPrompt.onchange = (e) => {
            settings.systemPrompt = e.target.value;
            extension_settings[MODULE_KEY].systemPrompt = settings.systemPrompt;
            saveModuleSettings();
        };
    }

    const aiAuto = document.getElementById('cz-ai-auto');
    if (aiAuto) {
        aiAuto.onchange = (e) => {
            settings.autoAnalyze = e.target.checked;
            extension_settings[MODULE_KEY].autoAnalyze = settings.autoAnalyze;
            saveModuleSettings();
        };
    }

    const syncBtn = document.getElementById('cz-btn-analyze-now');
    if (syncBtn) {
        syncBtn.onclick = () => runSceneAnalysis(true);
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
}

/* ==========================================================================
   ЧАСТИЦЫ: 70% КРУЖОЧКИ (СВЕТОВЫЕ ТОЧКИ) + 30% ТЕМАТИЧЕСКИЕ ЧАСТИЦЫ
   ========================================================================== */
function spawnAmbient() {
    if (!settings.particlesOn) return;
    const layer = document.getElementById('cozy-ambient');
    if (!layer) return;

    const p = document.createElement('div');
    const startX = 2 + Math.random() * 96;
    p.style.left = `${startX}vw`;

    // 70% кружочки / пылинки, 30% тематические частицы
    const isDust = Math.random() < 0.70;
    const dur = isDust ? (12 + Math.random() * 14) : (14 + Math.random() * 8);
    p.style.animationDuration = `${dur}s`;

    if (isDust) {
        // Пылинки парят по всей высоте экрана
        p.style.top = `${5 + Math.random() * 85}vh`;
        p.style.animationName = Math.random() > 0.5 ? 'czDustHover1' : 'czDustHover2';
        
        // Разброс размеров от 3px до 10px для объемности
        const size = 3 + Math.random() * 7; 
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.opacity = 0.25 + Math.random() * 0.55;
    }

    const roll = Math.random();
    const thm = settings.theme;

    if (thm === 'sakura') {
        if (isDust) {
            // Кружочки: нежно-розовые, мягкие зеленые, редкие почти белые
            if (roll < 0.50) p.className = 'cz-dust cz-dust-sakura-pink';
            else if (roll < 0.85) p.className = 'cz-dust cz-dust-sakura-green';
            else p.className = 'cz-dust cz-dust-sakura-white';
        } else {
            // Тематические: маленькие лепестки сакуры + редкие зелёные листочки
            if (roll < 0.25) {
                p.className = 'cz-part-sakura-leaf';
                p.innerHTML = '🍃';
            } else {
                p.className = 'cz-part-sakura-petal';
                p.innerHTML = '🌸';
                if (roll > 0.65) p.classList.add('cz-pale');
                if (roll > 0.88) p.classList.add('cz-white-pink');
            }
        }
    } else if (thm === 'forest' || thm === 'cottage') {
        if (isDust) {
            // Кружочки: разные мягкие зеленые, редкие приглушенно-красные, светлые
            if (roll < 0.60) p.className = 'cz-dust cz-dust-forest-green';
            else if (roll < 0.80) p.className = 'cz-dust cz-dust-forest-red';
            else p.className = 'cz-dust cz-dust-forest-neutral';
        } else {
            // Тематические: лесные листья + редкие красные ягоды
            if (roll < 0.20) {
                p.className = 'cz-part-forest-berry';
                p.innerHTML = '🍒';
            } else {
                p.className = 'cz-part-forest-leaf';
                p.innerHTML = roll > 0.5 ? '🌿' : '🍃';
                if (roll > 0.75) p.classList.add('cz-deep-moss');
            }
        }
    } else if (thm === 'autumn') {
        if (isDust) {
            // Кружочки: золотистые, янтарные, мягкие оранжевые, редкие зеленые
            if (roll < 0.35) p.className = 'cz-dust cz-dust-autumn-gold';
            else if (roll < 0.65) p.className = 'cz-dust cz-dust-autumn-amber';
            else if (roll < 0.85) p.className = 'cz-dust cz-dust-autumn-orange';
            else p.className = 'cz-dust cz-dust-autumn-green';
        } else {
            // Тематические: маленькие осенние листья золотые/янтарные, редкие зелёные
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
    } else if (thm === 'lavender') {
        if (isDust) {
            // Кружочки: лавандовые, синие, нежно-желтые, редкие белые
            if (roll < 0.35) p.className = 'cz-dust cz-dust-lavender-purple';
            else if (roll < 0.65) p.className = 'cz-dust cz-dust-lavender-blue';
            else if (roll < 0.85) p.className = 'cz-dust cz-dust-lavender-yellow';
            else p.className = 'cz-dust cz-dust-lavender-white';
        } else {
            // Тематические: маленькие мягкие звёздочки + лавандовые искры
            if (roll < 0.35) {
                p.className = 'cz-part-star-warm';
                p.innerHTML = '★';
            } else {
                p.className = roll < 0.65 ? 'cz-part-mote-blue' : 'cz-part-mote-lavender';
                p.innerHTML = '✦';
            }
        }
    }

    layer.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000);
}

/* ==========================================================================
   ОБНОВЛЕНИЕ DOM ПАНЕЛИ
   ========================================================================== */
function applyStateToUI() {
    const setT = (id, v) => { const el = document.getElementById(id); if (el && v) el.innerText = v; };
    setT('cz-v-loc', state.location);
    setT('cz-v-room', state.room);
    setT('cz-v-time', state.time);
    setT('cz-v-weather', state.weather);
    setT('cz-v-char-outfit', state.charOutfit);
    setT('cz-v-char-holding', state.charHolding);
    setT('cz-v-user-outfit', state.userOutfit);
    setT('cz-v-user-status', state.userStatus);
}

/* ==========================================================================
   ИИ АНАЛИЗАТОР СЦЕНЫ
   ========================================================================== */
async function runSceneAnalysis(isManual = false) {
    const btn = document.getElementById('cz-btn-analyze-now');
    if (btn) {
        btn.innerText = '⏳ Анализ...';
        btn.style.opacity = '0.7';
    }

    try {
        console.log('[Cozy Companion] Запуск анализатора сцены...');
        let chatContext = {};
        if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
            chatContext = SillyTavern.getContext();
        }
        
        const chat = chatContext.chat || [];
        if (!chat || chat.length === 0) {
            console.log('[Cozy Companion] Чат пуст для анализа.');
            if (btn) { btn.innerText = '⚡ Анализ'; btn.style.opacity = '1'; }
            return;
        }

        // Берем последние 3-5 сообщений для точного контекста
        const recentMessages = chat.slice(-4).map(m => `${m.is_user ? 'User' : (m.name || 'Character')}: ${m.mes}`).join('\n\n');

        const userPrompt = `ТЕКУЩЕЕ СОСТОЯНИЕ ПАНЕЛИ:
Локация: ${state.location}
Комната/Зона: ${state.room}
Время: ${state.time}
Погода: ${state.weather}
Наряд персонажа: ${state.charOutfit}
В руках персонажа: ${state.charHolding}
Наряд игрока: ${state.userOutfit}
Статус игрока: ${state.userStatus}

ПОСЛЕДНИЕ РЕПЛИКИ ЧАТА:
${recentMessages}

Проанализируй события, где находятся герои, во что одеты и в каком состоянии. Верни обновленный JSON без разметки markdown.`;

        let rawResponse = '';

        if (settings.apiUrl && settings.apiKey) {
            const reqBody = {
                model: settings.model || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: settings.systemPrompt || defaultSettings.systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2,
            };

            const res = await fetch(settings.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify(reqBody)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`API Error ${res.status}: ${errText}`);
            }

            const data = await res.json();
            rawResponse = data.choices?.[0]?.message?.content || '';
        } else {
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
                const fullPrompt = `${settings.systemPrompt || defaultSettings.systemPrompt}\n\n${userPrompt}`;
                rawResponse = await SillyTavern.getContext().generateQuietPrompt(fullPrompt, false);
            } else {
                throw new Error('Укажите API URL и API Key в настройках анализатора (шестерёнка внизу панели)!');
            }
        }

        console.log('[Cozy Companion] Ответ анализатора:', rawResponse);

        let parsed = null;
        try {
            const clean = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBrace = clean.indexOf('{');
            const lastBrace = clean.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                parsed = JSON.parse(clean.slice(firstBrace, lastBrace + 1));
            }
        } catch (e) {
            console.error('[Cozy Companion] Ошибка парсинга JSON анализатора:', e, rawResponse);
        }

        if (parsed) {
            if (parsed.location) state.location = parsed.location;
            if (parsed.room) state.room = parsed.room;
            if (parsed.time) state.time = parsed.time;
            if (parsed.weather) state.weather = parsed.weather;
            if (parsed.charOutfit) state.charOutfit = parsed.charOutfit;
            if (parsed.charHolding) state.charHolding = parsed.charHolding;
            if (parsed.userOutfit) state.userOutfit = parsed.userOutfit;
            if (parsed.userStatus) state.userStatus = parsed.userStatus;

            extension_settings[MODULE_KEY].state = state;
            saveModuleSettings();
            applyStateToUI();
            console.log('[Cozy Companion] Состояние сцены успешно обновлено!');
        }
    } catch (err) {
        console.error('[Cozy Companion] Ошибка выполнения анализа:', err);
        if (isManual) {
            alert(`Ошибка анализа сцены:\n${err.message || err}`);
        }
    } finally {
        if (btn) {
            btn.innerText = '⚡ Анализ';
            btn.style.opacity = '1';
        }
    }
}

function parseAiStatusTag(data) {
    if (!data) return;
    const text = typeof data === 'string' ? data : (data.mes || '');
    const match = text.match(/\[STATUS:\s*([^\]]+)\]/i);
    if (match) {
        const items = match[1].split('|');
        items.forEach(item => {
            const [k, v] = item.split('=').map(s => s && s.trim());
            if (!k || !v) return;
            const kl = k.toLowerCase();
            if (kl.includes('лок')) { state.location = v; }
            else if (kl.includes('комн')) { state.room = v; }
            else if (kl.includes('врем')) { state.time = v; }
            else if (kl.includes('погод')) { state.weather = v; }
            else if (kl.includes('одежд') || kl.includes('наряд')) { state.charOutfit = v; }
            else if (kl.includes('рук')) { state.charHolding = v; }
        });
        applyStateToUI();
        extension_settings[MODULE_KEY].state = state;
        saveModuleSettings();
    }
}

jQuery(() => {
    injectSideDock();
    setInterval(spawnAmbient, 1800);

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (data) => {
        parseAiStatusTag(data);
        if (settings.autoAnalyze) {
            runSceneAnalysis(false);
        }
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateChar();
    });
});
