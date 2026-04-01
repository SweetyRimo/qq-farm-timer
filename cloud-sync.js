// ============================================
// QQ农场计时器 - 云同步模块（GitHub Gist）
// ============================================

const CloudSync = {
    GIST_DESCRIPTION: 'QQFarmTimer',
    DATA_FILENAME: 'data.json',
    gistId: null,
    token: '',
    sendKey: '',

    // ========== 初始化 ==========
    init() {
        this.token = localStorage.getItem('farm-gh-token') || '';
        this.sendKey = localStorage.getItem('farm-send-key') || '';
        this.gistId = localStorage.getItem('farm-gist-id') || '';
        this.updateUI();
    },

    // ========== UI 更新 ==========
    updateUI() {
        const statusEl = document.getElementById('sync-status');
        const tokenInput = document.getElementById('gh-token-input');
        const sendKeyInput = document.getElementById('send-key-input');
        const tokenStatus = document.getElementById('token-status');
        const sendkeyStatus = document.getElementById('sendkey-status');
        const syncIcon = document.getElementById('header-sync-icon');

        if (tokenInput && this.token) {
            tokenInput.value = this.token;
            // 安全显示：只显示前后几位
            const masked = this.token.slice(0, 7) + '...' + this.token.slice(-4);
            tokenInput.placeholder = masked;
            if (tokenStatus) {
                tokenStatus.textContent = '✅ 已配置';
                tokenStatus.className = 'status-badge connected';
            }
        } else {
            if (tokenInput) tokenInput.value = '';
            if (tokenStatus) {
                tokenStatus.textContent = '未配置';
                tokenStatus.className = 'status-badge';
            }
        }
        if (sendKeyInput && this.sendKey) {
            sendKeyInput.value = this.sendKey;
            if (sendkeyStatus) {
                sendkeyStatus.textContent = '✅ 已配置';
                sendkeyStatus.className = 'status-badge connected';
            }
        } else {
            if (sendKeyInput) sendKeyInput.value = '';
            if (sendkeyStatus) {
                sendkeyStatus.textContent = '未配置';
                sendkeyStatus.className = 'status-badge';
            }
        }
        if (statusEl) {
            if (this.token && this.gistId) {
                statusEl.textContent = '☁️ 已连接云端';
                statusEl.className = 'sync-status connected';
            } else if (this.token) {
                statusEl.textContent = '☁️ 待首次同步';
                statusEl.className = 'sync-status connected';
            } else {
                statusEl.textContent = '☁️ 未连接';
                statusEl.className = 'sync-status';
            }
        }
        // 更新顶部同步按钮图标状态
        if (syncIcon) {
            if (this.token && this.gistId) {
                syncIcon.textContent = '☁️';
            } else if (this.token) {
                syncIcon.textContent = '⏳';
            } else {
                syncIcon.textContent = '☁️';
            }
        }
    },

    // ========== 保存配置 ==========
    saveConfig() {
        const tokenEl = document.getElementById('gh-token-input');
        const sendKeyEl = document.getElementById('send-key-input');
        let changed = false;

        if (tokenEl) {
            const newToken = tokenEl.value.trim();
            if (newToken && newToken !== this.token) {
                this.token = newToken;
                localStorage.setItem('farm-gh-token', newToken);
                this.gistId = '';
                localStorage.removeItem('farm-gist-id');
                changed = true;
            }
        }
        if (sendKeyEl) {
            const newKey = sendKeyEl.value.trim();
            if (newKey && newKey !== this.sendKey) {
                this.sendKey = newKey;
                localStorage.setItem('farm-send-key', newKey);
                changed = true;
            }
        }

        this.updateUI();
        showToast(changed ? '✅ 配置已保存' : '✅ 配置无变化，已确认');
    },

    // ========== 配置导出 / 导入 ==========
    exportConfig() {
        const payload = {
            app: 'QQFarmTimer',
            version: 1,
            exportedAt: new Date().toISOString(),
            note: '包含敏感配置，仅供本地迁移使用，请勿上传或分享。',
            sync: {
                token: this.token || '',
                gistId: this.gistId || '',
                sendKey: this.sendKey || ''
            },
            settings: {
                ...state.settings
            }
        };

        const blob = new Blob([
            JSON.stringify(payload, null, 2)
        ], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `qq-farm-timer-config-${date}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast('✅ 已导出本地配置，请妥善保管该文件');
    },

    openImportConfig() {
        const input = document.getElementById('config-import-input');
        if (!input) {
            showToast('❌ 当前页面缺少导入入口');
            return;
        }
        input.value = '';
        input.click();
    },

    async importConfigFromFile(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const sync = parsed?.sync || {};
            const settings = parsed?.settings || {};
            const hasToken = typeof sync.token === 'string' && sync.token.trim().length > 0;
            const hasSendKey = typeof sync.sendKey === 'string' && sync.sendKey.trim().length > 0;
            const settingCount = Object.keys(settings).filter(key => settings[key] !== undefined).length;

            if ((!parsed || typeof parsed !== 'object') || (!settingCount && !hasToken && !hasSendKey && !sync.gistId)) {
                throw new Error('文件中没有可导入的配置');
            }

            const summary = [
                '将覆盖当前设备上的本地配置。',
                `<br><span>提醒设置：${settingCount || 0}项</span>`,
                `<br><span>GitHub Token：${hasToken ? '包含' : '不包含'}</span>`,
                `<br><span>Server酱 SendKey：${hasSendKey ? '包含' : '不包含'}</span>`
            ].join('');

            showConfirm('导入本地配置', summary, () => this.applyImportedConfig(parsed));
        } catch (error) {
            showToast(`❌ 导入失败：${error.message || '文件格式不正确'}`);
        }
    },

    applyImportedConfig(parsed) {
        const sync = parsed?.sync || {};
        const nextSettings = parsed?.settings || {};
        const normalize = value => typeof value === 'string' ? value.trim() : '';

        this.token = normalize(sync.token);
        this.gistId = normalize(sync.gistId);
        this.sendKey = normalize(sync.sendKey);

        if (this.token) {
            localStorage.setItem('farm-gh-token', this.token);
        } else {
            localStorage.removeItem('farm-gh-token');
        }

        if (this.gistId) {
            localStorage.setItem('farm-gist-id', this.gistId);
        } else {
            localStorage.removeItem('farm-gist-id');
        }

        if (this.sendKey) {
            localStorage.setItem('farm-send-key', this.sendKey);
        } else {
            localStorage.removeItem('farm-send-key');
        }

        state.settings = {
            ...state.settings,
            ...nextSettings
        };

        localStorage.setItem('farm-timer-state', JSON.stringify({
            alerts: state.alerts.map(a => ({ ...a })),
            history: state.history.slice(-200),
            settings: state.settings
        }));

        if (typeof refreshSettingsForm === 'function') {
            refreshSettingsForm();
        }
        this.updateUI();
        if (typeof updateSyncStatusBar === 'function') {
            updateSyncStatusBar();
        }
        showToast('✅ 本地配置已导入；敏感信息仍只保存在当前设备');
    },

    // ========== GitHub API 请求 ==========
    async apiCall(path, method = 'GET', data = null) {
        if (!this.token) {
            throw new Error('未配置 GitHub Token');
        }

        const options = {
            method,
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        const resp = await fetch(`https://api.github.com${path}`, options);
        
        if (resp.status === 401) {
            throw new Error('Token 无效或已过期');
        }
        if (resp.status === 403) {
            throw new Error('API 请求次数超限');
        }
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `请求失败 (${resp.status})`);
        }

        return resp.json();
    },

    // ========== 查找或创建 Gist ==========
    async ensureGist() {
        if (this.gistId) return this.gistId;

        // 查找现有 Gist
        try {
            const gists = await this.apiCall('/gists');
            for (const g of gists) {
                if (g.description === this.GIST_DESCRIPTION) {
                    this.gistId = g.id;
                    localStorage.setItem('farm-gist-id', g.id);
                    return g.id;
                }
            }
        } catch (e) {
            console.warn('查找 Gist 失败:', e);
        }

        // 创建新 Gist
        try {
            const emptyData = {
                description: this.GIST_DESCRIPTION,
                public: false,
                files: {
                    [this.DATA_FILENAME]: {
                        content: JSON.stringify({ alerts: [], history: [] })
                    }
                }
            };
            const gist = await this.apiCall('/gists', 'POST', emptyData);
            this.gistId = gist.id;
            localStorage.setItem('farm-gist-id', gist.id);
            return gist.id;
        } catch (e) {
            console.error('创建 Gist 失败:', e);
            throw e;
        }
    },

    // ========== 上传数据到云端 ==========
    async pushAlarms(alarms) {
        if (!this.token) return false;

        try {
            const gistId = await this.ensureGist();
            // 收集自定义植物数据
            const customPlants = Object.values(PLANTS_DATABASE).filter(p => p.isCustom);
            const payload = {
                alerts: alarms,
                history: state.history.slice(-200),
                customPlants: customPlants,
                settings: state.settings
            };
            const data = {
                files: {
                    [this.DATA_FILENAME]: {
                        content: JSON.stringify(payload)
                    }
                }
            };
            await this.apiCall(`/gists/${gistId}`, 'PATCH', data);
            this.updateUI();
            return true;
        } catch (e) {
            console.error('上传数据失败:', e);
            showToast('❌ 云同步失败: ' + e.message);
            return false;
        }
    },

    // ========== 从云端拉取数据 ==========
    async pullAlarms() {
        if (!this.token) return null;

        try {
            const gistId = await this.ensureGist();
            const gist = await this.apiCall(`/gists/${gistId}`);

            const files = gist.files || {};
            // 兼容旧版 alarms.json 和新版 data.json
            const dataFile = files[this.DATA_FILENAME] || files['alarms.json'];
            if (dataFile) {
                const content = dataFile.content;
                const parsed = JSON.parse(content);
                // 新版返回 { alerts, history, customPlants, settings }，旧版返回纯数组
                if (Array.isArray(parsed)) {
                    return { alerts: parsed, history: [], customPlants: [], settings: null };
                }
                return {
                    alerts: parsed.alerts || [],
                    history: parsed.history || [],
                    customPlants: parsed.customPlants || [],
                    settings: parsed.settings || null
                };
            }
            return { alerts: [], history: [], customPlants: [], settings: null };
        } catch (e) {
            console.error('拉取数据失败:', e);
            showToast('❌ 云同步失败: ' + e.message);
            return null;
        }
    },

    // ========== 测试推送 ==========
    async testPush() {
        if (!this.sendKey) {
            showToast('❌ 请先配置 Server酱 SendKey');
            return false;
        }

        try {
            const resp = await fetch(
                `https://sctapi.ftqq.com/${this.sendKey}.send`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `title=${encodeURIComponent('🌾 农场计时器测试')}&desp=${encodeURIComponent('推送功能正常！你将收到这条测试消息。')}`
                }
            );
            const result = await resp.json();
            if (result.code === 0) {
                showToast('✅ 推送测试成功！请检查微信');
                return true;
            } else {
                showToast('❌ 推送失败: ' + (result.message || '未知错误'));
                return false;
            }
        } catch (e) {
            showToast('❌ 推送请求失败: ' + e.message);
            return false;
        }
    },

    // ========== 手动同步 ==========
    async syncNow() {
        if (!this.token) {
            showToast('❌ 请先配置 GitHub Token');
            if (typeof openSettingsPanel === 'function') {
                openSettingsPanel({
                    targetId: 'token-setting-item',
                    focusId: 'gh-token-input'
                });
            }
            return;
        }

        // 顶部按钮动画
        const syncBtn = document.getElementById('header-sync-btn');
        const syncIcon = document.getElementById('header-sync-icon');
        if (syncBtn) syncBtn.classList.add('syncing');

        showToast('🔄 正在同步...');

        try {
            // 先拉取云端数据
            const cloudData = await this.pullAlarms();
            if (cloudData === null) return;

            const cloudAlarms = cloudData.alerts || [];
            const cloudHistory = cloudData.history || [];
            const cloudCustomPlants = cloudData.customPlants || [];
            const cloudSettings = cloudData.settings || null;

            // 合并策略：以云端为准，但保留本地运行中的定时器
            const now = new Date();
            
            // 先把本地已过期闹钟归档到历史，避免同步时直接丢失
            if (typeof cleanupExpiredAlerts === 'function') {
                cleanupExpiredAlerts({ save: false, render: false });
            } else {
                state.alerts = state.alerts.filter(a => {
                    if (state.timers[a.id]) return true;
                    return new Date(a.endTime) > now;
                });
            }

            // 先补齐云端中过期但尚未入历史的闹钟
            if (typeof archiveAlertToHistory === 'function') {
                cloudAlarms.forEach(alarm => {
                    if (!alarm?.endTime) return;
                    if (new Date(alarm.endTime) <= now) {
                        archiveAlertToHistory(alarm, alarm.endTime);
                    }
                });
            }

            // 用云端数据替换本地（仅未过期的）
            const activeCloudAlarms = cloudAlarms.filter(a => {
                if (a.pushNotified) return false;
                return new Date(a.endTime) > now;
            });

            // 合并闹钟：云端 + 本地运行中的
            activeCloudAlarms.forEach(a => {
                if (!state.timers[a.id]) {
                    state.timers[a.id] = a;
                }
            });
            state.alerts = [...activeCloudAlarms];

            // 合并历史记录：本地 + 云端，按 ID 去重，取最新200条
            const existingHistoryIds = new Set(state.history.map(h => h.id));
            cloudHistory.forEach(h => {
                if (!existingHistoryIds.has(h.id)) {
                    state.history.push(h);
                    existingHistoryIds.add(h.id);
                }
            });
            if (typeof sortHistoryItems === 'function') {
                state.history = sortHistoryItems(state.history).slice(-200);
            } else {
                state.history = state.history.slice(-200);
            }

            // 合并自定义植物：云端 + 本地，按名称去重
            let customPlantMerged = false;
            if (cloudCustomPlants.length > 0) {
                cloudCustomPlants.forEach(p => {
                    if (p.name && !PLANTS_DATABASE[p.name]) {
                        PLANTS_DATABASE[p.name] = typeof normalizePlantRecord === 'function'
                            ? normalizePlantRecord({ ...p, isCustom: true }, { isCustom: true })
                            : {
                                ...p,
                                isCustom: true,
                                growthTime: p.firstTime || p.growthTime || 0
                            };
                        customPlantMerged = true;
                    }
                });
                // 保存合并后的自定义植物
                if (typeof saveCustomPlants === 'function') saveCustomPlants();
            }

            // 合并设置：以云端的为准（如果云端有的话）
            if (cloudSettings) {
                state.settings = { ...state.settings, ...cloudSettings };
                if (typeof refreshSettingsForm === 'function') {
                    refreshSettingsForm();
                }
            }

            // 推送本地数据到云端（包含合并后的结果）
            await this.pushAlarms(state.alerts);

            saveState();
            renderRunningTimers();
            renderAlertsList();
            renderHistoryList();
            if (customPlantMerged) {
                renderPlantGrid(document.getElementById('plant-search-input')?.value || '');
                if (typeof renderCustomPlantsList === 'function') renderCustomPlantsList();
            }
            this.updateUI();

            const parts = [`${state.alerts.length}个闹钟`, `${state.history.length}条历史`];
            const customCount = Object.values(PLANTS_DATABASE).filter(p => p.isCustom).length;
            if (customCount > 0) parts.push(`${customCount}个自定义植物`);
            showToast(`✅ 同步完成！${parts.join('，')}`);
        } finally {
            if (syncBtn) syncBtn.classList.remove('syncing');
        }
    },

    // ========== 断开连接 ==========
    disconnect() {
        this.token = '';
        this.gistId = '';
        localStorage.removeItem('farm-gh-token');
        localStorage.removeItem('farm-gist-id');
        
        const tokenInput = document.getElementById('gh-token-input');
        if (tokenInput) tokenInput.value = '';
        
        this.updateUI();
        showToast('☁️ 已断开云同步');
    }
};
