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
        notifyWeChat: true,
        alarmSound: 'classic'
    },
    voiceActive: false,
    recognition: null,
    selectedLand: 'gold'  // 当前选择的土地类型，默认金土
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    loadCustomPlants();  // 先加载自定义植物到数据库
    CloudSync.init();
    loadState();
    renderPlantGrid();
    renderAlertsList();
    renderHistoryList();
    renderRunningTimers();
    initVoice();
    initScrollWheels();
    requestNotificationPermission();
    startTimerLoop();
    cleanupExpiredAlerts();
    updateSyncStatusBar();
    renderCustomPlantsList();
    initSeasonHint();
    initPWA();
    selectLand(state.selectedLand || 'gold');
    updateStickyOffsets();

    // 初始化分析页面
    selectAnalysisLand(analysisState.selectedLand || 'gold');

    window.addEventListener('resize', updateStickyOffsets);

    // 每秒更新运行中的定时器显示
    setInterval(renderRunningTimers, 1000);
    // 每60秒清理过期闹钟
    setInterval(cleanupExpiredAlerts, 60000);
});

// ========== 更新同步状态栏（顶部按钮状态） ==========
function updateSyncStatusBar() {
    const syncIcon = document.getElementById('header-sync-icon');
    if (!syncIcon) return;

    if (CloudSync.token && CloudSync.gistId) {
        syncIcon.textContent = '☁️';
        syncIcon.title = '已连接云端，点击同步';
    } else if (CloudSync.token) {
        syncIcon.textContent = '⏳';
        syncIcon.title = '待首次同步，点击同步';
    } else {
        syncIcon.textContent = '☁️';
        syncIcon.title = '未连接（去设置中配置云同步）';
    }
}

function updateStickyOffsets() {
    const root = document.documentElement;
    const header = document.querySelector('.app-header');
    const tabNav = document.querySelector('.tab-nav');

    const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : 0;
    const tabHeight = tabNav ? Math.round(tabNav.getBoundingClientRect().height) : 0;

    if (headerHeight > 0) {
        root.style.setProperty('--header-sticky-height', `${headerHeight}px`);
    }
    if (tabHeight > 0) {
        root.style.setProperty('--tab-sticky-height', `${tabHeight}px`);
    }
    if (headerHeight > 0 || tabHeight > 0) {
        root.style.setProperty('--plant-sticky-top', `${headerHeight + tabHeight}px`);
    }
}

// ========== 清理过期闹钟 ==========
function sortHistoryItems(items = []) {
    return items.sort((a, b) => {
        const aTime = new Date(a.triggeredAt || a.endTime || 0).getTime();
        const bTime = new Date(b.triggeredAt || b.endTime || 0).getTime();
        return aTime - bTime;
    });
}

function inferLandTypeFromRecord(record) {
    if (!record) return null;

    if (record.land && LAND_TYPES[record.land]) {
        return record.land;
    }

    const label = typeof record.label === 'string' ? record.label : '';
    const matchedByLabel = Object.entries(LAND_TYPES).find(([, land]) =>
        label.includes(land.emoji) || label.includes(land.name)
    );
    if (matchedByLabel) {
        return matchedByLabel[0];
    }

    if (record.plant && Number(record.totalSeconds) > 0 && PLANTS_DATABASE[record.plant]) {
        const matchedByDuration = Object.keys(LAND_TYPES).filter(landType => {
            const expectedSeconds = Math.round(calcGrowTime(record.plant, landType) * 3600);
            return Math.abs(expectedSeconds - Number(record.totalSeconds)) <= 60;
        });

        if (matchedByDuration.length === 1) {
            return matchedByDuration[0];
        }
    }

    return null;
}

function normalizeAlertRecord(record) {
    if (!record || typeof record !== 'object') return record;

    const inferredLand = inferLandTypeFromRecord(record);
    return inferredLand ? { ...record, land: inferredLand } : { ...record };
}

function archiveAlertToHistory(alert, triggeredAt = null) {
    if (!alert?.id) return false;

    const inferredLand = inferLandTypeFromRecord(alert);
    const historyItem = {
        id: alert.id,
        label: alert.label,
        plant: alert.plant,
        endTime: alert.endTime,
        totalSeconds: alert.totalSeconds,
        triggeredAt: triggeredAt || alert.triggeredAt || alert.endTime || new Date().toISOString(),
        pushNotified: Boolean(alert.pushNotified),
        pushNotifiedAt: alert.pushNotifiedAt || null,
        ...(inferredLand ? { land: inferredLand } : {})
    };

    const existingIndex = state.history.findIndex(item => item.id === historyItem.id);
    if (existingIndex >= 0) {
        state.history[existingIndex] = {
            ...state.history[existingIndex],
            ...historyItem,
            triggeredAt: state.history[existingIndex].triggeredAt || historyItem.triggeredAt
        };
        state.history = sortHistoryItems(state.history).slice(-200);
        return false;
    }

    state.history.push(historyItem);
    state.history = sortHistoryItems(state.history).slice(-200);
    return true;
}

function markHistoryPushNotified(id, notifiedAt = new Date().toISOString()) {
    const historyItem = state.history.find(item => item.id === id);
    if (!historyItem) return false;
    historyItem.pushNotified = true;
    historyItem.pushNotifiedAt = notifiedAt;
    return true;
}

function cleanupExpiredAlerts(options = {}) {
    const now = Date.now();
    const beforeCount = state.alerts.length;
    let historyChanged = false;

    state.alerts = state.alerts.filter(alert => {
        if (state.timers[alert.id]) return true; // 还在运行中

        const endTime = new Date(alert.endTime).getTime();
        if (Number.isFinite(endTime) && endTime <= now) {
            historyChanged = archiveAlertToHistory(alert, alert.endTime) || historyChanged;
            return false;
        }

        return true;
    });

    const alertsChanged = state.alerts.length !== beforeCount;
    if (alertsChanged || historyChanged) {
        if (options.save !== false) saveState();
        if (options.render !== false) renderAlertsList();
    }

    return alertsChanged || historyChanged;
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
            state.alerts = Array.isArray(data.alerts) ? data.alerts.map(normalizeAlertRecord) : [];
            state.history = Array.isArray(data.history) ? data.history.map(normalizeAlertRecord) : [];
            state.history = sortHistoryItems(state.history).slice(-200);
            state.settings = { ...state.settings, ...data.settings };

            const recoveredExpiredAlerts = cleanupExpiredAlerts({ save: false, render: false });
            
            // 恢复未过期的闹钟为定时器
            state.alerts.forEach(alert => {
                if (alert.endTime && new Date(alert.endTime) > new Date()) {
                    state.timers[alert.id] = alert;
                }
            });

            if (recoveredExpiredAlerts) {
                saveState();
            }
            
            // 恢复设置UI
            refreshSettingsForm();
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
    requestAnimationFrame(updateStickyOffsets);
}

// ========== 滚轮时间选择器 ==========
let wheelValues = { hour: 0, minute: 0 };

function initScrollWheels() {
    // 鼠标滚轮支持
    ['hour', 'minute'].forEach(type => {
        const input = document.getElementById(`${type}-input`);
        if (!input) return;

        // 鼠标滚轮事件
        input.addEventListener('wheel', (e) => {
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

        const upBtn = input.parentElement.querySelector('.up');
        const downBtn = input.parentElement.querySelector('.down');

        upBtn.addEventListener('mousedown', () => startPress(1));
        upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(1); });
        downBtn.addEventListener('mousedown', () => startPress(-1));
        downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(-1); });

        document.addEventListener('mouseup', endPress);
        document.addEventListener('touchend', endPress);
    });
}

function handleWheelInput(type, value) {
    const max = { hour: 72, minute: 59 };
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(max[type], numValue));
    wheelValues[type] = clampedValue;
    updateWheelDisplay(type, clampedValue);
}

function handleWheelBlur(type, value) {
    const max = { hour: 72, minute: 59 };
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(max[type], numValue));
    wheelValues[type] = clampedValue;
    updateWheelDisplay(type, clampedValue);
}

function handleWheelKeydown(event, type) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
        startTimer();
    }
}

function updateWheelDisplay(type, value) {
    const input = document.getElementById(`${type}-input`);
    if (!input) return;

    input.value = value;
    input.style.transform = 'scale(1.1)';
    input.style.color = '#4CAF50';
    setTimeout(() => {
        input.style.transform = 'scale(1)';
        input.style.color = '';
    }, 150);
}

function wheelAdjust(type, delta) {
    const max = { hour: 72, minute: 59 };
    const step = 1;

    wheelValues[type] += delta * step;
    if (wheelValues[type] < 0) wheelValues[type] = max[type];
    if (wheelValues[type] > max[type]) wheelValues[type] = 0;

    updateWheelDisplay(type, wheelValues[type]);
}

function setQuickTime(seconds) {
    const totalMinutes = Math.max(0, Math.ceil(seconds / 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    wheelValues.hour = h;
    wheelValues.minute = m;

    updateWheelDisplay('hour', h);
    updateWheelDisplay('minute', m);

    // 视觉反馈
    document.querySelectorAll('.wheel-input').forEach(el => {
        el.style.transform = 'scale(1.15)';
        el.style.color = '#4CAF50';
        setTimeout(() => {
            el.style.transform = 'scale(1)';
            el.style.color = '';
        }, 300);
    });
}

function getTotalSeconds() {
    return wheelValues.hour * 3600 + wheelValues.minute * 60;
}

// ========== 语音控制 ==========
let voiceSession = {
    hasResult: false,
    finalHandled: false,
    lastTranscript: '',
    stopReason: 'idle',
    autoStopTimer: null
};

function getVoiceElements() {
    return {
        btn: document.getElementById('voice-btn'),
        title: document.getElementById('voice-btn-title'),
        subtitle: document.getElementById('voice-btn-subtitle'),
        hint: document.getElementById('voice-hint'),
        result: document.getElementById('voice-result')
    };
}

function resetVoiceSession() {
    clearVoiceAutoStop();
    voiceSession = {
        hasResult: false,
        finalHandled: false,
        lastTranscript: '',
        stopReason: 'listening',
        autoStopTimer: null
    };
}

function clearVoiceAutoStop() {
    if (voiceSession.autoStopTimer) {
        clearTimeout(voiceSession.autoStopTimer);
        voiceSession.autoStopTimer = null;
    }
}

function scheduleVoiceAutoStop() {
    clearVoiceAutoStop();
    voiceSession.autoStopTimer = setTimeout(() => {
        if (!state.voiceActive || !state.recognition) return;
        voiceSession.stopReason = voiceSession.hasResult ? 'timeout_after_result' : 'timeout_empty';
        state.recognition.stop();
    }, 8000);
}

function setVoiceResult(message = '', type = 'info') {
    const { result } = getVoiceElements();
    if (!result) return;

    if (!message) {
        result.textContent = '';
        result.className = 'voice-result is-empty';
        return;
    }

    result.textContent = message;
    result.className = `voice-result ${type}`;
}

function mapVoiceError(error) {
    const errorMap = {
        'not-allowed': '麦克风权限被拒绝了，请先允许浏览器使用麦克风。',
        'service-not-allowed': '当前浏览器禁止了语音识别服务，请换 Chrome / Edge 再试。',
        'no-speech': '没有听到有效语音，请靠近麦克风后再试。',
        'audio-capture': '没有检测到可用麦克风设备。',
        'network': '语音识别服务连接失败，请检查网络后重试。',
        'aborted': '语音识别已中断，请再试一次。'
    };

    return errorMap[error] || '语音识别失败了，请稍后重试。';
}

function parseChineseNumber(text) {
    if (!text) return NaN;
    if (/^\d+(?:\.\d+)?$/.test(text)) return parseFloat(text);
    if (text === '半') return 0.5;

    const digitMap = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const unitMap = { 十: 10, 百: 100 };
    let result = 0;
    let current = 0;

    for (const char of text) {
        if (digitMap[char] !== undefined) {
            current = digitMap[char];
        } else if (unitMap[char]) {
            const unit = unitMap[char];
            if (current === 0) current = 1;
            result += current * unit;
            current = 0;
        } else {
            return NaN;
        }
    }

    return result + current;
}

function normalizeVoiceInput(rawText) {
    let text = (rawText || '').replace(/[，。、“”！？,.!?]/g, ' ').replace(/\s+/g, ' ').trim();

    text = text
        .replace(/([零一二两三四五六七八九十百\d]+)个半小时/g, (_, num) => `${parseChineseNumber(num) + 0.5}小时`)
        .replace(/半个小时|半小时/g, '30分钟')
        .replace(/一刻钟/g, '15分钟')
        .replace(/两刻钟/g, '30分钟')
        .replace(/三刻钟/g, '45分钟');

    return text.replace(/([零一二两三四五六七八九十百半\d]+)(?=(个)?(小时|分钟|分|秒))/g, match => {
        const parsed = parseChineseNumber(match);
        return Number.isNaN(parsed) ? match : String(parsed);
    });
}

function initVoice() {
    const { btn, hint } = getVoiceElements();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('unsupported');
        }
        if (hint) {
            hint.textContent = '当前浏览器不支持语音识别，请使用 Chrome / Edge。';
        }
        setVoiceResult('语音输入当前不可用。你仍可使用上方滚轮或快捷按钮设置时间。', 'muted');
        return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.lang = 'zh-CN';
    state.recognition.continuous = false;
    state.recognition.interimResults = true;
    state.recognition.maxAlternatives = 1;

    state.recognition.onstart = () => {
        state.voiceActive = true;
        voiceSession.stopReason = 'listening';
        updateVoiceUI();
        setVoiceResult('正在听，请直接说“30分钟”“2小时10分”或植物名。', 'info');
        scheduleVoiceAutoStop();
    };

    state.recognition.onresult = (event) => {
        scheduleVoiceAutoStop();
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }

        const cleanedTranscript = transcript.trim();
        if (!cleanedTranscript) return;

        voiceSession.hasResult = true;
        voiceSession.lastTranscript = cleanedTranscript;

        const isFinal = event.results[event.results.length - 1].isFinal;
        setVoiceResult(`识别到：${cleanedTranscript}${isFinal ? '' : '…'}`, isFinal ? 'success' : 'info');

        if (isFinal) {
            const parsed = parseVoiceCommand(cleanedTranscript);
            voiceSession.finalHandled = parsed;
            voiceSession.stopReason = parsed ? 'success' : 'no_match';
        }
    };

    state.recognition.onerror = (event) => {
        clearVoiceAutoStop();
        voiceSession.stopReason = 'error';
        const message = mapVoiceError(event.error);
        console.error('语音识别错误:', event.error);
        setVoiceResult(message, 'error');
        showToast(message);
    };

    state.recognition.onend = () => {
        clearVoiceAutoStop();
        const reason = voiceSession.stopReason;
        const hadResult = voiceSession.hasResult;
        state.voiceActive = false;
        updateVoiceUI();

        if (reason === 'error' || reason === 'success' || reason === 'no_match') {
            return;
        }

        if (!hadResult) {
            const emptyMessage = reason === 'manual-stop'
                ? '已停止聆听，尚未识别到内容。'
                : '这次没有听清，请靠近麦克风并直接说“30分钟后提醒我”或植物名。';
            setVoiceResult(emptyMessage, reason === 'manual-stop' ? 'muted' : 'error');
            if (reason !== 'manual-stop') showToast('没有识别到有效语音内容');
            return;
        }

        if (!voiceSession.finalHandled) {
            setVoiceResult(`已捕获语音：${voiceSession.lastTranscript}，但还没听懂具体时间。可再说得更直接一些。`, 'error');
        }
    };

    updateVoiceUI();
}

function toggleVoice() {
    if (!state.recognition) {
        showToast('当前浏览器不支持语音识别，请使用 Chrome / Edge');
        return;
    }

    if (state.voiceActive) {
        voiceSession.stopReason = 'manual-stop';
        clearVoiceAutoStop();
        state.recognition.stop();
        return;
    }

    try {
        resetVoiceSession();
        setVoiceResult('', 'info');
        state.recognition.start();
    } catch (error) {
        console.error('语音识别启动失败:', error);
        setVoiceResult('语音识别启动失败，请稍后重试。', 'error');
        showToast('语音识别启动失败，请重试');
    }
}

function updateVoiceUI() {
    const { btn, title, subtitle, hint } = getVoiceElements();
    if (!btn) return;

    btn.classList.toggle('listening', !!state.voiceActive);
    btn.classList.toggle('unsupported', !state.recognition);

    if (!state.recognition) {
        if (title) title.textContent = '语音输入不可用';
        if (subtitle) subtitle.textContent = '请改用 Chrome / Edge';
        if (hint) hint.textContent = '当前浏览器不支持语音识别，请使用 Chrome / Edge。';
        return;
    }

    if (state.voiceActive) {
        if (title) title.textContent = '正在聆听';
        if (subtitle) subtitle.textContent = '再点一次可停止';
        if (hint) hint.textContent = '请直接说完整指令，例如“30分钟后提醒我”或某个植物名。';
    } else {
        if (title) title.textContent = '语音输入';
        if (subtitle) subtitle.textContent = '点一下说时间';
        if (hint) hint.textContent = 'Chrome / Edge，可说“30分钟”或植物名。';
    }
}

function parseVoiceCommand(text) {
    const normalizedText = normalizeVoiceInput(text).replace(/\s/g, '');

    let totalSeconds = 0;
    let plantName = '';
    let plantGrowHours = 0;

    const hourMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*小时/);
    const minMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*分[钟]?/);
    const secMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*秒/);

    if (hourMatch) totalSeconds += Math.round(parseFloat(hourMatch[1]) * 3600);
    if (minMatch) totalSeconds += Math.round(parseFloat(minMatch[1]) * 60);
    if (secMatch) totalSeconds += Math.round(parseFloat(secMatch[1]));

    if (totalSeconds === 0) {
        const plantNames = Object.keys(PLANTS_DATABASE);
        const landType = state.selectedLand || 'normal';
        for (const name of plantNames) {
            if (normalizedText.includes(name)) {
                plantName = name;
                plantGrowHours = calcGrowTime(name, landType) || PLANTS_DATABASE[name].growthTime || 0;
                totalSeconds = Math.round(plantGrowHours * 3600);
                break;
            }
        }
    }

    if (totalSeconds <= 0) {
        const failMessage = '没听懂这句指令。请直接说“30分钟后提醒我”“1小时半”或植物名。';
        setVoiceResult(failMessage, 'error');
        showToast('没听懂语音内容，请换种说法');
        return false;
    }

    setQuickTime(totalSeconds);
    const appliedSeconds = getTotalSeconds();
    const durationText = formatDuration(appliedSeconds) || `${appliedSeconds}秒`;

    if (plantName) {
        const successMessage = `已识别植物：${plantName}。已按当前土地填入 ${durationText}，现在可以直接点击“开始计时”。`;
        setVoiceResult(successMessage, 'success');
        showToast(`🎤 已识别：${plantName}，${plantGrowHours}小时后提醒`);
        return true;
    }

    const successMessage = `已识别时间：${durationText}。时间已经填入上方，点“开始计时”就会生效。`;
    setVoiceResult(successMessage, 'success');
    showToast(`🎤 已设置：${durationText}`);
    return true;
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

function startPlantTimer(plantName, preferredLandType = null) {
    const plant = PLANTS_DATABASE[plantName];
    if (!plant) {
        showToast('未找到该植物信息');
        return;
    }
    
    const landType = preferredLandType && LAND_TYPES[preferredLandType]
        ? preferredLandType
        : (state.selectedLand || 'normal');
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
    renderAlertsList();
}

// ========== 定时器循环检查 ==========
function startTimerLoop() {
    setInterval(() => {
        const now = Date.now();
        Object.keys(state.timers).forEach(id => {
            const timer = state.timers[id];
            if (timer && new Date(timer.endTime) <= new Date(now)) {
                triggerAlarm(timer);
            }
        });
    }, 1000);
}

// ========== 闹钟触发 ==========
let triggeredAlarmIds = new Set();
const ALARM_NOTIFICATION_ICON = './icons/icon-192-v2.png';
const ALARM_NOTIFICATION_BADGE = './icons/icon-32-v2.png';
let alarmDeliveryToastCache = new Set();

function showAlarmDeliveryToastOnce(key, message) {
    if (alarmDeliveryToastCache.has(key)) return;
    alarmDeliveryToastCache.add(key);
    showToast(message);
}

function buildAlarmNotificationOptions(timer, message) {
    return {
        body: message,
        icon: ALARM_NOTIFICATION_ICON,
        badge: ALARM_NOTIFICATION_BADGE,
        requireInteraction: true,
        renotify: true,
        tag: `farm-alarm-${timer?.id || Date.now()}`,
        data: {
            alarmId: timer?.id || null,
            url: `${window.location.origin}${window.location.pathname}?source=pwa`
        }
    };
}

async function sendBrowserAlarmNotification(timer, message) {
    console.log('[通知] 开始发送浏览器通知', {
        notifyPush: state.settings.notifyPush,
        permission: Notification?.permission,
        hasNotification: 'Notification' in window,
        timerId: timer?.id,
        message
    });

    if (!state.settings.notifyPush) {
        console.log('[通知] 用户已关闭浏览器通知开关');
        return { ok: false, skipped: true, reason: 'disabled' };
    }

    if (!('Notification' in window)) {
        console.error('[通知] 当前浏览器不支持系统通知');
        return { ok: false, reason: 'unsupported', message: '当前浏览器不支持系统通知' };
    }

    console.log('[通知] 当前通知权限:', Notification.permission);

    if (Notification.permission !== 'granted') {
        console.warn('[通知] 通知权限未授权:', Notification.permission);
        return {
            ok: false,
            reason: Notification.permission,
            message: Notification.permission === 'denied'
                ? '浏览器通知权限被拦截了'
                : '浏览器通知权限还没开启'
        };
    }

    const options = buildAlarmNotificationOptions(timer, message);
    console.log('[通知] 通知选项配置:', options);

    try {
        console.log('[通知] 尝试获取 Service Worker 注册...');
        const registration = await navigator.serviceWorker?.getRegistration?.();
        console.log('[通知] Service Worker 注册状态:', {
            hasRegistration: !!registration,
            hasShowNotification: !!registration?.showNotification,
            active: registration?.active?.state,
            state: registration?.state
        });

        if (registration?.showNotification) {
            console.log('[通知] 使用 Service Worker 发送通知');
            await registration.showNotification('🌾 农场收菜提醒', options);
            console.log('[通知] Service Worker 通知发送成功');
            return { ok: true, channel: 'service-worker' };
        } else {
            console.log('[通知] Service Worker 不可用，准备使用页面通知');
        }
    } catch (error) {
        console.warn('[通知] Service Worker 通知发送失败，尝试回退到页面通知:', error);
    }

    try {
        console.log('[通知] 使用页面 Notification API 发送通知');
        const notification = new Notification('🌾 农场收菜提醒', options);
        notification.onclick = () => {
            console.log('[通知] 用户点击了通知');
            window.focus();
            notification.close();
            dismissAlarm();
        };
        console.log('[通知] 页面通知创建成功');
        return { ok: true, channel: 'window' };
    } catch (error) {
        console.error('[通知] 页面通知发送失败:', error);
        return { ok: false, reason: 'constructor-failed', message: error?.message || '创建通知失败' };
    }
}

async function sendAlarmWechatNotification(timer, message, triggeredAt) {
    if (state.settings.notifyWeChat === false) {
        return { ok: false, skipped: true, reason: 'disabled' };
    }

    if (typeof CloudSync?.sendAlarmPush !== 'function') {
        return { ok: false, reason: 'unavailable', message: '微信推送模块未加载' };
    }

    const result = await CloudSync.sendAlarmPush(timer, { message, triggeredAt });
    if (result.ok && markHistoryPushNotified(timer.id, result.notifiedAt || new Date().toISOString())) {
        saveState();
    }
    return result;
}

function triggerAlarm(timer) {
    // 防重入：同一个闹钟只触发一次
    if (triggeredAlarmIds.has(timer.id)) return;
    triggeredAlarmIds.add(timer.id);

    const triggeredAt = new Date().toISOString();
    const message = timer.plant
        ? `${PLANTS_DATABASE[timer.plant]?.emoji || '🌱'} ${timer.plant || '植物'}成熟了！快去收菜！`
        : `⏰ 定时结束！${timer.label}`;

    // 写入历史记录并从当前闹钟中移除
    archiveAlertToHistory(timer, triggeredAt);
    delete state.timers[timer.id];
    state.alerts = state.alerts.filter(alert => alert.id !== timer.id);
    saveState();
    renderRunningTimers();
    renderAlertsList();

    // 显示弹窗
    document.getElementById('alarm-message').textContent = message;
    document.getElementById('alarm-overlay').style.display = 'flex';

    // 播放声音
    if (state.settings.notifySound) {
        playAlarmSound();
    }

    sendBrowserAlarmNotification(timer, message).then(result => {
        if (result.ok || result.skipped) return;
        console.warn('浏览器通知未送达:', result.message || result.reason || result);
        showAlarmDeliveryToastOnce(
            `browser-${result.reason || 'failed'}`,
            `⚠️ 页面内闹钟已响，但系统通知未送达：${result.message || '请检查通知权限'}`
        );
    }).catch(error => {
        console.warn('浏览器通知补发失败:', error);
        showAlarmDeliveryToastOnce('browser-error', '⚠️ 页面内闹钟已响，但系统通知发送失败');
    });

    // 微信推送：页面在线时直接补发，后台定时任务继续做兜底
    sendAlarmWechatNotification(timer, message, triggeredAt).then(result => {
        if (result.ok || result.skipped) return;
        console.warn('微信推送补发失败:', result.message || result);
        showAlarmDeliveryToastOnce(
            `wechat-${result.reason || 'failed'}`,
            `⚠️ 页面内闹钟已响，但微信消息未立即送达：${result.message || '后台会继续尝试补发'}`
        );
    }).catch(error => {
        console.warn('微信推送补发失败:', error);
        showAlarmDeliveryToastOnce('wechat-error', '⚠️ 页面内闹钟已响，但微信消息补发失败，后台会继续尝试');
    });

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

// ========== 植物排序工具 ==========
const SPECIAL_PLANT_LAST_ORDER = ['新春红包', '哈哈南瓜', '爱心果', '蔷薇', '蝴蝶兰'];
const SHOP_PLANT_ORDER = [
    '白萝卜', '胡萝卜', '大白菜', '大蒜',
    '大葱', '水稻', '小麦', '玉米',
    '鲜姜', '土豆', '小白菜', '生菜',
    '油菜', '茄子', '红枣', '蒲公英',
    '银莲花', '番茄', '花菜', '韭菜',
    '小雏菊', '豌豆', '莲藕', '红玫瑰',
    '秋菊（黄色）', '满天星', '含羞草', '牵牛花',
    '秋菊（红色）', '辣椒', '黄瓜', '芹菜',
    '天香百合', '南瓜', '核桃', '山楂',
    '菠菜', '草莓', '苹果', '四叶草',
    '非洲菊', '火绒草', '花香根鸢尾', '虞美人',
    '向日葵', '西瓜', '黄豆', '香蕉',
    '竹笋', '桃子', '甘蔗', '橙子',
    '茉莉花', '葡萄', '丝瓜', '榛子',
    '迎春花', '石榴', '栗子', '柚子',
    '蘑菇', '菠萝', '箬竹', '无花果',
    '椰子', '花生', '金针菇', '葫芦',
    '猕猴桃', '梨', '爱心果', '睡莲',
    '火龙果', '枇杷', '樱桃', '李子',
    '荔枝', '香瓜', '木瓜', '桂圆',
    '月柿', '杨桃', '蔷薇', '蝴蝶兰',
    '哈密瓜', '桑葚', '柠檬', '芒果',
    '杨梅', '榴莲', '番石榴', '瓶子树',
    '蓝莓', '猪笼草', '山竹', '曼陀罗华', '曼珠沙华',
    '苦瓜', '天堂鸟', '冬瓜', '豹皮花',
    '杏子', '金桔'
];

function comparePlantsForUI(a, b) {
    const specialA = SPECIAL_PLANT_LAST_ORDER.indexOf(a.name);
    const specialB = SPECIAL_PLANT_LAST_ORDER.indexOf(b.name);
    const aIsSpecial = specialA !== -1;
    const bIsSpecial = specialB !== -1;

    if (aIsSpecial && !bIsSpecial) return 1;
    if (!aIsSpecial && bIsSpecial) return -1;
    if (aIsSpecial && bIsSpecial) return specialA - specialB;

    const shopA = SHOP_PLANT_ORDER.indexOf(a.name);
    const shopB = SHOP_PLANT_ORDER.indexOf(b.name);
    const aInShop = shopA !== -1;
    const bInShop = shopB !== -1;

    if (aInShop && bInShop) return shopA - shopB;
    if (aInShop && !bInShop) return -1;
    if (!aInShop && bInShop) return 1;

    if ((a.level || 0) !== (b.level || 0)) return (a.level || 0) - (b.level || 0);

    return (a.name || '').localeCompare(b.name || '', 'zh-CN');
}

function getOrderedPlantNames() {
    return Object.keys(PLANTS_DATABASE).sort((a, b) => comparePlantsForUI(PLANTS_DATABASE[a], PLANTS_DATABASE[b]));
}

// ========== 植物网格 ==========
function renderPlantGrid(filter = '') {
    const grid = document.getElementById('plant-grid');
    const landType = state.selectedLand;
    const plants = filter ? searchPlants(filter, landType) : Object.values(PLANTS_DATABASE).filter(p => canPlantOnLand(p, landType));
    
    // 按界面展示顺序排序：常规作物按等级，特殊品种置底
    plants.sort(comparePlantsForUI);
    
    grid.innerHTML = plants.map(plant => {
        const growTime = calcGrowTime(plant.name, landType);
        const totalTime = calcTotalGrowTime(plant.name, landType);
        const seasonsInfo = plant.seasons > 1
            ? `${plant.seasons}季·总${totalTime}h`
            : '单季';
        const seasonsClass = plant.seasons > 1 ? 'plant-seasons' : 'plant-seasons is-placeholder';
        
        return `
        <div class="plant-card" onclick="startPlantTimer('${plant.name}')">
            <div class="plant-emoji">${plant.emoji}</div>
            <div class="plant-name">${plant.name}</div>
            <div class="plant-time">${growTime}小时${plant.seasons > 1 ? '(首季)' : ''}</div>
            <span class="${seasonsClass}">${seasonsInfo}</span>
            <div class="plant-level">Lv.${plant.level}</div>
            <div class="plant-profit">
                <span class="coin">💰${plant.sellPrice}</span>
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
    const seasons = parseInt(document.getElementById('custom-seasons').value) || 1;
    
    if (!name) {
        showToast('请输入植物名称');
        return;
    }
    if (hours <= 0 && minutes <= 0) {
        showToast('请输入成熟时间');
        return;
    }
    
    // 计算首季成熟时间（小时）
    const firstTimeHours = Math.round((hours + minutes / 60) * 10) / 10;
    
    // 添加到植物数据库
    const plant = addPlantToDatabase(name, firstTimeHours, seasons);
    if (!plant) return;
    
    // 清空输入
    document.getElementById('custom-plant-name').value = '';
    document.getElementById('custom-hours').value = '';
    document.getElementById('custom-minutes').value = '';
    document.getElementById('custom-seasons').value = 1;
    updateSeasonHint();
    
    // 重新渲染
    renderPlantGrid(document.getElementById('plant-search-input').value);
    renderCustomPlantsList();
    
    const reTimeStr = seasons > 1 ? `，再熟${plant.reTime}h` : '';
    showToast(`🌱 "${name}" 已添加到植物库（${seasons}季 · 首季${firstTimeHours}h${reTimeStr}）`);
}

// ========== 自定义植物列表 ==========
function renderCustomPlantsList() {
    const container = document.getElementById('custom-plants-container');
    const wrapper = document.getElementById('custom-plants-list');
    if (!container || !wrapper) return;
    
    const customPlants = Object.values(PLANTS_DATABASE).filter(p => p.isCustom);
    
    if (customPlants.length === 0) {
        wrapper.style.display = 'none';
        return;
    }
    
    wrapper.style.display = 'block';
    container.innerHTML = customPlants.map(p => {
        const reTimeStr = p.seasons > 1 ? ` · 再熟${p.reTime}h` : '';
        return `
            <div class="custom-plant-item">
                <div class="custom-plant-info">
                    <span class="custom-plant-name">${p.emoji} ${p.name}</span>
                    <span class="custom-plant-detail">${p.seasons}季 · 首季${p.firstTime}h${reTimeStr}</span>
                </div>
                <div class="custom-plant-actions">
                    <button class="small-btn" onclick="startPlantTimer('${p.name}')">种植</button>
                    <button class="remove-entry" onclick="deleteCustomPlant('${p.name}')" title="删除">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteCustomPlant(name) {
    if (!confirm(`确定要删除自定义植物 "${name}" 吗？`)) return;
    removePlantFromDatabase(name);
    renderPlantGrid(document.getElementById('plant-search-input').value);
    renderCustomPlantsList();
    showToast(`🗑️ "${name}" 已从植物库删除`);
}

// ========== 季数输入提示 ==========
function initSeasonHint() {
    const hoursInput = document.getElementById('custom-hours');
    const minutesInput = document.getElementById('custom-minutes');
    const seasonsInput = document.getElementById('custom-seasons');
    
    if (hoursInput) hoursInput.addEventListener('input', updateSeasonHint);
    if (minutesInput) minutesInput.addEventListener('input', updateSeasonHint);
    if (seasonsInput) seasonsInput.addEventListener('input', updateSeasonHint);
    
    updateSeasonHint();
}

function updateSeasonHint() {
    const hintEl = document.getElementById('season-time-hint');
    if (!hintEl) return;
    
    const hours = parseInt(document.getElementById('custom-hours').value) || 0;
    const minutes = parseInt(document.getElementById('custom-minutes').value) || 0;
    const seasons = parseInt(document.getElementById('custom-seasons').value) || 1;
    
    if (hours <= 0 && minutes <= 0 || seasons <= 1) {
        hintEl.textContent = '';
        return;
    }
    
    const firstTime = hours + minutes / 60;
    const reTime = Math.round(firstTime / 2 * 10) / 10;
    const total = Math.round((firstTime + reTime * (seasons - 1)) * 10) / 10;
    
    hintEl.textContent = `再熟${reTime}h · 总计${total}h`;
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
    const sleepHourPart = Math.floor(sleepDuration / 60);
    const sleepMinutePart = sleepDuration % 60;
    const availablePlots = plotCount - existingPlots;
    const landType = state.selectedLand || 'normal';
    const land = LAND_TYPES[landType] || LAND_TYPES.normal;
    
    if (availablePlots <= 0) {
        showToast('所有地块已有作物，无需再种植！');
        return;
    }
    
    // 生成基于当前土地的作物视图：成熟时间受地块加速影响，收益受增产影响
    const plants = Object.values(PLANTS_DATABASE)
        .filter(p => canPlantOnLand(p, landType))
        .map(p => ({
            ...p,
            growthTime: calcGrowTime(p.name, landType),
            totalGrowthTime: calcTotalGrowTime(p.name, landType),
            sellPrice: Math.round(p.sellPrice * (1 + land.yieldBonus))
        }));
    
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
    
    const recommendations = generateRecommendations(plants, sleepHours);
    
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
                <span class="stat-value">${sleepHourPart}时${sleepMinutePart}分</span>
            </div>
            <div class="plan-stat">
                <span class="stat-label">🏠 当前土地</span>
                <span class="stat-value">${land.emoji} ${land.name}</span>
            </div>
            <div class="plan-stat">
                <span class="stat-label">🌾 空闲地块</span>
                <span class="stat-value">${availablePlots}块</span>
            </div>
        </div>
        
        ${bestSingle ? `
        <div class="plan-section">
            <h3>🎯 最佳单次种植推荐</h3>
            <p class="plan-desc">按当前土地速度计算，尽量让你睡醒就能收菜</p>
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
            <p class="plan-desc">已把当前土地增产效果计入收益</p>
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
                    harvestTime.setHours(sleepH, sleepM + Math.round(bestMulti.plant.growthTime * 60 * (i + 1)));
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
                        <div class="rec-rank">${idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</div>
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
                best = { plant, diffHours: targetHours - plant.growthTime };
            } else if (diff === minDiff && best && plant.sellPrice > best.plant.sellPrice) {
                // 同样接近的情况下选收益高的
                best = { plant, diffHours: targetHours - plant.growthTime };
            }
        }
    });
    
    // 如果没有合适的，就选最接近的（可能会超时）
    if (!best) {
        plants.forEach(plant => {
            const diff = Math.abs(plant.growthTime - targetHours);
            if (diff < minDiff) {
                minDiff = diff;
                best = { plant, diffHours: plant.growthTime - targetHours };
            }
        });
    }
    
    return best;
}

function generateRecommendations(plants, sleepHours) {
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
function formatAlarmDateTime(dateStr) {
    return new Date(dateStr).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatAlarmTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getAlarmFeedItems() {
    const activeItems = state.alerts
        .filter(alert => state.timers[alert.id])
        .map(alert => ({
            type: 'active',
            sortTime: new Date(alert.endTime).getTime(),
            data: alert
        }));

    const historyItems = state.history
        .map(item => ({
            type: 'history',
            sortTime: new Date(item.triggeredAt || item.endTime).getTime(),
            data: item
        }))
        .sort((a, b) => b.sortTime - a.sortTime)
        .slice(0, 3); // 只显示最近3条历史记录

    return [...activeItems, ...historyItems].sort((a, b) => b.sortTime - a.sortTime);
}

function renderAlarmFeed() {
    const list = document.getElementById('alerts-list');
    const countEl = document.getElementById('history-count');
    const clearWrap = document.getElementById('history-clear-wrap');
    if (!list) return;

    const feedItems = getAlarmFeedItems();

    if (countEl) countEl.textContent = `${feedItems.length}条`;
    if (clearWrap) clearWrap.style.display = state.history.length > 0 ? 'block' : 'none';

    if (feedItems.length === 0) {
        list.innerHTML = '<p class="empty-text">暂无闹钟记录，去设置一个吧！</p>';
        return;
    }

    list.innerHTML = feedItems.map(item => {
        if (item.type === 'active') {
            const alert = item.data;
            const endTime = new Date(alert.endTime);
            const remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
            const h = Math.floor(remainingSeconds / 3600);
            const m = Math.floor((remainingSeconds % 3600) / 60);
            const s = remainingSeconds % 60;
            const createdAt = alert.createdAt ? new Date(alert.createdAt) : null;
            const derivedTotalSeconds = createdAt && !Number.isNaN(createdAt.getTime())
                ? Math.max(1, Math.floor((endTime.getTime() - createdAt.getTime()) / 1000))
                : 0;
            const totalSeconds = Number(alert.totalSeconds) > 0 ? Number(alert.totalSeconds) : derivedTotalSeconds;
            const progress = totalSeconds > 0
                ? Math.min(1, Math.max(0, 1 - (remainingSeconds / totalSeconds)))
                : 0;

            return `
                <div class="alert-item active timer-feed-item">
                    <div class="timer-item active-timer-card">
                        <div class="timer-item-top">
                            <span class="timer-status-pill">🟢 生效中</span>
                            <button class="cancel-btn" onclick="cancelTimer('${alert.id}')">取消</button>
                        </div>
                        <div class="timer-info">
                            <span class="timer-label">${alert.label}</span>
                            <span class="timer-remaining">${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${progress * 100}%"></div>
                        </div>
                        <div class="timer-end-time">🕐 ${formatAlarmTime(alert.endTime)} 到期</div>
                    </div>
                </div>
            `;
        }

        const history = item.data;
        const plant = history.plant ? PLANTS_DATABASE[history.plant] : null;
        const emoji = plant?.emoji || '⏰';
        const duration = formatDuration(history.totalSeconds);

        return `
            <div class="alert-item history" onclick="restartFromHistory('${history.id}')">
                <div class="alert-status">${emoji}</div>
                <div class="alert-info">
                    <div class="alert-label">${history.label}</div>
                    <div class="alert-time">已触发 · ${formatAlarmDateTime(history.triggeredAt)} · ⏱️ ${duration || '—'}</div>
                </div>
                <button class="alert-restart" onclick="event.stopPropagation(); restartFromHistory('${history.id}')">🔄</button>
            </div>
        `;
    }).join('');
}

function renderAlertsList() {
    renderAlarmFeed();
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
    renderAlarmFeed();
    showToast('🔄 已重新启动定时器');
}

function clearAllAlerts() {
    if (!confirm('确定要清除所有闹钟吗？')) return;
    
    Object.keys(state.timers).forEach(id => delete state.timers[id]);
    state.alerts = [];
    saveState();
    renderRunningTimers();
    renderAlarmFeed();
    showToast('已清除所有闹钟');
}

// ========== 历史记录 ==========
function renderHistoryList() {
    renderAlarmFeed();
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

    const landType = inferLandTypeFromRecord(item);

    if (item.plant && PLANTS_DATABASE[item.plant]) {
        if (landType && landType !== state.selectedLand) {
            selectLand(landType);
        }
        startPlantTimer(item.plant, landType);
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
    const isOpening = modal.style.display === 'none';
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';

    if (isOpening) {
        updateNotificationStatus();
    }
}

function openSettingsPanel(options = {}) {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const { targetId = '', focusId = '' } = options;
    modal.style.display = 'flex';

    if (!targetId && !focusId) return;

    requestAnimationFrame(() => {
        const target = document.getElementById(targetId || focusId);
        const focusTarget = document.getElementById(focusId) || target;

        if (target) {
            target.classList.remove('anchor-highlight');
            void target.offsetWidth;
            target.classList.add('anchor-highlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => target.classList.remove('anchor-highlight'), 2400);
        }

        if (focusTarget && typeof focusTarget.focus === 'function') {
            focusTarget.focus({ preventScroll: true });
            if (typeof focusTarget.select === 'function') {
                focusTarget.select();
            }
        }
    });
}

function refreshSettingsForm() {
    setTimeout(() => {
        const volume = document.getElementById('volume-slider');
        const sound = document.getElementById('notify-sound');
        const vibrate = document.getElementById('notify-vibrate');
        const push = document.getElementById('notify-push');
        const wechat = document.getElementById('notify-wechat');
        const alarmSound = document.getElementById('alarm-sound-select');

        if (volume) volume.value = state.settings.volume;
        if (sound) sound.checked = state.settings.notifySound;
        if (vibrate) vibrate.checked = state.settings.notifyVibrate;
        if (push) push.checked = state.settings.notifyPush;
        if (wechat) wechat.checked = state.settings.notifyWeChat !== false;
        if (alarmSound) alarmSound.value = state.settings.alarmSound;
    }, 100);
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
    const inputIdMap = {
        notifySound: 'notify-sound',
        notifyVibrate: 'notify-vibrate',
        notifyPush: 'notify-push',
        notifyWeChat: 'notify-wechat'
    };
    const input = document.getElementById(inputIdMap[key] || key);
    if (!input) return;

    state.settings[key] = input.checked;
    saveState();

    if (key === 'notifyPush' && state.settings[key]) {
        requestNotificationPermission({ immediate: true, source: 'toggle' });
    }

    if (key === 'notifyWeChat' && state.settings[key] && !CloudSync?.sendKey) {
        showToast('⚠️ 已打开微信推送，但当前设备还没保存 SendKey；本机无法立即直发微信消息');
    }

    updateNotificationStatus();
}

function updateNotificationStatus() {
    const statusEl = document.getElementById('notification-status');
    if (!statusEl) return;

    const permission = getNotificationPermissionState();
    const swRegistration = navigator.serviceWorker?.getRegistration ? navigator.serviceWorker.getRegistration() : null;

    let statusText = '';
    let statusClass = '';

    if (!('Notification' in window)) {
        statusText = '❌ 浏览器不支持';
        statusClass = 'status-error';
    } else if (permission === 'denied') {
        statusText = '❌ 通知已被拦截';
        statusClass = 'status-error';
    } else if (permission === 'granted') {
        statusText = '✅ 通知已授权';
        statusClass = 'status-success';
    } else {
        statusText = '⏳ 未授权';
        statusClass = 'status-warning';
    }

    if (permission === 'granted') {
        swRegistration.then(reg => {
            if (reg && reg.active) {
                statusText += ' | Service Worker: ✅';
            } else if (reg) {
                statusText += ' | Service Worker: ⏳';
            } else {
                statusText += ' | Service Worker: ❌';
            }
        }).catch(() => {
            statusText += ' | Service Worker: ❌';
        });
    }

    statusEl.textContent = statusText;
    statusEl.className = 'sync-status ' + statusClass;
}

// ========== 通知权限 ==========
const NOTIFY_GUIDE_DISMISSED_KEY = 'farm-notify-guide-dismissed-v1';

function getNotificationPermissionState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

function rememberNotifyGuideDismissal() {
    localStorage.setItem(NOTIFY_GUIDE_DISMISSED_KEY, getNotificationPermissionState());
}

function clearNotifyGuideDismissal() {
    localStorage.removeItem(NOTIFY_GUIDE_DISMISSED_KEY);
}

async function requestNotificationPermission(options = {}) {
    const { immediate = false, source = 'auto' } = options;

    if (!('Notification' in window)) {
        if (source !== 'auto') showToast('当前浏览器不支持系统通知');
        return 'unsupported';
    }

    if (Notification.permission !== 'default') {
        if (Notification.permission === 'granted') {
            clearNotifyGuideDismissal();
        }
        return Notification.permission;
    }

    const ask = async () => {
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                clearNotifyGuideDismissal();
                if (source !== 'auto') {
                    showToast('🔔 通知已开启，到点会弹出系统提醒');
                }
            } else if (source !== 'auto') {
                showToast(result === 'denied' ? '通知被拦截了，可稍后手动开启' : '暂未开启通知');
            }
            return result;
        } catch (error) {
            console.warn('通知权限请求失败:', error);
            if (source !== 'auto') {
                showToast('❌ 通知权限请求失败');
            }
            return getNotificationPermissionState();
        }
    };

    if (immediate) {
        return ask();
    }

    setTimeout(() => {
        ask().catch(() => {});
    }, 3000);
    return 'default';
}

async function testBrowserNotification() {
    console.log('[测试] 开始测试浏览器通知');

    if (!('Notification' in window)) {
        showToast('❌ 当前浏览器不支持系统通知');
        return;
    }

    const permission = Notification.permission;
    console.log('[测试] 当前通知权限:', permission);

    if (permission === 'denied') {
        showToast('❌ 浏览器通知已被拦截，请在浏览器设置中允许通知');
        return;
    }

    if (permission === 'default') {
        showToast('正在请求通知权限...');
        const result = await requestNotificationPermission({ immediate: true, source: 'test' });
        if (result !== 'granted') {
            showToast('❌ 需要允许通知才能测试');
            return;
        }
    }

    try {
        const options = {
            body: '这是一条测试通知，如果看到这条消息，说明浏览器通知功能正常！',
            icon: ALARM_NOTIFICATION_ICON,
            badge: ALARM_NOTIFICATION_BADGE,
            requireInteraction: false,
            tag: 'test-notification-' + Date.now()
        };

        console.log('[测试] 通知选项:', options);

        let sentChannel = '';

        try {
            const registration = await navigator.serviceWorker?.getRegistration?.();
            console.log('[测试] Service Worker 状态:', {
                hasRegistration: !!registration,
                hasShowNotification: !!registration?.showNotification,
                active: registration?.active?.state
            });

            if (registration?.showNotification) {
                await registration.showNotification('🔔 通知测试', options);
                sentChannel = 'Service Worker';
                console.log('[测试] Service Worker 通知发送成功');
            } else {
                console.log('[测试] Service Worker 不可用，使用页面通知');
            }
        } catch (error) {
            console.warn('[测试] Service Worker 通知失败:', error);
        }

        if (!sentChannel) {
            const notification = new Notification('🔔 通知测试', options);
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            sentChannel = '页面通知';
            console.log('[测试] 页面通知创建成功');
        }

        showToast(`✅ 测试通知已发送（${sentChannel}），检查系统通知栏`);
    } catch (error) {
        console.error('[测试] 通知发送失败:', error);
        showToast('❌ 通知发送失败: ' + error.message);
    }
}

function closeNotificationGuide() {
    const overlay = document.getElementById('notify-guide-overlay');
    if (overlay) overlay.remove();
}

function shouldShowNotificationGuide() {
    const permission = getNotificationPermissionState();
    if (permission === 'granted' || permission === 'unsupported') {
        if (permission === 'granted') clearNotifyGuideDismissal();
        return false;
    }

    if (!isPwaInstalled()) return false;
    return localStorage.getItem(NOTIFY_GUIDE_DISMISSED_KEY) !== permission;
}

function maybeShowNotificationGuide(options = {}) {
    const { force = false, delay = 600 } = options;
    if (!force && !shouldShowNotificationGuide()) return;
    setTimeout(() => showNotificationGuideModal({ force }), delay);
}

function showNotificationGuideModal(options = {}) {
    const { force = false } = options;
    const permission = getNotificationPermissionState();
    if (permission === 'granted' || permission === 'unsupported') return;
    if (!force && !shouldShowNotificationGuide()) return;

    closeNotificationGuide();

    const isBlocked = permission === 'denied';
    const title = isBlocked ? '通知权限还没放开' : '再开一下通知就更稳了';
    const description = isBlocked
        ? '安装到桌面和允许通知是两件事。当前浏览器已经拦截了通知，需要你手动去右上角的网站设置里放开。'
        : '安装已经完成，但系统提醒还没完全打通。再开启一下通知权限，到点时才更容易弹出横幅提醒。';
    const note = isBlocked
        ? '如果你之前点过“阻止”，网页这边无法替你改回，只能去浏览器菜单或地址栏右侧的网站设置里手动改成“允许”。'
        : '不开通知也能继续用，但到点时主要就只能依赖页面内弹窗、声音或微信推送。';
    const steps = isBlocked
        ? `
            <ol class="notify-guide-steps">
                <li>点浏览器右上角的锁、铃铛或网站设置入口</li>
                <li>找到“通知”权限</li>
                <li>改成“允许”</li>
                <li>刷新页面或重新打开桌面版</li>
            </ol>
        `
        : `
            <ol class="notify-guide-steps">
                <li>点下方“开启通知”</li>
                <li>浏览器弹窗里选择“允许”</li>
                <li>之后到点时就更容易收到系统横幅提醒</li>
            </ol>
        `;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'notify-guide-overlay';
    overlay.innerHTML = `
        <div class="notify-guide-dialog">
            <div class="notify-guide-icon">🔔</div>
            <h3>${title}</h3>
            <div class="notify-guide-text">${description}</div>
            ${steps}
            <div class="notify-guide-note">${note}</div>
            <div class="notify-guide-actions">
                <button class="secondary-btn notify-guide-later">稍后再说</button>
                <button class="primary-btn notify-guide-primary">${isBlocked ? '我知道了' : '开启通知'}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.notify-guide-later').onclick = () => {
        rememberNotifyGuideDismissal();
        closeNotificationGuide();
    };

    overlay.querySelector('.notify-guide-primary').onclick = async () => {
        if (isBlocked) {
            rememberNotifyGuideDismissal();
            closeNotificationGuide();
            return;
        }

        const result = await requestNotificationPermission({ immediate: true, source: 'guide' });
        if (result === 'granted') {
            closeNotificationGuide();
            updatePwaInstallUI();
            return;
        }

        showNotificationGuideModal({ force: true });
    };

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            rememberNotifyGuideDismissal();
            closeNotificationGuide();
        }
    });
}

// ========== PWA ==========
let deferredInstallPrompt = null;
let pwaInstallReady = false;
const PWA_SESSION_FLAG = 'farm-pwa-session';

function syncPwaSessionFlag() {
    const launchedFromPwa = new URLSearchParams(window.location.search).get('source') === 'pwa';
    const launchedFromAndroidApp = document.referrer.startsWith('android-app://');
    const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
    const matchedDisplayMode = displayModes.some(mode => window.matchMedia?.(`(display-mode: ${mode})`).matches);
    const iosStandalone = window.navigator.standalone === true;

    const isInstalledContext = launchedFromPwa || launchedFromAndroidApp || matchedDisplayMode || iosStandalone;
    if (isInstalledContext) {
        sessionStorage.setItem(PWA_SESSION_FLAG, '1');
    }

    return isInstalledContext || sessionStorage.getItem(PWA_SESSION_FLAG) === '1';
}

function initPWA() {
    registerServiceWorker();
    syncPwaSessionFlag();
    updatePwaInstallUI();

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        pwaInstallReady = true;
        updatePwaInstallUI();
        showToast('📲 可安装到桌面了');
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        pwaInstallReady = false;
        sessionStorage.setItem(PWA_SESSION_FLAG, '1');
        clearNotifyGuideDismissal();
        updatePwaInstallUI(true);
        showToast('✅ 已安装到桌面，可像 App 一样快速打开');
        maybeShowNotificationGuide({ force: true, delay: 450 });
    });

    const displayModeMedia = window.matchMedia?.('(display-mode: standalone)');
    if (displayModeMedia?.addEventListener) {
        displayModeMedia.addEventListener('change', () => {
            syncPwaSessionFlag();
            updatePwaInstallUI();
            maybeShowNotificationGuide({ delay: 350 });
        });
    }

    window.addEventListener('pageshow', () => {
        syncPwaSessionFlag();
        updatePwaInstallUI();
    });

    window.addEventListener('focus', () => {
        syncPwaSessionFlag();
        updatePwaInstallUI();
    });

    maybeShowNotificationGuide({ delay: 900 });
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((registration) => {
            // 监听新版本更新
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // 有新版本可用
                        showUpdateToast();
                    }
                });
            });

            // 监听来自 Service Worker 的消息
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    // 新版本已激活，自动刷新
                    refreshApp();
                }
            });

            // 立即检查更新
            registration.update().catch(() => {});
        }).catch((error) => {
            console.warn('Service Worker 注册失败:', error);
        });
    });
}

// 显示版本更新提示
function showUpdateToast() {
    const toast = document.getElementById('update-toast');
    if (!toast) return;

    // 防止重复显示
    if (toast.style.display === 'block') return;

    toast.style.display = 'block';
    setTimeout(() => toast.classList.add('show'), 10);
}

// 关闭版本更新提示
function dismissUpdateToast() {
    const toast = document.getElementById('update-toast');
    if (!toast) return;

    toast.classList.remove('show');
    setTimeout(() => toast.style.display = 'none', 300);
}

// 刷新应用以应用更新
function refreshApp() {
    if (navigator.serviceWorker.controller) {
        // 通知 Service Worker 跳过等待
        navigator.serviceWorker.controller.postMessage({
            type: 'SKIP_WAITING'
        });
    }
    // 延迟刷新确保新 SW 已激活
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

function isPwaInstalled() {
    return syncPwaSessionFlag();
}

function updatePwaInstallUI(forceInstalled = false) {
    const isInstalled = forceInstalled || isPwaInstalled();
    const installButtons = document.querySelectorAll('[data-pwa-install]');
    const installHint = document.getElementById('pwa-install-hint');
    const installBadge = document.getElementById('pwa-install-badge');
    const notificationPermission = getNotificationPermissionState();
    const notificationReady = notificationPermission === 'granted';

    installButtons.forEach(btn => {
        const textEl = btn.querySelector('.install-btn-text, .install-btn-copy');
        const isHeaderBtn = btn.dataset.pwaInstall === 'header';

        btn.hidden = false;
        btn.disabled = false;

        if (isInstalled) {
            if (isHeaderBtn) {
                btn.hidden = true;
                return;
            }

            const shouldKeepGuideEntry = !notificationReady;
            btn.disabled = !shouldKeepGuideEntry;
            btn.title = shouldKeepGuideEntry ? '查看通知指引' : '已安装到桌面';
            if (textEl) textEl.textContent = shouldKeepGuideEntry ? '开启通知' : '已安装';
            return;
        }

        btn.title = pwaInstallReady ? '安装到桌面' : '查看安装方法';
        if (textEl) {
            textEl.textContent = isHeaderBtn
                ? '安装'
                : (pwaInstallReady ? '添加到桌面' : '查看安装方法');
        }
    });

    requestAnimationFrame(updateStickyOffsets);

    if (installBadge) {
        installBadge.className = 'pwa-badge';
        if (isInstalled) {
            installBadge.textContent = notificationReady ? '已安装' : '待开通知';
            installBadge.classList.add(notificationReady ? 'installed' : 'muted');
        } else {
            installBadge.textContent = pwaInstallReady ? '可安装' : '指引';
            if (!pwaInstallReady) {
                installBadge.classList.add('muted');
            }
        }
    }

    if (installHint) {
        installHint.textContent = isInstalled
            ? (notificationReady
                ? '当前已作为桌面应用打开，通知也已开启，之后可以从桌面直接进入。'
                : '当前已装到桌面；若想收到系统横幅提醒，还需要再允许浏览器通知。')
            : (pwaInstallReady
                ? '当前浏览器支持直接安装，装到桌面后可像 App 一样一键打开。'
                : 'Chrome / Edge 可从浏览器菜单安装；iPhone / iPad 请用“添加到主屏幕”。');
    }
}

async function promptPwaInstall() {
    if (isPwaInstalled()) {
        if (getNotificationPermissionState() !== 'granted') {
            maybeShowNotificationGuide({ force: true, delay: 120 });
            return;
        }

        showToast('已经安装好了，直接从桌面打开就行');
        return;
    }

    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome !== 'accepted') {
            showToast('已取消安装');
        }
        deferredInstallPrompt = null;
        pwaInstallReady = false;
        updatePwaInstallUI();
        return;
    }

    const isAppleDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isAppleDevice) {
        alert('请点击浏览器的“分享”按钮，再选择“添加到主屏幕”，这样就能把 QQ 农场计时器放到桌面。');
        return;
    }

    alert('当前浏览器没有直接弹出安装框。你可以打开浏览器菜单，选择“安装应用”“安装此站点”或“创建快捷方式”。');
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
            }
        });
        cleanupExpiredAlerts();
    }
});

// ========== 点击模态框外部关闭 ==========
document.addEventListener('click', (e) => {
    const settingsModal = document.getElementById('settings-modal');
    if (e.target === settingsModal) {
        toggleSettings();
    }
});

// ========== 分析页面相关功能 ==========
let analysisState = {
    farmLevel: 1,
    selectedLand: 'gold',
    sortBy: 'income',
    results: []
};

// 更新农场等级
function updateFarmLevel(level) {
    level = parseInt(level);
    if (isNaN(level) || level < 1) level = 1;
    if (level > 140) level = 140;

    analysisState.farmLevel = level;

    // 更新提示文本
    const hintText = document.getElementById('plant-count-hint');
    if (hintText) {
        const unlockedCount = Object.values(PLANTS_DATABASE).filter(p => p.level <= level).length;
        const totalCount = Object.keys(PLANTS_DATABASE).length;
        hintText.textContent = `已解锁 ${unlockedCount}/${totalCount} 种植物`;
    }

    // 自动计算效率（按总收益排序）
    calculateEfficiency();
}

// 调整农场等级
function adjustLevel(delta) {
    const input = document.getElementById('farm-level-input');
    let level = parseInt(input.value) || 1;
    level += delta;
    if (level < 1) level = 1;
    if (level > 140) level = 140;
    input.value = level;
    updateFarmLevel(level);
}

// 选择分析页面的土地类型
function selectAnalysisLand(landType) {
    analysisState.selectedLand = landType;

    // 更新按钮状态
    const btns = document.querySelectorAll('#analysis-land-options .land-btn');
    btns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.land === landType);
    });

    // 如果已有结果，重新计算
    if (analysisState.results.length > 0) {
        calculateEfficiency();
    }
}

// 计算效率
function calculateEfficiency() {
    const land = LAND_TYPES[analysisState.selectedLand];
    if (!land) return;

    // 过滤出当前等级解锁且可在该土地种植的植物
    const plants = Object.values(PLANTS_DATABASE)
        .filter(p => p.level <= analysisState.farmLevel)
        .filter(p => canPlantOnLand(p, analysisState.selectedLand))
        .map(plant => {
            // 计算各数据
            const growTime = calcGrowTime(plant.name, analysisState.selectedLand);
            const totalTime = calcTotalGrowTime(plant.name, analysisState.selectedLand);
            const sellPrice = Math.round(plant.sellPrice * (1 + land.yieldBonus));

            // 计算收益和经验
            const profit = sellPrice - plant.seedPrice;
            const totalProfit = profit * plant.seasons;
            const totalExp = plant.exp * plant.seasons;

            // 计算每小时效率
            const incomePerHour = totalTime > 0 ? totalProfit / totalTime : 0;
            const expPerHour = totalTime > 0 ? totalExp / totalTime : 0;

            return {
                ...plant,
                growTime,
                totalTime,
                sellPrice,
                profit,
                totalProfit,
                totalExp,
                incomePerHour,
                expPerHour
            };
        });

    analysisState.results = plants;

    // 默认按总收益排序
    if (analysisState.results.length > 0) {
        const sortBy = document.getElementById('analysis-sort').value;
        sortAnalysisResults();
    }
}

// 排序结果
function sortAnalysisResults() {
    const sortBy = document.getElementById('analysis-sort').value;
    analysisState.sortBy = sortBy;

    // 根据选择排序
    let sortedResults = [...analysisState.results];

    switch(sortBy) {
        case 'income':
            sortedResults.sort((a, b) => b.incomePerHour - a.incomePerHour);
            break;
        case 'exp':
            sortedResults.sort((a, b) => b.expPerHour - a.expPerHour);
            break;
        case 'totalIncome':
            sortedResults.sort((a, b) => b.totalProfit - a.totalProfit);
            break;
        case 'totalExp':
            sortedResults.sort((a, b) => b.totalExp - a.totalExp);
            break;
        case 'time':
            sortedResults.sort((a, b) => a.growTime - b.growTime);
            break;
    }

    renderAnalysisResults(sortedResults);
}

// 渲染分析结果
function renderAnalysisResults(results) {
    const resultDiv = document.getElementById('analysis-result');
    const summaryDiv = document.getElementById('analysis-summary');
    const listDiv = document.getElementById('efficiency-plant-list');

    if (!resultDiv || !summaryDiv || !listDiv) return;

    resultDiv.style.display = 'block';

    // 计算汇总信息
    const topIncome = results[0];
    const topExp = [...results].sort((a, b) => b.expPerHour - a.expPerHour)[0];

    summaryDiv.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">🏆 最高收益</span>
            <span class="summary-value">${topIncome.emoji} ${topIncome.name}</span>
            <span class="summary-sub">${topIncome.incomePerHour.toFixed(1)}/h</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
            <span class="summary-label">⭐ 最高经验</span>
            <span class="summary-value">${topExp.emoji} ${topExp.name}</span>
            <span class="summary-sub">${topExp.expPerHour.toFixed(1)}/h</span>
        </div>
    `;

    // 渲染植物列表
    listDiv.innerHTML = results.map((plant, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const seasonsText = plant.seasons > 1 ? `<span class="plant-seasons">${plant.seasons}季</span>` : '';

        return `
            <div class="analysis-plant-card" onclick="startPlantTimer('${plant.name}', '${analysisState.selectedLand}')">
                <div class="analysis-plant-rank">${medal || (index + 1)}</div>
                <div class="analysis-plant-emoji">${plant.emoji}</div>
                <div class="analysis-plant-info">
                    <div class="analysis-plant-name">${plant.name} ${seasonsText}</div>
                    <div class="analysis-plant-time">${plant.growTime}h · ${plant.totalTime}h</div>
                </div>
                <div class="analysis-plant-stats">
                    <div class="stat-item income">
                        <span class="stat-value">${plant.incomePerHour.toFixed(0)}</span>
                        <span class="stat-label">收益/h</span>
                    </div>
                    <div class="stat-item exp">
                        <span class="stat-value">${plant.expPerHour.toFixed(0)}</span>
                        <span class="stat-label">经验/h</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 只在首次计算时显示 toast
    if (!analysisState.hasCalculated) {
        showToast(`📊 已计算 ${results.length} 种植物的效率数据`);
        analysisState.hasCalculated = true;
    }
}

// 显示分析帮助
function showAnalysisHelp() {
    const modal = document.getElementById('analysis-help-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// 关闭分析帮助
function closeAnalysisHelp() {
    const modal = document.getElementById('analysis-help-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
