// =============================================
// Nano Banana - 图片生成工作台 (多图版)
// =============================================

const MAX_REF_IMAGES = 5;

// ========== 应用状态 ==========
const state = {
    apiKey: localStorage.getItem('nb_api_key') || '',
    endpoint: localStorage.getItem('nb_endpoint') || 'gemini',
    selectedRatio: 'auto',
    selectedResolution: '1K',
    referenceImages: [],
    isGenerating: false,
    currentImageDataUrl: null,
    history: JSON.parse(localStorage.getItem('nb_history') || '[]'),
    theme: localStorage.getItem('nb_theme') || 'dark',
    _progressTimer: null
};

// ========== DOM ==========
const $ = (id) => document.getElementById(id);

const DOM = {
    apiKey: $('apiKey'),
    toggleApiKey: $('toggleApiKey'),
    endpointGemini: $('endpointGemini'),
    endpointOpenai: $('endpointOpenai'),
    endpointUrl: $('endpointUrl'),
    promptText: $('promptText'),
    charCount: $('charCount'),
    clearPrompt: $('clearPrompt'),
    uploadArea: $('uploadArea'),
    uploadPlaceholder: $('uploadPlaceholder'),
    fileInput: $('fileInput'),
    refImagesGrid: $('refImagesGrid'),
    refImagesActions: $('refImagesActions'),
    refCount: $('refCount'),
    addMoreBtn: $('addMoreBtn'),
    clearAllBtn: $('clearAllBtn'),
    ratioGrid: $('ratioGrid'),
    resolutionSelector: $('resolutionSelector'),
    generateBtn: $('generateBtn'),
    emptyState: $('emptyState'),
    loadingState: $('loadingState'),
    loadingTip: $('loadingTip'),
    progressBar: $('progressBar'),
    resultArea: $('resultArea'),
    resultTitle: $('resultTitle'),
    resultMeta: $('resultMeta'),
    resultImage: $('resultImage'),
    resultText: $('resultText'),
    resultTextContent: $('resultTextContent'),
    downloadBtn: $('downloadBtn'),
    copyBtn: $('copyBtn'),
    fullscreenBtn: $('fullscreenBtn'),
    newGenerateBtn: $('newGenerateBtn'),
    fullscreenModal: $('fullscreenModal'),
    fullscreenImage: $('fullscreenImage'),
    modalClose: $('modalClose'),
    historySection: $('historySection'),
    historyGrid: $('historyGrid'),
    clearHistory: $('clearHistory'),
    apiStatus: $('apiStatus'),
    themeBtn: $('themeBtn'),
    toastContainer: $('toastContainer')
};

// ========== 初始化 ==========
function init() {
    if (state.apiKey) {
        DOM.apiKey.value = state.apiKey;
        updateApiStatus(true);
    }
    setEndpoint(state.endpoint);
    applyTheme(state.theme);
    bindEvents();
    renderHistory();
}

// ========== Toast ==========
function showToast(message, type = 'info') {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ========== 主题 ==========
function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('nb_theme', theme);
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        DOM.themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        DOM.themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ========== API 状态 ==========
function updateApiStatus(connected) {
    DOM.apiStatus.classList.toggle('connected', connected);
    DOM.apiStatus.querySelector('.status-text').textContent = connected ? '已连接' : '未连接';
}

// ========== 端点 ==========
function setEndpoint(type) {
    state.endpoint = type;
    localStorage.setItem('nb_endpoint', type);
    DOM.endpointGemini.classList.toggle('active', type === 'gemini');
    DOM.endpointOpenai.classList.toggle('active', type === 'openai');
    DOM.endpointUrl.textContent = type === 'gemini'
        ? '/v1beta/models/gemini-3-pro-image-preview:generateContent'
        : '/v1/chat/completions';
}

// ========== 事件绑定 ==========
function bindEvents() {
    // API Key
    DOM.apiKey.addEventListener('input', (e) => {
        state.apiKey = e.target.value.trim();
        localStorage.setItem('nb_api_key', state.apiKey);
        updateApiStatus(!!state.apiKey);
    });

    DOM.toggleApiKey.addEventListener('click', () => {
        const isPassword = DOM.apiKey.type === 'password';
        DOM.apiKey.type = isPassword ? 'text' : 'password';
        DOM.toggleApiKey.querySelector('i').className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    // 端点
    DOM.endpointGemini.addEventListener('click', () => setEndpoint('gemini'));
    DOM.endpointOpenai.addEventListener('click', () => setEndpoint('openai'));

    // 提示词
    DOM.promptText.addEventListener('input', () => {
        DOM.charCount.textContent = `${DOM.promptText.value.length} 字`;
    });
    DOM.clearPrompt.addEventListener('click', () => {
        DOM.promptText.value = '';
        DOM.charCount.textContent = '0 字';
    });

    // 快速提示词
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.promptText.value = btn.dataset.prompt;
            DOM.charCount.textContent = `${btn.dataset.prompt.length} 字`;
            DOM.promptText.focus();
            showToast('已填入提示词，点击「生成图片」开始创作', 'info');
        });
    });

    // 文件上传 - 点击上传区
    DOM.uploadArea.addEventListener('click', () => {
        if (state.referenceImages.length >= MAX_REF_IMAGES) {
            showToast(`最多上传 ${MAX_REF_IMAGES} 张参考图`, 'warning');
            return;
        }
        DOM.fileInput.click();
    });

    // 文件选择
    DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
        }
        // 重置，允许重复选同一文件
        DOM.fileInput.value = '';
    });

    // 拖拽
    DOM.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.uploadArea.classList.add('dragover');
    });
    DOM.uploadArea.addEventListener('dragleave', () => {
        DOM.uploadArea.classList.remove('dragover');
    });
    DOM.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    });

    // 添加更多按钮
    DOM.addMoreBtn.addEventListener('click', () => {
        if (state.referenceImages.length >= MAX_REF_IMAGES) {
            showToast(`最多 ${MAX_REF_IMAGES} 张`, 'warning');
            return;
        }
        DOM.fileInput.click();
    });

    // 清空全部按钮
    DOM.clearAllBtn.addEventListener('click', () => {
        state.referenceImages = [];
        renderRefImages();
        showToast('已清空所有参考图', 'info');
    });

    // 比例
    DOM.ratioGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.ratio-btn');
        if (!btn) return;
        DOM.ratioGrid.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedRatio = btn.dataset.ratio;
    });

    // 分辨率
    DOM.resolutionSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.resolution-btn');
        if (!btn) return;
        DOM.resolutionSelector.querySelectorAll('.resolution-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedResolution = btn.dataset.resolution;
    });

    // 生成
    DOM.generateBtn.addEventListener('click', generateImage);
    DOM.newGenerateBtn.addEventListener('click', generateImage);

    // 结果操作
    DOM.downloadBtn.addEventListener('click', downloadImage);
    DOM.copyBtn.addEventListener('click', copyImage);
    DOM.fullscreenBtn.addEventListener('click', openFullscreen);
    DOM.modalClose.addEventListener('click', closeFullscreen);
    DOM.fullscreenModal.addEventListener('click', (e) => {
        if (e.target === DOM.fullscreenModal) closeFullscreen();
    });

    // 历史
    DOM.clearHistory.addEventListener('click', () => {
        if (!confirm('确定清空所有历史记录？')) return;
        state.history = [];
        localStorage.setItem('nb_history', '[]');
        renderHistory();
        showToast('历史记录已清空', 'info');
    });

    // 主题
    DOM.themeBtn.addEventListener('click', toggleTheme);

    // 快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeFullscreen();
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generateImage(); }
    });
}

// ========== 多图文件处理 ==========
function addFiles(files) {
    const remaining = MAX_REF_IMAGES - state.referenceImages.length;
    if (remaining <= 0) {
        showToast(`最多 ${MAX_REF_IMAGES} 张参考图`, 'warning');
        return;
    }

    const batch = files.slice(0, remaining);
    if (files.length > remaining) {
        showToast(`只添加前 ${remaining} 张（已达上限）`, 'warning');
    }

    let done = 0;
    const total = batch.length;

    batch.forEach((file, i) => {
        // 校验格式
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            showToast('请上传 JPG、PNG 或 WebP 格式的图片', 'error');
            done++;
            if (done === total) renderRefImages();
            return;
        }
        // 校验大小
        if (file.size > 20 * 1024 * 1024) {
            showToast('图片大小不能超过 20MB', 'error');
            done++;
            if (done === total) renderRefImages();
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            state.referenceImages.push({
                id: Date.now() + '_' + i,
                base64: dataUrl.split(',')[1],
                mimeType: file.type,
                dataUrl: dataUrl
            });
            done++;
            if (done === total) {
                renderRefImages();
                showToast(`参考图片已上传（共 ${state.referenceImages.length} 张）`, 'success');
            }
        };
        reader.readAsDataURL(file);
    });
}

function renderRefImages() {
    const count = state.referenceImages.length;

    // 清空网格
    DOM.refImagesGrid.innerHTML = '';

    if (count === 0) {
        // 无图：显示上传区，隐藏操作栏
        DOM.uploadArea.style.display = '';
        DOM.uploadPlaceholder.style.display = '';
        DOM.refImagesActions.style.display = 'none';
        return;
    }

    // 有图：显示操作栏
    DOM.refImagesActions.style.display = '';
    DOM.refCount.textContent = `${count}/${MAX_REF_IMAGES}`;

    // 满了就隐藏上传区
    if (count >= MAX_REF_IMAGES) {
        DOM.uploadArea.style.display = 'none';
    } else {
        DOM.uploadArea.style.display = '';
        DOM.uploadPlaceholder.style.display = '';
    }

    // 渲染每张图
    state.referenceImages.forEach((img, idx) => {
        const item = document.createElement('div');
        item.className = 'ref-image-item';
        item.innerHTML = `
            <img src="${img.dataUrl}" alt="参考图 ${idx + 1}" />
            <span class="ref-badge">#${idx + 1}</span>
            <button class="ref-remove" title="移除"><i class="fas fa-times"></i></button>
        `;
        item.querySelector('.ref-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            state.referenceImages = state.referenceImages.filter(x => x.id !== img.id);
            renderRefImages();
        });
        DOM.refImagesGrid.appendChild(item);
    });
}

// ========== 视图切换 ==========
function showView(view) {
    DOM.emptyState.style.display = view === 'empty' ? '' : 'none';
    DOM.loadingState.style.display = view === 'loading' ? '' : 'none';
    DOM.resultArea.style.display = view === 'result' ? '' : 'none';
}

function showLoading() {
    showView('loading');
    DOM.generateBtn.disabled = true;
    DOM.generateBtn.classList.add('generating');
    DOM.generateBtn.innerHTML = '<i class="fas fa-spinner"></i> <span>生成中...</span>';
    DOM.progressBar.style.width = '0%';
    DOM.loadingTip.textContent = 'AI 正在理解你的创意...';

    let progress = 0;
    const tips = [
        'AI 正在理解你的创意...',
        '正在构思画面布局...',
        '渲染色彩和细节中...',
        '优化图片质量...',
        '即将完成...'
    ];
    let tipIndex = 0;

    state._progressTimer = setInterval(() => {
        progress = Math.min(progress + Math.random() * 6, 92);
        DOM.progressBar.style.width = progress + '%';
        if (progress > (tipIndex + 1) * 18 && tipIndex < tips.length - 1) {
            tipIndex++;
            DOM.loadingTip.textContent = tips[tipIndex];
        }
    }, 800);
}

function hideLoading() {
    if (state._progressTimer) {
        clearInterval(state._progressTimer);
        state._progressTimer = null;
    }
    DOM.progressBar.style.width = '100%';
    DOM.generateBtn.disabled = false;
    DOM.generateBtn.classList.remove('generating');
    DOM.generateBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> <span>生成图片</span>';
}

// ========== 显示结果 ==========
function showResultView(result, prompt) {
    showView('result');
    DOM.resultImage.src = result.imageDataUrl;
    DOM.resultImage.style.display = '';

    const ratioText = state.selectedRatio === 'auto' ? '自动' : state.selectedRatio;
    const refText = state.referenceImages.length > 0 ? ` | 参考图: ${state.referenceImages.length}张` : '';
    DOM.resultMeta.textContent = `比例: ${ratioText} | 分辨率: ${state.selectedResolution} | 端点: ${state.endpoint === 'gemini' ? 'Gemini原生' : 'OpenAI兼容'}${refText}`;

    if (result.text && result.text.trim()) {
        DOM.resultText.style.display = '';
        DOM.resultTextContent.textContent = result.text;
    } else {
        DOM.resultText.style.display = 'none';
    }
}

// ========== 核心：图片生成 ==========
async function generateImage() {
    const prompt = DOM.promptText.value.trim();

    if (!state.apiKey) {
        showToast('请先输入 API Key', 'warning');
        DOM.apiKey.focus();
        return;
    }
    if (!prompt) {
        showToast('请输入提示词', 'warning');
        DOM.promptText.focus();
        return;
    }
    if (state.isGenerating) return;

    state.isGenerating = true;
    showLoading();

    try {
        let result;
        if (state.endpoint === 'gemini') {
            result = await callGeminiAPI(prompt);
        } else {
            result = await callOpenAIAPI(prompt);
        }

        hideLoading();

        if (result && result.imageDataUrl) {
            state.currentImageDataUrl = result.imageDataUrl;
            showResultView(result, prompt);
            addToHistory(result, prompt);
            showToast('图片生成成功！🎉', 'success');
        } else if (result && result.text) {
            state.currentImageDataUrl = null;
            showView('result');
            DOM.resultImage.style.display = 'none';
            DOM.resultText.style.display = '';
            DOM.resultTextContent.textContent = result.text;
            DOM.resultMeta.textContent = 'AI 返回了文本，未生成图片（请尝试更明确的图片描述）';
            showToast('AI 只返回了文字，请修改提示词重试', 'warning');
        } else {
            throw new Error('未能获取到图片结果，请查看控制台日志');
        }
    } catch (err) {
        console.error('❌ Generation error:', err);
        hideLoading();
        showView('empty');
        showToast('生成失败: ' + err.message, 'error');
    } finally {
        state.isGenerating = false;
    }
}

// ========== Gemini 原生 API ==========
async function callGeminiAPI(prompt) {
    const url = `https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${state.apiKey}`;

    const parts = [{ text: prompt }];

    // 多图：循环添加所有参考图（和单图版结构完全一致）
    state.referenceImages.forEach((img, idx) => {
        parts.push({
            inline_data: {
                mime_type: img.mimeType,
                data: img.base64
            }
        });
        console.log(`📎 附加参考图 #${idx + 1}: ${img.mimeType}`);
    });

    // 构建 imageConfig（严格按API文档格式）
    const imageConfig = {};
    
    if (state.selectedRatio && state.selectedRatio !== 'auto') {
        imageConfig.aspectRatio = state.selectedRatio;
    }
    
    if (state.selectedResolution) {
        imageConfig.imageSize = state.selectedResolution;
    }

    // 构建 generationConfig（严格按API文档格式）
    const generationConfig = {
        responseModalities: ['TEXT', 'IMAGE']
    };

    // 只在 imageConfig 有内容时才加入
    if (Object.keys(imageConfig).length > 0) {
        generationConfig.imageConfig = imageConfig;
    }

    const body = {
        contents: [{
            role: 'user',
            parts: parts
        }],
        generationConfig: generationConfig
    };



    console.log('========================================');
    console.log('📤 Gemini 请求 URL:', url.replace(state.apiKey, '***'));
    console.log('📤 Parts数量:', parts.length, '(1文本 +', state.referenceImages.length, '图)');
    console.log('📤 Gemini 请求体:', JSON.stringify(body, null, 2));
    console.log('========================================');

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const rawText = await resp.text();
    console.log('📥 Gemini 原始响应状态:', resp.status, resp.statusText);
    console.log('📥 Gemini 原始响应内容（前2000字符）:', rawText.substring(0, 2000));

    if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}: ${resp.statusText}`;
        try {
            const errObj = JSON.parse(rawText);
            if (errObj.error?.message) errMsg = errObj.error.message;
        } catch (e) { /* 忽略 */ }
        throw new Error(errMsg);
    }

    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        console.error('❌ JSON 解析失败:', e);
        throw new Error('API 返回了非 JSON 格式的数据');
    }

    console.log('📥 Gemini 解析后的响应:', JSON.stringify(data, null, 2).substring(0, 3000));

    return parseGeminiResponse(data);
}

function parseGeminiResponse(data) {
    const result = { text: '', imageDataUrl: null, mimeType: null };

    if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
    }

    if (data.promptFeedback?.blockReason) {
        throw new Error('提示词被安全过滤器阻断: ' + data.promptFeedback.blockReason);
    }

    if (!data.candidates || data.candidates.length === 0) {
        console.error('❌ 没有 candidates，完整响应:', JSON.stringify(data));
        throw new Error('API 返回结果为空（没有 candidates）');
    }

    const candidate = data.candidates[0];

    if (candidate.finishReason === 'SAFETY') {
        throw new Error('内容被安全过滤器阻断，请修改提示词');
    }
    if (candidate.finishReason === 'RECITATION') {
        throw new Error('内容因版权原因被阻断');
    }

    const content = candidate.content;
    if (!content) {
        console.error('❌ candidate 没有 content:', JSON.stringify(candidate));
        throw new Error('返回的候选结果没有内容');
    }

    const parts = content.parts || [];
    console.log(`📋 响应包含 ${parts.length} 个 parts`);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        console.log(`  Part ${i}: keys=${Object.keys(part).join(',')}`);

        if (part.text) {
            result.text += part.text;
            console.log(`  Part ${i}: 文本内容 (${part.text.length} 字符)`);
        }

        if (part.inline_data) {
            const mime = part.inline_data.mime_type || 'image/png';
            const b64 = part.inline_data.data;
            console.log(`  Part ${i}: 图片数据 mime=${mime}, base64长度=${b64 ? b64.length : 0}`);

            if (b64 && b64.length > 100) {
                result.imageDataUrl = `data:${mime};base64,${b64}`;
                result.mimeType = mime;
            } else {
                console.warn(`  Part ${i}: 图片数据太短或为空，跳过`);
            }
        }

        if (part.inlineData) {
            const mime = part.inlineData.mimeType || part.inlineData.mime_type || 'image/png';
            const b64 = part.inlineData.data;
            console.log(`  Part ${i}: 图片数据(inlineData) mime=${mime}, base64长度=${b64 ? b64.length : 0}`);

            if (b64 && b64.length > 100) {
                result.imageDataUrl = `data:${mime};base64,${b64}`;
                result.mimeType = mime;
            }
        }

        if (part.file_data || part.fileData) {
            const fd = part.file_data || part.fileData;
            console.log(`  Part ${i}: file_data 格式:`, fd);
        }
    }

    console.log('📊 解析结果: 有图片=' + !!result.imageDataUrl + ', 有文本=' + !!result.text);

    return result;
}

// ========== OpenAI 兼容 API ==========
async function callOpenAIAPI(prompt) {
    const url = 'https://yunwu.ai/v1/chat/completions';

    const userContent = [];

    let fullPrompt = prompt;
    if (state.selectedRatio !== 'auto') {
        fullPrompt += `\n\nPlease generate an image with aspect ratio ${state.selectedRatio}.`;
    }
    if (state.selectedResolution) {
        fullPrompt += `\nResolution: ${state.selectedResolution}.`;
    }
    fullPrompt += '\nPlease generate an image based on the above description.';

    userContent.push({ type: 'text', text: fullPrompt });

    // 多图：循环添加
    state.referenceImages.forEach((img) => {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: `data:${img.mimeType};base64,${img.base64}`
            }
        });
    });

    const body = {
        model: 'gemini-3-pro-image-preview',
        messages: [{
            role: 'user',
            content: userContent
        }]
    };

    console.log('========================================');
    console.log('📤 OpenAI 请求 URL:', url);
    console.log('📤 OpenAI 请求体 (prompt部分):', fullPrompt);
    console.log('📤 参考图数量:', state.referenceImages.length);
    console.log('========================================');

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify(body)
    });

    const rawText = await resp.text();
    console.log('📥 OpenAI 原始响应状态:', resp.status);
    console.log('📥 OpenAI 原始响应 (前3000字符):', rawText.substring(0, 3000));

    if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try {
            const errObj = JSON.parse(rawText);
            if (errObj.error?.message) errMsg = errObj.error.message;
        } catch (e) { /* 忽略 */ }
        throw new Error(errMsg);
    }

    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        throw new Error('API 返回了非 JSON 格式的数据');
    }

    return parseOpenAIResponse(data);
}

function parseOpenAIResponse(data) {
    const result = { text: '', imageDataUrl: null, mimeType: null };

    if (!data.choices || data.choices.length === 0) {
        console.error('❌ OpenAI 响应没有 choices:', JSON.stringify(data));
        throw new Error('API 返回结果为空');
    }

    const message = data.choices[0].message;
    if (!message) {
        throw new Error('返回消息为空');
    }

    console.log('📋 OpenAI message.content 类型:', typeof message.content);

    if (typeof message.content === 'string') {
        const content = message.content;

        const mdImgRegex = /!\[.*?\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/g;
        let match = mdImgRegex.exec(content);
        if (match) {
            result.imageDataUrl = match[1];
            console.log('✅ 从 Markdown 图片语法中提取到图片');
        }

        if (!result.imageDataUrl) {
            const b64Regex = /data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]{100,})/;
            const b64Match = b64Regex.exec(content);
            if (b64Match) {
                result.imageDataUrl = b64Match[0];
                console.log('✅ 从文本中提取到 base64 图片');
            }
        }

        const textOnly = content
            .replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '')
            .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '')
            .trim();
        if (textOnly) {
            result.text = textOnly;
        }
    }

    if (Array.isArray(message.content)) {
        console.log(`📋 OpenAI content 数组有 ${message.content.length} 项`);
        for (let i = 0; i < message.content.length; i++) {
            const part = message.content[i];
            console.log(`  Part ${i}: type=${part.type}`);

            if (part.type === 'text' && part.text) {
                result.text += part.text;
            }
            if (part.type === 'image_url' && part.image_url) {
                const imgUrl = part.image_url.url || part.image_url;
                if (typeof imgUrl === 'string' && imgUrl.startsWith('data:image')) {
                    result.imageDataUrl = imgUrl;
                    console.log('✅ 从 image_url part 中获取图片');
                } else if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                    result.imageDataUrl = imgUrl;
                    console.log('✅ 从 image_url part 中获取远程图片URL:', imgUrl);
                }
            }
            if (part.type === 'image' && part.image) {
                if (part.image.url) {
                    result.imageDataUrl = part.image.url;
                } else if (part.image.data) {
                    const mime = part.image.mime_type || 'image/png';
                    result.imageDataUrl = `data:${mime};base64,${part.image.data}`;
                }
            }
        }
    }

    console.log('📊 OpenAI 解析结果: 有图片=' + !!result.imageDataUrl + ', 有文本=' + (result.text.length > 0));

    return result;
}

// ========== 历史记录 ==========
function addToHistory(result, prompt) {
    if (!result.imageDataUrl) return;

    const item = {
        id: Date.now(),
        prompt: prompt.substring(0, 100),
        ratio: state.selectedRatio,
        resolution: state.selectedResolution,
        endpoint: state.endpoint,
        fullImage: result.imageDataUrl,
        text: (result.text || '').substring(0, 200),
        time: new Date().toLocaleString('zh-CN')
    };

    state.history.unshift(item);
    if (state.history.length > 12) {
        state.history = state.history.slice(0, 12);
    }

    try {
        localStorage.setItem('nb_history', JSON.stringify(state.history));
    } catch (e) {
        console.warn('localStorage 存储失败，清理历史');
        state.history = state.history.slice(0, 3);
        try {
            localStorage.setItem('nb_history', JSON.stringify(state.history));
        } catch (e2) {
            state.history = [];
            localStorage.removeItem('nb_history');
        }
    }

    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        DOM.historySection.style.display = 'none';
        return;
    }

    DOM.historySection.style.display = '';
    DOM.historyGrid.innerHTML = '';

    state.history.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <img src="${item.fullImage}" alt="历史图片" loading="lazy" />
            <div class="history-item-overlay">
                <span>${item.prompt}</span>
                <span>${item.ratio || '自动'} · ${item.resolution || '1K'} · ${item.time || ''}</span>
            </div>
        `;
        div.addEventListener('click', () => {
            state.currentImageDataUrl = item.fullImage;
            DOM.resultImage.src = item.fullImage;
            DOM.resultImage.style.display = '';
            DOM.resultMeta.textContent = `${item.ratio || '自动'} | ${item.resolution || '1K'} | ${item.time || ''}`;
            if (item.text) {
                DOM.resultText.style.display = '';
                DOM.resultTextContent.textContent = item.text;
            } else {
                DOM.resultText.style.display = 'none';
            }
            showView('result');
        });
        DOM.historyGrid.appendChild(div);
    });
}

// ========== 下载 ==========
function downloadImage() {
    if (!state.currentImageDataUrl) {
        showToast('没有可下载的图片', 'warning');
        return;
    }

    if (state.currentImageDataUrl.startsWith('http')) {
        window.open(state.currentImageDataUrl, '_blank');
        showToast('已在新标签页打开图片', 'info');
        return;
    }

    const link = document.createElement('a');
    link.href = state.currentImageDataUrl;

    let ext = 'png';
    if (state.currentImageDataUrl.includes('image/jpeg')) ext = 'jpg';
    if (state.currentImageDataUrl.includes('image/webp')) ext = 'webp';

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `nano-banana-${ts}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('图片已开始下载', 'success');
}

// ========== 复制 ==========
async function copyImage() {
    if (!state.currentImageDataUrl) {
        showToast('没有可复制的图片', 'warning');
        return;
    }

    try {
        let blob;
        const resp = await fetch(state.currentImageDataUrl);
        blob = await resp.blob();

        if (blob.type !== 'image/png') {
            blob = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const c = document.createElement('canvas');
                    c.width = img.width;
                    c.height = img.height;
                    c.getContext('2d').drawImage(img, 0, 0);
                    c.toBlob(resolve, 'image/png');
                };
                img.src = state.currentImageDataUrl;
            });
        }

        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('图片已复制到剪贴板', 'success');
    } catch (err) {
        console.error('复制失败:', err);
        showToast('复制失败: ' + err.message, 'error');
    }
}

// ========== 全屏 ==========
function openFullscreen() {
    if (!state.currentImageDataUrl) {
        showToast('没有可预览的图片', 'warning');
        return;
    }
    DOM.fullscreenImage.src = state.currentImageDataUrl;
    DOM.fullscreenModal.style.display = '';
    document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
    DOM.fullscreenModal.style.display = 'none';
    document.body.style.overflow = '';
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
