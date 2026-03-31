// ============================================
// QQ农场计时器 - 主应用逻辑
// ============================================

// ========== 全局状态 ==========
let state = {
    timers: {},           // 运行中的定时器 { id: { ... } }
    alerts: [],           // 闹钟列表
    history: [],          // 已触发的闹钟历史记录
    settings: {
        volume: 70,
        notifySound: true,
        notifyVibrate: false,
        notifyPush: true,
        alarmSound: 'classic'
    },
    voiceActive: false,
    recognition: null,
    selectedLand: 'normal'  // 当前选择的土地类型
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
    loadState();
    renderPlantGrid();
    renderAlertsList();
    renderHistoryList();
    renderRunningTimers();
    initVoice();
    initPasteHandler();
    initScrollWheels();
    requestNotificationPermission();
    startTimerLoop();
    populatePlantSelects();
    cleanupExpiredAlerts();
    updateSyncStatusBar();

    // 每秒更新运行中的定时器显示
    setInterval(renderRunningTimers, 1000);
    // 每60秒清理过期闹钟
    setInterval(cleanupExpiredAlerts, 60000);
});

// ========== 更新同步状态栏 ==========
function updateSyncStatusBar() {
    const bar = document.getElementById('sync-status-bar');
    const text = document.getElementById('sync-status-text');
    if (!bar || !text) return;

    if (CloudSync.token && CloudSync.gistId) {
        text.textContent = '☁️ 已连接云端（数据自动同步）';
        text.style.color = 'var(--accent-dark)';
    } else if (CloudSync.token) {
        text.textContent = '☁️ 待首次同步';
        text.style.color = 'var(--accent-yellow)';
    } else {
        text.textContent = '☁️ 未连接（去设置中配置云同步）';
        text.style.color = 'var(--text-muted)';
    }
}

// ========== 清理过期闹钟 ==========
function cleanupExpiredAlerts() {
    const now = new Date();
    const before = state.alerts.length;
    state.alerts = state.alerts.filter(a => {
        if (state.timers[a.id]) return true; // 还在运行中
        return new Date(a.endTime) > now;
    });
    if (state.alerts.length !== before) {
        saveState();
        renderAlertsList();
    }
}

// ========== 状态持久化 ==========
let syncDebounce = null;

function saveState() {
    try {
        const saveData = {
            alerts: state.alerts.map(a => ({ ...a })),
            history: state.history.slice(-200), // 最多保留200条
            settings: state.settings
        };
        localStorage.setItem('farm-timer-state', JSON.stringify(saveData));
    } catch (e) {
        console.warn('保存状态失败:', e);
    }

    // 防抖推送到云端（2秒内只推一次）
    if (CloudSync.token) {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(() => {
            CloudSync.pushAlarms(state.alerts);
            updateSyncStatusBar();
        }, 2000);
    }
}

function loadState() {
    try {
        const data = JSON.parse(localStorage.getItem('farm-timer-state'));
        if (data) {
            state.alerts = data.alerts || [];
            state.history = data.history || [];
            state.settings = { ...state.settings, ...data.settings };
            
            // 恢复未过期的闹钟为定时器
            state.alerts.forEach(alert => {
                if (alert.endTime && new Date(alert.endTime) > new Date()) {
                    state.timers[alert.id] = alert;
                }
            });
            
            // 恢复设置UI
            setTimeout(() => {
                document.getElementById('volume-slider').value = state.settings.volume;
                document.getElementById('notify-sound').checked = state.settings.notifySound;
                document.getElementById('notify-vibrate').checked = state.settings.notifyVibrate;
                document.getElementById('notify-push').checked = state.settings.notifyPush;
                document.getElementById('alarm-sound-select').value = state.settings.alarmSound;
            }, 100);
        }
    } catch (e) {
        console.warn('加载状态失败:', e);
    }
}

// ========== 标签页切换 ==========
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

// ========== 滚轮时间选择器 ==========
let wheelValues = { hour: 0, minute: 0, second: 0 };

function initScrollWheels() {
    // 鼠标滚轮支持
    ['hour', 'minute', 'second'].forEach(type => {
        const display = document.getElementById(`${type}-display`);
        
        display.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            wheelAdjust(type, delta);
        }, { passive: false });

        // 长按支持（使用独立变量避免冲突）
        const state = { pressTimer: null, pressInterval: null };
        
        const startPress = (direction) => {
            wheelAdjust(type, direction);
            state.pressTimer = setTimeout(() => {
                state.pressInterval = setInterval(() => {
                    wheelAdjust(type, direction);
                }, 80);
            }, 400);
        };

        const endPress = () => {
            clearTimeout(state.pressTimer);
            clearInterval(state.pressInterval);
        };

        const upBtn = display.parentElement.querySelector('.up');
        const downBtn = display.parentElement.querySelector('.down');
        
        upBtn.addEventListener('mousedown', () => startPress(1));
        upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(1); });
        downBtn.addEventListener('mousedown', () => startPress(-1));
        downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(-1); });
        
        document.addEventListener('mouseup', endPress);
        document.addEventListener('touchend', endPress);
    });
}

function wheelAdjust(type, delta) {
    const max = { hour: 72, minute: 59, second: 59 };
    const step = type === 'hour' ? 1 : (type === 'minute' ? 1 : 5);
    
    wheelValues[type] += delta * step;
    if (wheelValues[type] < 0) wheelValues[type] = max[type];
    if (wheelValues[type] > max[type]) wheelValues[type] = 0;
    
    const display = document.getElementById(`${type}-display`);
    display.textContent = String(wheelValues[type]).padStart(2, '0');
    display.style.transform = 'scale(1.1)';
    setTimeout(() => { display.style.transform = 'scale(1)'; }, 150);
}

function setQuickTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    wheelValues.hour = h;
    wheelValues.minute = m;
    wheelValues.second = s;
    
    document.getElementById('hour-display').textContent = String(h).padStart(2, '0');
    document.getElementById('minute-display').textContent = String(m).padStart(2, '0');
    document.getElementById('second-display').textContent = String(s).padStart(2, '0');
    
    // 视觉反馈
    document.querySelectorAll('.wheel-display').forEach(el => {
        el.style.transform = 'scale(1.15)';
        el.style.color = '#4CAF50';
        setTimeout(() => { 
            el.style.transform = 'scale(1)'; 
            el.style.color = '';
        }, 300);
    });
}

function getTotalSeconds() {
    return wheelValues.hour * 3600 + wheelValues.minute * 60 + wheelValues.second;
}

// ========== 语音控制 ==========
function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        document.getElementById('voice-btn').style.opacity = '0.5';
        document.getElementById('voice-hint').textContent = '当前浏览器不支持语音识别';
        return;
    }
    
    state.recognition = new SpeechRecognition();
    state.recognition.lang = 'zh-CN';
    state.recognition.continuous = false;
    state.recognition.interimResults = true;
    
    state.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        
        document.getElementById('voice-result').textContent = `🎤 "${transcript}"`;
        document.getElementById('voice-result').style.display = 'block';
        
        if (event.results[event.results.length - 1].isFinal) {
            parseVoiceCommand(transcript);
        }
    };
    
    state.recognition.onend = () => {
        state.voiceActive = false;
        updateVoiceUI();
    };
    
    state.recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        state.voiceActive = false;
        updateVoiceUI();
        if (event.error === 'not-allowed') {
            document.getElementById('voice-hint').textContent = '请允许使用麦克风权限';
        }
    };
}

function toggleVoice() {
    if (!state.recognition) {
        showToast('当前浏览器不支持语音识别，请使用Chrome');
        return;
    }
    
    if (state.voiceActive) {
        state.recognition.stop();
    } else {
        try {
            state.recognition.start();
            state.voiceActive = true;
            updateVoiceUI();
            document.getElementById('voice-result').style.display = 'none';
        } catch(e) {
            showToast('语音识别启动失败，请重试');
        }
    }
}

function updateVoiceUI() {
    const btn = document.getElementById('voice-btn');
    if (state.voiceActive) {
        btn.classList.add('listening');
        document.getElementById('voice-hint').textContent = '正在聆听...请说出时间或植物名称';
    } else {
        btn.classList.remove('listening');
        document.getElementById('voice-hint').textContent = '试试说："30分钟后提醒我"';
    }
}

function parseVoiceCommand(text) {
    text = text.replace(/\s/g, '');
    
    // 解析时间表达式
    let totalSeconds = 0;
    let plantName = '';
    
    // 匹配 "X小时Y分钟后提醒"
    const hourMatch = text.match(/(\d+)\s*小时/);
    const minMatch = text.match(/(\d+)\s*分[钟]?/);
    const secMatch = text.match(/(\d+)\s*秒/);
    
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    
    // 如果没有明确时间，尝试匹配植物名称
    if (totalSeconds === 0) {
        const plantNames = Object.keys(PLANTS_DATABASE);
        for (const name of plantNames) {
            if (text.includes(name)) {
                plantName = name;
                totalSeconds = PLANTS_DATABASE[name].growthTime * 3600;
                break;
            }
        }
    }
    
    if (totalSeconds > 0) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        setQuickTime(totalSeconds);
        
        if (plantName) {
            showToast(`🎤 已识别：${plantName}，${PLANTS_DATABASE[plantName].growthTime}小时后提醒`);
        } else {
            showToast(`🎤 已设置：${h > 0 ? h + '小时' : ''}${m > 0 ? m + '分钟' : ''}${s > 0 ? s + '秒' : ''}`);
        }
    } else {
        showToast('🎤 未识别到有效时间，请重试');
    }
}

// ========== 定时器管理 ==========
function startTimer() {
    const seconds = getTotalSeconds();
    if (seconds <= 0) {
        showToast('请先设置时间！');
        return;
    }
    
    const id = 'timer_' + Date.now();
    const endTime = new Date(Date.now() + seconds * 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const timer = {
        id,
        endTime: endTime.toISOString(),
        totalSeconds: seconds,
        remainingSeconds: seconds,
        label: `${h > 0 ? h + '时' : ''}${m > 0 ? m + '分' : ''}${s > 0 ? s + '秒' : ''}`,
        plant: null,
        createdAt: new Date().toISOString()
    };
    
    state.timers[id] = timer;
    state.alerts.push(timer);
    saveState();
    renderRunningTimers();
    renderAlertsList();
    
    showToast(`⏰ 定时器已启动：${timer.label}`);
    
    // 重置时间选择器
    setQuickTime(0);
}

function startPlantTimer(plantName) {
    const plant = PLANTS_DATABASE[plantName];
    if (!plant) {
        showToast('未找到该植物信息');
        return;
    }
    
    const landType = state.selectedLand;
    const land = LAND_TYPES[landType];
    const growTime = calcGrowTime(plantName, landType); // 首季成熟时间
    const totalTime = calcTotalGrowTime(plantName, landType); // 总成熟时间
    const seasonTimes = getSeasonTimes(plantName, landType);
    
    // 显示确认弹窗
    const endTime = new Date(Date.now() + growTime * 3600 * 1000);
    const endStr = endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 构建各季成熟时间信息
    let seasonsInfo = '';
    if (plant.seasons > 1) {
        const seasonList = seasonTimes.map((t, i) => 
            `<div class="season-row">第${i + 1}季: <strong>${t}小时</strong></div>`
        ).join('');
        seasonsInfo = `
            <div class="seasons-detail">
                <div class="seasons-title">📅 各季成熟时间（${land.emoji} ${land.name}）</div>
                ${seasonList}
                <div class="seasons-total">全部收获预计 <strong>${totalTime}小时</strong></div>
            </div>
        `;
    }
    
    const yieldBonus = land.yieldBonus > 0 ? `<span>📈 ${land.emoji}增产+${Math.round(land.yieldBonus * 100)}%</span>` : '';
    const timeBonus = land.timeBonus > 0 ? `<span>⏱️ 成熟-${Math.round(land.timeBonus * 100)}%</span>` : '';
    
    showConfirm(
        `${plant.emoji} 种植确认`,
        `确定要在 <strong>${land.emoji} ${land.name}</strong> 上种下 <strong>${plant.name}</strong> 吗？<br>
        首季成熟：<strong>${growTime}小时</strong>（预计 <strong>${endStr}</strong>）<br>
        <small>💰 收入 ${plant.sellPrice} · ⭐ 经验 +${plant.exp} · ${plant.seasons}季作物</small>
        ${yieldBonus}${timeBonus}
        ${seasonsInfo}`,
        () => {
            const totalSeconds = Math.round(growTime * 3600);
            const id = 'timer_' + Date.now();
            const endTimeISO = new Date(Date.now() + totalSeconds * 1000);
            
            const timer = {
                id,
                endTime: endTimeISO.toISOString(),
                totalSeconds,
                remainingSeconds: totalSeconds,
                label: `${plant.emoji} ${plant.name} (${land.emoji}${growTime}h)`,
                plant: plantName,
                land: landType,
                createdAt: new Date().toISOString()
            };
            
            state.timers[id] = timer;
            state.alerts.push(timer);
            saveState();
            renderRunningTimers();
            renderAlertsList();
            
            showToast(`🌱 ${plant.name}已种在${land.emoji}${land.name}！${growTime}小时后（${endStr}）提醒收菜`);
        }
    );
}

function cancelTimer(id) {
    delete state.timers[id];
    state.alerts = state.alerts.filter(a => a.id !== id);
    saveState();
    renderRunningTimers();
    renderAlertsList();
    showToast('已取消定时器');
}

function renderRunningTimers() {
    const container = document.getElementById('running-timers');
    const card = document.getElementById('running-timers-card');
    const now = Date.now();
    
    const activeTimers = Object.values(state.timers).filter(t => new Date(t.endTime) > new Date(now));
    
    if (activeTimers.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    container.innerHTML = activeTimers.map(timer => {
        const remaining = Math.max(0, Math.floor((new Date(timer.endTime) - now) / 1000));
        const h = Math.floor(remaining / 3600);
        const m = Math.floor((remaining % 3600) / 60);
        const s = remaining % 60;
        const progress = 1 - (remaining / timer.totalSeconds);
        
        return `
            <div class="timer-item">
                <div class="timer-info">
                    <span class="timer-label">${timer.label}</span>
                    <span class="timer-remaining">${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress * 100}%"></div>
                </div>
                <div class="timer-end-time">🕐 ${new Date(timer.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 到期</div>
                <button class="cancel-btn" onclick="cancelTimer('${timer.id}')">取消</button>
            </div>
        `;
    }).join('');
}

// ========== 定时器循环检查 ==========
function startTimerLoop() {
    setInterval(() => {
        const now = Date.now();
        Object.keys(state.timers).forEach(id => {
            const timer = state.timers[id];
            if (timer && new Date(timer.endTime) <= new Date(now)) {
                triggerAlarm(timer);
                delete state.timers[id];
            }
        });
    }, 1000);
}

// ========== 闹钟触发 ==========
let triggeredAlarmIds = new Set();

function triggerAlarm(timer) {
    // 防重入：同一个闹钟只触发一次
    if (triggeredAlarmIds.has(timer.id)) return;
    triggeredAlarmIds.add(timer.id);
    
    const message = timer.plant 
        ? `${PLANTS_DATABASE[timer.plant]?.emoji || '🌱'} ${timer.plant || '植物'}成熟了！快去收菜！` 
        : `⏰ 定时结束！${timer.label}`;
    
    // 写入历史记录
    state.history.push({
        id: timer.id,
        label: timer.label,
        plant: timer.plant,
        endTime: timer.endTime,
        totalSeconds: timer.totalSeconds,
        triggeredAt: new Date().toISOString()
    });
    saveState();
    renderHistoryList();
    
    // 显示弹窗
    document.getElementById('alarm-message').textContent = message;
    document.getElementById('alarm-overlay').style.display = 'flex';
    
    // 播放声音
    if (state.settings.notifySound) {
        playAlarmSound();
    }
    
    // 浏览器通知
    if (state.settings.notifyPush && Notification.permission === 'granted') {
        const notification = new Notification('🌾 农场收菜提醒', {
            body: message,
            icon: '🌾',
            requireInteraction: true
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
            dismissAlarm();
        };
    }
    
    // 震动
    if (state.settings.notifyVibrate && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }
}

function dismissAlarm() {
    document.getElementById('alarm-overlay').style.display = 'none';
    stopAlarmSound();
    // 清除防重入记录（允许同一个ID的闹钟重新创建后再触发）
    triggeredAlarmIds.clear();
}

// ========== 声音系统 ==========
let audioContext = null;
let alarmOscillator = null;
let alarmInterval = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function playAlarmSound() {
    stopAlarmSound();
    const ctx = getAudioContext();
    const volume = state.settings.volume / 100;
    const soundType = state.settings.alarmSound;
    
    const playTone = (freq, duration, type = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume * 0.3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
        return osc;
    };

    if (soundType === 'classic') {
        // 经典铃声：上行音阶
        let i = 0;
        const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
        alarmInterval = setInterval(() => {
            playTone(notes[i % notes.length], 0.2, 'sine');
            i++;
        }, 250);
    } else if (soundType === 'chicken') {
        // 小鸡叫声
        alarmInterval = setInterval(() => {
            playTone(800, 0.08, 'sawtooth');
            setTimeout(() => playTone(600, 0.08, 'sawtooth'), 100);
            setTimeout(() => playTone(900, 0.12, 'sawtooth'), 200);
        }, 500);
    } else if (soundType === 'harvest') {
        // 收获音效：欢快
        let i = 0;
        const melody = [523, 659, 784, 1047, 784, 659, 523, 784];
        alarmInterval = setInterval(() => {
            playTone(melody[i % melody.length], 0.15, 'triangle');
            i++;
        }, 200);
    } else if (soundType === 'alert') {
        // 警报声
        alarmInterval = setInterval(() => {
            playTone(800, 0.15, 'square');
            setTimeout(() => playTone(600, 0.15, 'square'), 180);
        }, 400);
    }
}

function stopAlarmSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// ========== 土地类型选择 ==========
function selectLand(landType) {
    state.selectedLand = landType;
    const land = LAND_TYPES[landType];
    
    // 更新按钮状态
    document.querySelectorAll('.land-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.land === landType);
    });
    
    // 更新加成信息
    const bonusText = document.getElementById('land-bonus-text');
    if (land.timeBonus > 0) {
        bonusText.textContent = `增产+${Math.round(land.yieldBonus * 100)}% · 成熟时间-${Math.round(land.timeBonus * 100)}%`;
    } else if (land.yieldBonus > 0) {
        bonusText.textContent = `增产+${Math.round(land.yieldBonus * 100)}% · 成熟时间无缩短`;
    } else {
        bonusText.textContent = '增产+0% · 成熟时间无缩短';
    }
    
    // 重新渲染植物列表
    renderPlantGrid(document.getElementById('plant-search-input').value);
}

// ========== 植物网格 ==========
function renderPlantGrid(filter = '') {
    const grid = document.getElementById('plant-grid');
    const landType = state.selectedLand;
    const plants = filter ? searchPlants(filter, landType) : Object.values(PLANTS_DATABASE).filter(p => canPlantOnLand(p, landType));
    
    // 按级别排序
    plants.sort((a, b) => a.level - b.level);
    
    grid.innerHTML = plants.map(plant => {
        const growTime = calcGrowTime(plant.name, landType);
        const totalTime = calcTotalGrowTime(plant.name, landType);
        const seasonsInfo = plant.seasons > 1 
            ? `<span class="plant-seasons">${plant.seasons}季 · 总${totalTime}h</span>` 
            : '';
        
        return `
        <div class="plant-card" onclick="startPlantTimer('${plant.name}')">
            <div class="plant-emoji">${plant.emoji}</div>
            <div class="plant-name">${plant.name}</div>
            <div class="plant-time">${growTime}小时${plant.seasons > 1 ? ' (首季)' : ''}</div>
            ${seasonsInfo}
            <div class="plant-level">Lv.${plant.level}</div>
            <div class="plant-profit">
                <span class="coin">💰${plant.sellPrice}</span>
                <span class="exp">⭐${plant.exp}</span>
            </div>
        </div>
    `}).join('');
}

function filterPlants(keyword) {
    renderPlantGrid(keyword);
}

// ========== 自定义植物 ==========
function addCustomPlant() {
    const name = document.getElementById('custom-plant-name').value.trim();
    const hours = parseInt(document.getElementById('custom-hours').value) || 0;
    const minutes = parseInt(document.getElementById('custom-minutes').value) || 0;
    
    if (!name) {
        showToast('请输入植物名称');
        return;
    }
    if (hours <= 0 && minutes <= 0) {
        showToast('请输入成熟时间');
        return;
    }
    
    const totalMinutes = hours * 60 + minutes;
    const totalSeconds = totalMinutes * 60;
    const id = 'timer_' + Date.now();
    const endTime = new Date(Date.now() + totalSeconds * 1000);
    
    const timer = {
        id,
        endTime: endTime.toISOString(),
        totalSeconds,
        remainingSeconds: totalSeconds,
        label: `🌱 ${name} (${hours > 0 ? hours + '时' : ''}${minutes > 0 ? minutes + '分' : ''})`,
        plant: name,
        createdAt: new Date().toISOString()
    };
    
    state.timers[id] = timer;
    state.alerts.push(timer);
    saveState();
    renderRunningTimers();
    renderAlertsList();
    
    document.getElementById('custom-plant-name').value = '';
    document.getElementById('custom-hours').value = '';
    document.getElementById('custom-minutes').value = '';
    
    const endStr = endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    showToast(`🌱 ${name} 定时已设置，${endStr} 提醒收菜`);
}

// ========== 截图识别 ==========
function initPasteHandler() {
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                handleImageBlob(blob);
                break;
            }
        }
    });
}

function handleScreenshot(event) {
    const file = event.target.files[0];
    if (!file) return;
    handleImageBlob(file);
}

function handleImageBlob(blob) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('screenshot-preview');
        const img = document.getElementById('preview-img');
        img.src = e.target.result;
        preview.style.display = 'block';
        
        showToast('📷 截图已加载，请在下方手动输入植物信息（自动OCR识别需要API支持）');
        document.getElementById('ocr-results').innerHTML = `
            <div class="ocr-note">
                <p>⚠️ 自动截图识别功能需要接入OCR识别API，当前版本请手动输入植物信息。</p>
                <p>请查看截图，在下方选择对应的植物和剩余时间。</p>
            </div>
        `;
        
        // 自动切换到手动输入区
        document.getElementById('ocr-manual').scrollIntoView({ behavior: 'smooth' });
    };
    reader.readAsDataURL(blob);
}

function populatePlantSelects() {
    const selects = document.querySelectorAll('.plant-select');
    selects.forEach(select => {
        Object.keys(PLANTS_DATABASE).forEach(name => {
            const plant = PLANTS_DATABASE[name];
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${plant.emoji} ${name} (${plant.growthTime}h)`;
            select.appendChild(option);
        });
    });
}

function addManualEntry() {
    const container = document.getElementById('manual-entries');
    const entry = document.createElement('div');
    entry.className = 'manual-entry';
    entry.innerHTML = `
        <select class="plant-select" onchange="updateManualEntry()">
            <option value="">选择植物</option>
            ${Object.keys(PLANTS_DATABASE).map(name => 
                `<option value="${name}">${PLANTS_DATABASE[name].emoji} ${name} (${PLANTS_DATABASE[name].growthTime}h)</option>`
            ).join('')}
        </select>
        <span>成熟还需</span>
        <input type="number" class="entry-hours" placeholder="时" min="0" max="72" value="0">
        <span>时</span>
        <input type="number" class="entry-minutes" placeholder="分" min="0" max="59" value="0">
        <span>分</span>
        <button class="remove-entry" onclick="removeManualEntry(this)">✕</button>
    `;
    container.appendChild(entry);
}

function removeManualEntry(btn) {
    const container = document.getElementById('manual-entries');
    if (container.children.length > 1) {
        btn.parentElement.remove();
    }
}

function updateManualEntry() {
    // 当选择植物时，自动填充默认成熟时间
    // (可选功能)
}

function applyManualEntries() {
    const entries = document.querySelectorAll('.manual-entry');
    let count = 0;
    
    entries.forEach(entry => {
        const plantName = entry.querySelector('.plant-select').value;
        const hours = parseInt(entry.querySelector('.entry-hours').value) || 0;
        const minutes = parseInt(entry.querySelector('.entry-minutes').value) || 0;
        
        if (hours > 0 || minutes > 0) {
            const totalSeconds = hours * 3600 + minutes * 60;
            const id = 'timer_' + Date.now() + '_' + count;
            const endTime = new Date(Date.now() + totalSeconds * 1000);
            const plant = PLANTS_DATABASE[plantName];
            
            const timer = {
                id,
                endTime: endTime.toISOString(),
                totalSeconds,
                remainingSeconds: totalSeconds,
                label: plantName ? `${plant.emoji} ${plantName} (剩余${hours}时${minutes}分)` : `🌱 未知植物 (剩余${hours}时${minutes}分)`,
                plant: plantName || null,
                createdAt: new Date().toISOString()
            };
            
            state.timers[id] = timer;
            state.alerts.push(timer);
            count++;
        }
    });
    
    if (count > 0) {
        saveState();
        renderRunningTimers();
        renderAlertsList();
        showToast(`✅ 已设置 ${count} 个闹钟！`);
        switchTab('alerts');
    } else {
        showToast('请至少填写一个植物的时间信息');
    }
}

// ========== 睡前种植方案 ==========
function adjustCount(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) + delta;
    val = Math.max(parseInt(input.min), Math.min(parseInt(input.max), val));
    input.value = val;
}

function calculateSleepPlan() {
    const sleepTime = document.getElementById('sleep-time').value;
    const wakeTime = document.getElementById('wake-time').value;
    const plotCount = parseInt(document.getElementById('plot-count').value);
    const existingPlots = parseInt(document.getElementById('existing-plots').value);
    
    // 计算睡眠总时长（小时）
    const [sleepH, sleepM] = sleepTime.split(':').map(Number);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);
    
    let sleepMinutes = sleepH * 60 + sleepM;
    let wakeMinutes = wakeH * 60 + wakeM;
    
    // 处理跨天的情况
    let sleepDuration;
    if (wakeMinutes <= sleepMinutes) {
        // 跨天
        sleepDuration = (24 * 60 - sleepMinutes) + wakeMinutes;
    } else {
        sleepDuration = wakeMinutes - sleepMinutes;
    }
    
    const sleepHours = sleepDuration / 60;
    const availablePlots = plotCount - existingPlots;
    
    if (availablePlots <= 0) {
        showToast('所有地块已有作物，无需再种植！');
        return;
    }
    
    // 寻找最佳种植方案
    // 策略：优先选择成熟时间最接近睡眠时长的植物
    // 如果有多种选择，选择收益最高的
    const plants = Object.values(PLANTS_DATABASE);
    
    // 找出成熟时间 <= 睡眠时长的所有植物
    const suitablePlants = plants.filter(p => p.growthTime <= sleepHours);
    
    // 策略1：单次收获型 - 选成熟时间最接近睡眠时长的
    const bestSingle = findBestPlantForDuration(plants, sleepHours);
    
    // 策略2：多轮收获型 - 选短周期作物，看能收几轮
    let bestMulti = null;
    let maxProfit = 0;
    suitablePlants.forEach(plant => {
        const rounds = Math.floor(sleepHours / plant.growthTime);
        if (rounds > 0) {
            const profit = rounds * (plant.sellPrice - plant.seedPrice);
            const totalExp = rounds * plant.exp;
            if (profit > maxProfit) {
                maxProfit = profit;
                bestMulti = { plant, rounds, profit, totalExp };
            }
        }
    });
    
    // 策略3：混合种植 - 部分地块种长周期，部分种短周期
    // 推荐组合
    const recommendations = generateRecommendations(plants, sleepHours, availablePlots);
    
    // 显示结果
    const resultDiv = document.getElementById('sleep-plan-result');
    resultDiv.style.display = 'block';
    
    const endStr = wakeTime;
    const sleepStr = sleepTime;
    
    resultDiv.innerHTML = `
        <div class="plan-header">
            <div class="plan-stat">
                <span class="stat-label">😴 入睡时间</span>
                <span class="stat-value">${sleepStr}</span>
            </div>
            <div class="plan-stat">
                <span class="stat-label">⏰ 起床时间</span>
                <span class="stat-value">${endStr}</span>
            </div>
            <div class="plan-stat">
                <span class="stat-label">💤 睡眠时长</span>
                <span class="stat-value">${Math.floor(sleepHours)}时${Math.round(sleepHours % 60)}分</span>
            </div>
            <div class="plan-stat">
                <span class="stat-label">🏠 空闲地块</span>
                <span class="stat-value">${availablePlots}块</span>
            </div>
        </div>
        
        ${bestSingle ? `
        <div class="plan-section">
            <h3>🎯 最佳单次种植推荐</h3>
            <p class="plan-desc">种下后睡一觉起来刚好可以收菜</p>
            <div class="plan-plant-card">
                <span class="plan-plant-emoji">${bestSingle.plant.emoji}</span>
                <div>
                    <strong>${bestSingle.plant.name}</strong>
                    <span class="plan-plant-detail">
                        成熟${bestSingle.plant.growthTime}h · 
                        💰利润${bestSingle.plant.sellPrice - bestSingle.plant.seedPrice} · 
                        ⭐经验${bestSingle.plant.exp} ·
                        ${bestSingle.diffHours >= 0 ? `提前${bestSingle.diffHours.toFixed(1)}h成熟` : `超时${Math.abs(bestSingle.diffHours).toFixed(1)}h`}
                    </span>
                </div>
                <button class="small-btn" onclick="startPlantTimer('${bestSingle.plant.name}')">种${availablePlots}块</button>
            </div>
        </div>
        ` : ''}
        
        ${bestMulti && bestMulti.rounds > 1 ? `
        <div class="plan-section">
            <h3>💰 最高收益推荐（多轮种植）</h3>
            <p class="plan-desc">适合半夜会醒来收菜再种的情况</p>
            <div class="plan-plant-card">
                <span class="plan-plant-emoji">${bestMulti.plant.emoji}</span>
                <div>
                    <strong>${bestMulti.plant.name}</strong>
                    <span class="plan-plant-detail">
                        每轮${bestMulti.plant.growthTime}h · 
                        可收${bestMulti.rounds}轮 · 
                        💰总利润${bestMulti.profit} · 
                        ⭐总经验${bestMulti.totalExp}
                    </span>
                </div>
                <button class="small-btn" onclick="startPlantTimer('${bestMulti.plant.name}')">种${availablePlots}块</button>
            </div>
            <div class="plan-rounds">
                ${Array.from({length: bestMulti.rounds}, (_, i) => {
                    const harvestTime = new Date();
                    harvestTime.setHours(sleepH, sleepM + bestMulti.plant.growthTime * 60 * (i + 1));
                    return `<div class="round-item">第${i + 1}轮: ${harvestTime.toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})} 收菜</div>`;
                }).join('')}
            </div>
        </div>
        ` : ''}
        
        ${recommendations.length > 0 ? `
        <div class="plan-section">
            <h3>📊 推荐种植方案</h3>
            <div class="recommendations">
                ${recommendations.map((rec, idx) => `
                    <div class="rec-item ${idx === 0 ? 'best' : ''}">
                        <div class="rec-rank">${idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}</div>
                        <div class="rec-info">
                            <strong>${rec.name}</strong>
                            <span>成熟${rec.growthTime}h | 利润${rec.profit} | 经验${rec.exp}</span>
                            <span class="rec-eval">${rec.evaluation}</span>
                        </div>
                        <button class="small-btn" onclick="startPlantTimer('${rec.name}')">种植</button>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        ${existingPlots > 0 ? `
        <div class="plan-section plan-note">
            <p>📋 你有 <strong>${existingPlots}</strong> 块地已种作物，请确认这些作物会在你起床前成熟，否则建议翻种。</p>
        </div>
        ` : ''}
    `;
    
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function findBestPlantForDuration(plants, targetHours) {
    let best = null;
    let minDiff = Infinity;
    
    plants.forEach(plant => {
        const diff = Math.abs(plant.growthTime - targetHours);
        // 优先选择不会超时的植物（成熟时间 <= 睡眠时长）
        if (plant.growthTime <= targetHours) {
            if (diff < minDiff) {
                minDiff = diff;
                best = { ...plant, diffHours: targetHours - plant.growthTime };
            } else if (diff === minDiff && plant.sellPrice > best.sellPrice) {
                // 同样接近的情况下选收益高的
                best = { ...plant, diffHours: targetHours - plant.growthTime };
            }
        }
    });
    
    // 如果没有合适的，就选最接近的（可能会超时）
    if (!best) {
        plants.forEach(plant => {
            const diff = Math.abs(plant.growthTime - targetHours);
            if (diff < minDiff) {
                minDiff = diff;
                best = { ...plant, diffHours: plant.growthTime - targetHours };
            }
        });
    }
    
    return best;
}

function generateRecommendations(plants, sleepHours, availablePlots) {
    return plants
        .filter(p => p.growthTime <= sleepHours + 2) // 允许超时2小时内
        .map(plant => {
            const profit = plant.sellPrice - plant.seedPrice;
            const profitPerHour = (profit / plant.growthTime).toFixed(0);
            const rounds = Math.floor(sleepHours / plant.growthTime);
            const diff = plant.growthTime - sleepHours;
            
            let evaluation = '';
            if (diff <= 0) {
                const early = Math.abs(diff);
                evaluation = early <= 0.5 ? '⭐ 完美匹配！' : early <= 2 ? `提前${early.toFixed(1)}h成熟` : `提前较多`;
            } else {
                evaluation = `超时${diff.toFixed(1)}h，需要早起收`;
            }
            
            if (rounds > 1) {
                evaluation += ` | 可收${rounds}轮`;
            }
            
            return {
                name: plant.name,
                emoji: plant.emoji,
                growthTime: plant.growthTime,
                profit,
                exp: plant.exp,
                profitPerHour,
                evaluation,
                rounds
            };
        })
        .sort((a, b) => {
            // 综合评分：匹配度 + 利润
            const scoreA = Math.abs(a.growthTime - sleepHours) * -10 + a.profit;
            const scoreB = Math.abs(b.growthTime - sleepHours) * -10 + b.profit;
            return scoreB - scoreA;
        })
        .slice(0, 8);
}

// ========== 闹钟列表 ==========
function renderAlertsList() {
    const list = document.getElementById('alerts-list');
    const now = new Date();
    
    if (state.alerts.length === 0) {
        list.innerHTML = '<p class="empty-text">暂无闹钟，去设置一个吧！</p>';
        return;
    }
    
    list.innerHTML = state.alerts.map(alert => {
        const endTime = new Date(alert.endTime);
        const isExpired = endTime <= now;
        const isActive = state.timers[alert.id] !== undefined;
        
        return `
            <div class="alert-item ${isExpired ? 'expired' : ''} ${isActive ? 'active' : ''}">
                <div class="alert-status">${isActive ? '🟢' : isExpired ? '⚪' : '🔴'}</div>
                <div class="alert-info">
                    <div class="alert-label">${alert.label}</div>
                    <div class="alert-time">
                        ${isExpired ? '已到期' : endTime.toLocaleString('zh-CN', { 
                            month: 'numeric', day: 'numeric', 
                            hour: '2-digit', minute: '2-digit' 
                        })}
                    </div>
                </div>
                ${isActive ? `
                    <button class="alert-cancel" onclick="cancelTimer('${alert.id}')">✕</button>
                ` : `
                    <button class="alert-restart" onclick="restartTimer('${alert.id}')">🔄</button>
                `}
            </div>
        `;
    }).join('');
}

function restartTimer(id) {
    const alert = state.alerts.find(a => a.id === id);
    if (!alert) return;
    
    const newId = 'timer_' + Date.now();
    const endTime = new Date(Date.now() + alert.totalSeconds * 1000);
    
    const timer = {
        ...alert,
        id: newId,
        endTime: endTime.toISOString(),
        remainingSeconds: alert.totalSeconds,
        createdAt: new Date().toISOString()
    };
    
    state.timers[newId] = timer;
    state.alerts.push(timer);
    saveState();
    renderRunningTimers();
    renderAlertsList();
    showToast('🔄 已重新启动定时器');
}

function clearAllAlerts() {
    if (!confirm('确定要清除所有闹钟吗？')) return;
    
    Object.keys(state.timers).forEach(id => delete state.timers[id]);
    state.alerts = [];
    saveState();
    renderRunningTimers();
    renderAlertsList();
    showToast('已清除所有闹钟');
}

// ========== 历史记录 ==========
function renderHistoryList() {
    const list = document.getElementById('history-list');
    const countEl = document.getElementById('history-count');
    const clearWrap = document.getElementById('history-clear-wrap');
    if (!list) return;

    // 按触发时间倒序
    const sorted = [...state.history].reverse();

    if (countEl) countEl.textContent = `${sorted.length}条`;
    if (clearWrap) clearWrap.style.display = sorted.length > 0 ? 'block' : 'none';

    if (sorted.length === 0) {
        list.innerHTML = '<p class="empty-text">暂无历史记录</p>';
        return;
    }

    // 按日期分组
    const groups = {};
    sorted.forEach(item => {
        const triggered = new Date(item.triggeredAt);
        const dateKey = triggered.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(item);
    });

    let html = '';
    Object.entries(groups).forEach(([dateLabel, items]) => {
        html += `<div class="history-date-label">${dateLabel}</div>`;
        items.forEach(item => {
            const triggered = new Date(item.triggeredAt);
            const timeStr = triggered.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            const plant = item.plant ? PLANTS_DATABASE[item.plant] : null;
            const emoji = plant?.emoji || '⏰';
            const duration = formatDuration(item.totalSeconds);

            html += `
                <div class="history-item" onclick="restartFromHistory('${item.id}')">
                    <div class="history-icon">${emoji}</div>
                    <div class="history-info">
                        <div class="history-label">${item.label}</div>
                        <div class="history-meta">
                            <span>⏱️ ${duration}</span>
                            <span>🔔 ${timeStr} 触发</span>
                        </div>
                    </div>
                    <div class="history-restart" title="重新设置">🔄</div>
                </div>
            `;
        });
    });

    list.innerHTML = html;
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0 && m > 0) return `${h}时${m}分`;
    if (h > 0) return `${h}小时`;
    if (m > 0 && s > 0) return `${m}分${s}秒`;
    if (m > 0) return `${m}分钟`;
    if (s > 0) return `${s}秒`;
    return '';
}

function restartFromHistory(id) {
    const item = state.history.find(h => h.id === id);
    if (!item) return;

    if (item.plant && PLANTS_DATABASE[item.plant]) {
        startPlantTimer(item.plant);
    } else if (item.totalSeconds) {
        setQuickTime(item.totalSeconds);
        showToast('⏰ 已填充上次的时间，点击开始计时');
    }
}

function clearHistory() {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    state.history = [];
    saveState();
    renderHistoryList();
    showToast('已清空历史记录');
}

// ========== 设置 ==========
function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
}

function updateVolume(value) {
    state.settings.volume = parseInt(value);
    saveState();
}

function updateAlarmSound(value) {
    state.settings.alarmSound = value;
    saveState();
    // 预览
    playAlarmSound();
    setTimeout(stopAlarmSound, 1500);
}

function updateNotifySetting(key) {
    state.settings[key] = document.getElementById(key).checked;
    saveState();
}

// ========== 通知权限 ==========
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            Notification.requestPermission();
        }, 3000);
    }
}

// ========== Toast提示 ==========
function showToast(message) {
    // 移除旧的toast
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ========== 确认弹窗 ==========
function showConfirm(title, message, onConfirm) {
    // 移除旧的确认弹窗
    const old = document.getElementById('confirm-overlay');
    if (old) old.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <h3>${title}</h3>
            <div class="confirm-body">${message}</div>
            <div class="confirm-actions">
                <button class="secondary-btn confirm-no">取消</button>
                <button class="primary-btn confirm-yes" style="width:auto;padding:10px 28px;">确认种植</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('.confirm-no').onclick = () => overlay.remove();
    overlay.querySelector('.confirm-yes').onclick = () => {
        overlay.remove();
        onConfirm();
    };
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// ========== 选择植物自动填充成熟时间 ==========
function updateManualEntry() {
    // 这个函数在select onchange时被调用，自动填充该植物的总成熟时间
}

// ========== 页面可见性恢复时刷新 ==========
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        renderRunningTimers();
        renderAlertsList();
        // 检查是否有错过的闹钟
        const now = Date.now();
        Object.keys(state.timers).forEach(id => {
            const timer = state.timers[id];
            if (timer && new Date(timer.endTime) <= new Date(now)) {
                triggerAlarm(timer);
                delete state.timers[id];
            }
        });
    }
});

// ========== 点击模态框外部关闭 ==========
document.addEventListener('click', (e) => {
    const settingsModal = document.getElementById('settings-modal');
    if (e.target === settingsModal) {
        toggleSettings();
    }
});
