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

        if (tokenInput && this.token) {
            tokenInput.value = this.token;
            // 安全显示：只显示前后几位
            const masked = this.token.slice(0, 7) + '...' + this.token.slice(-4);
            tokenInput.placeholder = masked;
            if (tokenStatus) {
                tokenStatus.textContent = '✅ 已配置';
                tokenStatus.className = 'status-badge connected';
            }
        } else if (tokenStatus) {
            tokenStatus.textContent = '未配置';
            tokenStatus.className = 'status-badge';
        }
        if (sendKeyInput && this.sendKey) {
            sendKeyInput.value = this.sendKey;
            if (sendkeyStatus) {
                sendkeyStatus.textContent = '✅ 已配置';
                sendkeyStatus.className = 'status-badge connected';
            }
        } else if (sendkeyStatus) {
            sendkeyStatus.textContent = '未配置';
            sendkeyStatus.className = 'status-badge';
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
        // 同步更新闹钟列表页的状态栏
        updateSyncStatusBar();
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
            const payload = {
                alerts: alarms,
                history: state.history.slice(-200)
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
                // 新版返回 { alerts, history }，旧版返回纯数组
                if (Array.isArray(parsed)) {
                    return { alerts: parsed, history: [] };
                }
                return { alerts: parsed.alerts || [], history: parsed.history || [] };
            }
            return { alerts: [], history: [] };
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
            return;
        }

        showToast('🔄 正在同步...');

        // 先拉取云端数据
        const cloudData = await this.pullAlarms();
        if (cloudData === null) return;

        const cloudAlarms = cloudData.alerts || [];
        const cloudHistory = cloudData.history || [];

        // 合并策略：以云端为准，但保留本地运行中的定时器
        const now = new Date();
        
        // 清理本地过期闹钟
        state.alerts = state.alerts.filter(a => {
            if (state.timers[a.id]) return true;
            return new Date(a.endTime) > now;
        });

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

        // 合并历史记录：本地 + 云端，按 triggeredAt 去重，取最新200条
        const existingHistoryIds = new Set(state.history.map(h => h.id));
        cloudHistory.forEach(h => {
            if (!existingHistoryIds.has(h.id)) {
                state.history.push(h);
                existingHistoryIds.add(h.id);
            }
        });
        state.history = state.history.slice(-200);

        saveState();
        renderRunningTimers();
        renderAlertsList();
        renderHistoryList();
        this.updateUI();

        showToast(`✅ 同步完成！${state.alerts.length} 个闹钟，${state.history.length} 条历史`);
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
