// --- 全局变量和常量 ---
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const saveButton = document.getElementById('save-button');
const loadInput = document.getElementById('load-input');
const clearButton = document.getElementById('clear-button');
const manualGenerateButton = document.getElementById('manual-generate-button');
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeModalButton = settingsModal.querySelector('.close-button');

// 设置项元素获取
const apiKeyInput = document.getElementById('api-key');

// 【新增/修改】URL选择和自定义输入
const apiUrlSelect = document.getElementById('api-url-select');
const customUrlInput = document.getElementById('custom-url-input');

// 【新增/修改】模型选择和自定义输入
const modelSelect = document.getElementById('model-select');
const customModelInput = document.getElementById('custom-model-input');

const temperatureSlider = document.getElementById('temperature');
const tempValueSpan = document.getElementById('temp-value');
const topPSlider = document.getElementById('top-p');
const topPValueSpan = document.getElementById('top-p-value');
const maxTokensInput = document.getElementById('max-tokens');
const stopSequencesInput = document.getElementById('stop-sequences');
const frequencyPenaltySlider = document.getElementById('frequency-penalty');
const freqPenaltyValueSpan = document.getElementById('freq-penalty-value');
const presencePenaltySlider = document.getElementById('presence-penalty');
const presPenaltyValueSpan = document.getElementById('pres-penalty-value');
const predefinedPromptSelect = document.getElementById('predefined-prompt-select');
const systemPromptInput = document.getElementById('system-prompt');
const reasoningDefaultVisibleCheckbox = document.getElementById('reasoning-default-visible');

// 移除了 const DEEPSEEK_API_BASE_URL，现在动态获取

// --- 预设提示词数据 ---
const predefinedPrompts =[
    { name: "默认助理 (通用)", content: "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information." },
    { name: "周报生成器", content: "你是一个周报生成助手，根据用户提供的工作内容，生成一份简洁、专业的周报。请注意使用书面语，突出重点，条理清晰。" },
    // 在这里可以添加更多预设提示词对象
];
const customPromptValue = "custom";

// --- 状态变量 ---
let messages = []; // 对话历史核心数据
let currentAssistantMessageId = null; // 当前 AI 消息 ID
let currentAssistantMessageDiv = null; // 当前 AI 消息 DOM
let currentReasoningDiv = null; // 当前思维链 DOM
let currentContentDiv = null; // 当前内容 DOM
let currentAbortController = null; // 中断控制器
let isUserScrolling = false; // 标记用户是否正在手动滚动
let scrollTimeout = null; // 用于检测滚动停止的计时器

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("文档加载完成，开始初始化...");
    populatePredefinedPrompts();
    loadSettings();
    loadConversationFromLocalStorage();
    addEventListeners();
    // 初始化所有滑块的显示值
    updateSliderValue(temperatureSlider, tempValueSpan);
    updateSliderValue(topPSlider, topPValueSpan);
    updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan);
    updateSliderValue(presencePenaltySlider, presPenaltyValueSpan);
    adjustTextareaHeight(userInput);
    handlePredefinedPromptChange(); // 根据加载设置更新提示词状态
    handleApiUrlChange(); // 初始化 URL 输入框状态
    handleModelChange(); // 初始化模型输入框状态
    console.log("初始化完成.");
});

// --- 填充预设提示词 ---
function populatePredefinedPrompts() {
    predefinedPrompts.forEach((prompt, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        option.textContent = prompt.name;
        predefinedPromptSelect.appendChild(option);
    });
    const customOption = document.createElement('option');
    customOption.value = customPromptValue;
    customOption.textContent = "自定义...";
    predefinedPromptSelect.appendChild(customOption);
}

// --- 事件监听器 ---
function addEventListeners() {
    sendButton.addEventListener('click', handleSendMessage);

    // 处理用户输入框的按键事件
    userInput.addEventListener('keydown', (e) => {
        // 当按下 Ctrl + Enter 时发送消息
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    userInput.addEventListener('input', () => adjustTextareaHeight(userInput));
    saveButton.addEventListener('click', saveConversationToFile);
    loadInput.addEventListener('change', loadConversationFromFile);
    clearButton.addEventListener('click', clearConversation);
    
    // 监听手动生成按钮
    if (manualGenerateButton) {
        manualGenerateButton.addEventListener('click', handleManualGenerate);
    }

    settingsButton.addEventListener('click', openSettingsModal);
    closeModalButton.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) closeSettingsModal(); });

    // 设置项变化监听
    apiKeyInput.addEventListener('change', saveSettings);
    
    // 【新增】URL 和模型变化监听
    apiUrlSelect.addEventListener('change', () => { handleApiUrlChange(); saveSettings(); });
    customUrlInput.addEventListener('change', saveSettings);
    modelSelect.addEventListener('change', () => { handleModelChange(); saveSettings(); });
    customModelInput.addEventListener('change', saveSettings);

    temperatureSlider.addEventListener('input', () => { updateSliderValue(temperatureSlider, tempValueSpan); saveSettings(); });
    topPSlider.addEventListener('input', () => { updateSliderValue(topPSlider, topPValueSpan); saveSettings(); });
    maxTokensInput.addEventListener('change', saveSettings);
    stopSequencesInput.addEventListener('change', saveSettings);
    frequencyPenaltySlider.addEventListener('input', () => { updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan); saveSettings(); });
    presencePenaltySlider.addEventListener('input', () => { updateSliderValue(presencePenaltySlider, presPenaltyValueSpan); saveSettings(); });
    predefinedPromptSelect.addEventListener('change', handlePredefinedPromptChange);
    predefinedPromptSelect.addEventListener('change', saveSettings);
    systemPromptInput.addEventListener('change', saveSettings);
    reasoningDefaultVisibleCheckbox.addEventListener('change', saveSettings);

    // 聊天容器滚动监听
    chatContainer.addEventListener('scroll', handleChatScroll);

    // 消息操作事件委托
    chatContainer.addEventListener('click', handleMessageActions);
}

// --- 界面逻辑处理函数 ---

// 【新增】处理 URL 选择变化
function handleApiUrlChange() {
    if (apiUrlSelect.value === 'custom') {
        customUrlInput.classList.remove('hidden');
    } else {
        customUrlInput.classList.add('hidden');
    }
}

// 【新增】处理模型选择变化
function handleModelChange() {
    if (modelSelect.value === 'custom') {
        customModelInput.classList.remove('hidden');
    } else {
        customModelInput.classList.add('hidden');
    }
}

// --- 处理预设提示词选择 ---
function handlePredefinedPromptChange() {
    const selectedValue = predefinedPromptSelect.value;
    if (selectedValue === customPromptValue) {
        systemPromptInput.disabled = false;
        systemPromptInput.placeholder = "在此输入自定义提示词...";
    } else {
        const index = parseInt(selectedValue, 10);
        if (!isNaN(index) && index >= 0 && index < predefinedPrompts.length) {
            systemPromptInput.value = predefinedPrompts[index].content;
            systemPromptInput.disabled = true;
            systemPromptInput.placeholder = "使用上方选择的模板";
            adjustTextareaHeight(systemPromptInput);
        } else {
            console.warn("未选择或无效的预设索引:", selectedValue);
            systemPromptInput.disabled = false; 
            systemPromptInput.value = '';
            systemPromptInput.placeholder = "选择模板或自定义...";
        }
    }
    if (selectedValue === customPromptValue) {
        systemPromptInput.disabled = false;
    }
}

// --- 核心功能 ---

/**
 * 处理发送消息
 */
async function handleSendMessage() {
    if (sendButton.disabled) {
        console.log("正在等待响应，请稍候...");
        return;
    }
    const userText = userInput.value.trim();
    if (!userText) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("请点击设置按钮 ⚙️ 输入 API Key。");
        openSettingsModal(); // 自动打开设置
        return;
    }

    const userMessage = { id: generateUniqueId('user'), role: 'user', content: userText };
    messages.push(userMessage);
    appendMessageToUI(userMessage); // 显示用户消息
    saveConversationToLocalStorage(); // 保存包含用户消息的状态

    userInput.value = ''; // 清空输入框
    adjustTextareaHeight(userInput); // 调整输入框高度

    forceScrollChatToBottom();
    toggleSendButton(false); // 禁用发送按钮

    try {
        await sendRequestToDeepSeekAPI();
    } catch (error) {
        console.error("发送或处理请求出错:", error);
        if (error.name !== 'AbortError') {
            appendErrorMessageToUI("通信出错: " + error.message);
        } else {
            console.log("请求被中止。");
             const placeholderIndex = messages.findIndex(msg => msg.id === currentAssistantMessageId && msg.content === '...');
             if (placeholderIndex !== -1) {
                 messages.splice(placeholderIndex, 1);
                 const placeholderDiv = chatContainer.querySelector(`.message[data-message-id="${currentAssistantMessageId}"]`);
                 if (placeholderDiv) placeholderDiv.remove();
                 saveConversationToLocalStorage();
             }
        }
    }
}

/**
 * 处理手动触发 AI 回复
 */
async function handleManualGenerate() {
    if (sendButton.disabled) {
        alert("AI 正在响应中，请稍候...");
        return;
    }

    if (messages.length === 0) {
        alert("当前没有对话记录，无法生成回复。");
        return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user' && lastMessage.role !== 'system') {
        alert("最后一条消息不是用户发送的。请先发送消息或删除末尾的 AI 消息后再试。");
        return;
    }

    const confirmText = "确定要基于当前的对话历史请求 AI 生成新回复吗？";
    if (!confirm(confirmText)) {
        return;
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("请点击设置按钮 ⚙️ 输入 API Key。");
        openSettingsModal();
        return;
    }

    toggleSendButton(false);
    forceScrollChatToBottom();

    try {
        await sendRequestToDeepSeekAPI(); 
    } catch (error) {
        console.error("手动请求出错:", error);
        if (error.name !== 'AbortError') {
            appendErrorMessageToUI("请求出错: " + error.message);
        }
    }
}

/**
 * 发送请求到 DeepSeek API
 */
async function sendRequestToDeepSeekAPI() {
    const apiKey = apiKeyInput.value.trim();
    
    // 【修改】获取动态 URL
    let baseUrl = apiUrlSelect.value;
    if (baseUrl === 'custom') {
        baseUrl = customUrlInput.value.trim();
        // 确保自定义 URL 不为空
        if (!baseUrl) throw new Error("请在设置中输入自定义 API 地址");
    }
    // 移除末尾的斜杠以防万一
    baseUrl = baseUrl.replace(/\/$/, '');

    // 【修改】获取动态模型
    let model = modelSelect.value;
    if (model === 'custom') {
        model = customModelInput.value.trim();
        if (!model) throw new Error("请在设置中输入自定义模型名称");
    }

    const temperature = parseFloat(temperatureSlider.value);
    const frequency_penalty = parseFloat(frequencyPenaltySlider.value);
    const systemPrompt = systemPromptInput.value.trim();
    const presence_penalty = parseFloat(presencePenaltySlider.value);
    const top_p = parseFloat(topPSlider.value);
    const max_tokens_str = maxTokensInput.value.trim();
    const max_tokens = max_tokens_str ? parseInt(max_tokens_str, 10) : null;
    const stopSequencesStr = stopSequencesInput.value.trim();
    const stop = stopSequencesStr ? stopSequencesStr.split(',').map(s => s.trim()).filter(s => s) : null;

    let apiMessages = messages.map(({ role, content }) => ({ role, content }));
    if (systemPrompt) {
        if (apiMessages.length === 0 || apiMessages[0].role !== 'system') {
            apiMessages.unshift({ role: 'system', content: systemPrompt });
        } else {
            apiMessages[0].content = systemPrompt;
        }
    }
    
     apiMessages = apiMessages.reduce((acc, current, index, arr) => {
        if (index > 0 && current.role === arr[index - 1].role && current.role !== 'system') {
             console.warn("过滤掉连续的同角色消息:", arr[index - 1], current);
             acc[acc.length - 1] = current;
        } else {
             acc.push(current);
        }
        return acc;
     }, []);

    currentAssistantMessageId = generateUniqueId('assistant');
    const assistantMessagePlaceholder = { id: currentAssistantMessageId, role: 'assistant', content: '...', reasoning_content: '' };
    messages.push(assistantMessagePlaceholder);
    saveConversationToLocalStorage();

    appendMessageToUI(assistantMessagePlaceholder, true);

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    const requestBody = {
        model: model,
        messages: apiMessages,
        temperature: temperature,
        top_p: top_p,
        max_tokens: max_tokens,
        stop: stop,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
        stream: true
    };
    
    if (requestBody.max_tokens === null || isNaN(requestBody.max_tokens) || requestBody.max_tokens <= 0) {
        delete requestBody.max_tokens;
    }
    if (requestBody.stop === null || requestBody.stop.length === 0) {
        delete requestBody.stop;
    }

    try {
        console.log("发送请求:", JSON.stringify(requestBody, null, 2), "URL:", baseUrl);
        // 【修改】使用动态获取的 baseUrl
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const detail = errorData.error?.message || errorData.message || JSON.stringify(errorData);
            throw new Error(`API 请求失败: ${response.status} ${response.statusText}. ${detail}`);
        }

        await processStream(response.body);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("请求被用户中止。");
            const msgIndex = messages.findIndex(m => m.id === currentAssistantMessageId);
            if (msgIndex !== -1) {
                 messages.splice(msgIndex, 1);
                 const msgDiv = chatContainer.querySelector(`.message[data-message-id="${currentAssistantMessageId}"]`);
                 if (msgDiv) msgDiv.remove();
            }
        } else {
            console.error("API 请求或流处理中出错:", error);
             if (currentContentDiv && document.body.contains(currentContentDiv)) {
                 currentContentDiv.textContent = `请求出错: ${error.message}`;
                 currentContentDiv.style.color = 'red';
                 const msgIndex = messages.findIndex(m => m.id === currentAssistantMessageId);
                 if (msgIndex !== -1) {
                     messages[msgIndex].content = `请求出错: ${error.message}`;
                     messages[msgIndex].role = 'error';
                 }
             } else {
                 appendErrorMessageToUI("请求出错: " + error.message);
             }
        }
        throw error;
    } finally {
         toggleSendButton(true);
         currentAssistantMessageId = null;
         currentAssistantMessageDiv = null;
         currentReasoningDiv = null;
         currentContentDiv = null;
         currentAbortController = null;
         conditionalScrollChatToBottom();
         saveConversationToLocalStorage();
         console.log("sendRequestToDeepSeekAPI finally block executed.");
    }
}

/**
 * 处理 API 返回的流式数据
 */
async function processStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let accumulatedContent = "";
    let accumulatedReasoning = "";
    let initialChunkReceived = false;
    const localMessageId = currentAssistantMessageId;

    const messageIndex = messages.findIndex(msg => msg.id === localMessageId);
    if (messageIndex === -1) return;

    while (true) {
        if (currentAbortController?.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const dataJson = line.substring(6).trim();
                if (dataJson === "[DONE]") continue;

                 try {
                     const chunk = JSON.parse(dataJson);
                     if (chunk.choices && chunk.choices.length > 0) {
                         const delta = chunk.choices[0].delta;

                          if (!initialChunkReceived && (delta.reasoning_content || delta.content)) {
                              initialChunkReceived = true;
                              if (currentContentDiv && document.body.contains(currentContentDiv) && currentContentDiv.textContent === '...') {
                                  currentContentDiv.textContent = '';
                              }
                          }

                          if (delta.reasoning_content) {
                              accumulatedReasoning += delta.reasoning_content;
                              if (messages[messageIndex]) {
                                  messages[messageIndex].reasoning_content = accumulatedReasoning;
                              }
                              if (currentReasoningDiv && document.body.contains(currentReasoningDiv)) {
                                  currentReasoningDiv.textContent = accumulatedReasoning;
                                  const toggle = currentAssistantMessageDiv?.querySelector('.reasoning-toggle');
                                  if (toggle && document.body.contains(toggle)) {
                                      if (toggle.style.display === 'none') toggle.style.display = 'block';
                                      if (!currentReasoningDiv.classList.contains('visible') && reasoningDefaultVisibleCheckbox.checked) {
                                          currentReasoningDiv.classList.add('visible');
                                      }
                                  }
                              }
                          }

                          if (delta.content) {
                              accumulatedContent += delta.content;
                              if (messages[messageIndex]) {
                                  messages[messageIndex].content = accumulatedContent;
                              }
                              if (currentContentDiv && document.body.contains(currentContentDiv)) {
                                  currentContentDiv.textContent = accumulatedContent;
                              }
                          }
                     }
                      conditionalScrollChatToBottom();
                 } catch (e) {
                     console.error("解析流 JSON 失败:", e, "数据:", dataJson);
                 }
            }
        }
    }

    if (currentContentDiv && document.body.contains(currentContentDiv)) {
        renderMarkdown(currentContentDiv, accumulatedContent);
    }
    if (currentReasoningDiv && document.body.contains(currentReasoningDiv)) {
        currentReasoningDiv.textContent = accumulatedReasoning;
        const toggle = currentAssistantMessageDiv?.querySelector('.reasoning-toggle');
        if (toggle && document.body.contains(toggle)) {
            if (!accumulatedReasoning) {
                currentReasoningDiv.classList.remove('visible');
                currentReasoningDiv.style.display = 'none';
                toggle.style.display = 'none';
            } else {
                currentReasoningDiv.style.display = '';
                toggle.style.display = 'block';
                 if (reasoningDefaultVisibleCheckbox.checked && !currentReasoningDiv.classList.contains('visible')) {
                     currentReasoningDiv.classList.add('visible');
                 }
            }
        }
    }
    saveConversationToLocalStorage();
}


// --- UI 更新 ---

/**
 * 将单条消息添加到聊天界面
 */
function appendMessageToUI(message, isStreaming = false) {
    try {
        if (!chatContainer || !document.body.contains(chatContainer)) {
            console.error("无法附加消息：聊天容器不存在。");
            return;
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role || 'unknown'}`;
        messageDiv.dataset.messageId = message.id;

        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = message.role === 'user' ? 'user-avatar.png' : 'bot-avatar.png';
        avatar.alt = message.role || 'avatar';
        avatar.onerror = () => avatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNjY2MiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjBweCIgZmlsbD0iI2ZmZiI+PzwvdGV4dD48L3N2Zz4=';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';

        let reasoningDiv = null, reasoningToggle = null;

        if (message.role === 'assistant') {
            reasoningToggle = document.createElement('span');
            reasoningToggle.className = 'reasoning-toggle';
            reasoningToggle.textContent = '显示/隐藏 思维链';
            reasoningToggle.dataset.targetId = `reasoning-${message.id}`;
            reasoningToggle.style.display = (message.reasoning_content || isStreaming) ? 'block' : 'none';
            contentWrapper.appendChild(reasoningToggle);

            reasoningDiv = document.createElement('div');
            reasoningDiv.className = 'reasoning-content';
            reasoningDiv.id = `reasoning-${message.id}`;
            reasoningDiv.textContent = message.reasoning_content || '';
            if ((reasoningDefaultVisibleCheckbox.checked && (message.reasoning_content || isStreaming))) {
                reasoningDiv.classList.add('visible');
            }
            if (!isStreaming && !message.reasoning_content) {
                 reasoningDiv.style.display = 'none';
            }
            contentWrapper.appendChild(reasoningDiv);
        }

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';

        const actualContentDiv = document.createElement('div');
        actualContentDiv.className = 'actual-content';

        if (isStreaming && message.role === 'assistant') {
            currentAssistantMessageDiv = messageDiv;
            currentReasoningDiv = reasoningDiv;
            currentContentDiv = actualContentDiv;
            actualContentDiv.textContent = message.content;
        } else if (message.role === 'assistant') {
            renderMarkdown(actualContentDiv, message.content);
        } else {
             actualContentDiv.textContent = message.content;
        }

        messageBubble.appendChild(actualContentDiv);
        contentWrapper.appendChild(messageBubble);

        const actionsDiv = createMessageActions(message.id, message.role);
        contentWrapper.appendChild(actionsDiv);

        messageDiv.append(avatar, contentWrapper);
        chatContainer.appendChild(messageDiv);

        conditionalScrollChatToBottom();

    } catch (error) {
        console.error("添加到 UI 时出错:", error, "消息:", message);
        appendErrorMessageToUI("显示消息时出错: " + error.message);
    }
}

/**
 * 创建消息的操作按钮区域
 */
function createMessageActions(messageId, role) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';

    const editBtn = document.createElement('i');
    editBtn.className = 'fas fa-pencil-alt action-icon edit-btn';
    editBtn.title = '编辑';
    editBtn.dataset.action = 'edit';
    actionsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement('i');
    deleteBtn.className = 'fas fa-trash-alt action-icon delete-btn';
    deleteBtn.title = '删除';
    deleteBtn.dataset.action = 'delete';
    actionsDiv.appendChild(deleteBtn);

    if (role === 'assistant') {
        const regenerateBtn = document.createElement('i');
        regenerateBtn.className = 'fas fa-sync-alt action-icon regenerate-btn';
        regenerateBtn.title = '重新生成';
        regenerateBtn.dataset.action = 'regenerate';
        actionsDiv.appendChild(regenerateBtn);
    }
    return actionsDiv;
}


/**
 * 将错误信息添加到聊天界面
 */
function appendErrorMessageToUI(errorText) {
    try {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error';
        errorDiv.style.cssText = `
            color: #dc3545; /* 红色文字 */
            background-color: #f8d7da; /* 淡红色背景 */
            border: 1px solid #f5c6cb; /* 红色边框 */
            border-radius: 8px;
            padding: 10px 15px;
            margin-top: 10px;
            align-self: center; /* 居中显示 */
            max-width: 80%;
            word-wrap: break-word;
        `;
        errorDiv.textContent = `错误：${errorText}`;

        if (chatContainer && document.body.contains(chatContainer)) {
            chatContainer.appendChild(errorDiv);
            conditionalScrollChatToBottom();
        } else {
            console.error("无法添加错误消息 UI：聊天容器不存在。错误信息:", errorText);
        }
    } catch(uiError) {
        console.error("在 appendErrorMessageToUI 中发生错误:", uiError);
    }
}


/**
 * 条件滚动：仅当用户视口接近底部时才滚动
 */
function conditionalScrollChatToBottom() {
    if (!chatContainer) return;
    const threshold = 50;
    const isNearBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + threshold;

    if (!isUserScrolling && isNearBottom) {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    }
}

/**
 * 强制滚动到底部
 */
 function forceScrollChatToBottom() {
    if (chatContainer) {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        console.log("Forced scroll executed.");
    }
 }


/**
 * 处理聊天容器滚动事件，标记用户是否在滚动
 */
function handleChatScroll() {
    if (!chatContainer) return;
    isUserScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
    }, 150);
}


/**
 * 更新滑块旁边显示的数值
 */
function updateSliderValue(slider, valueSpan) {
    if(slider && valueSpan) {
        valueSpan.textContent = slider.value;
    }
}

/**
 * 切换发送按钮的启用/禁用状态和样式
 */
function toggleSendButton(enabled) {
     if (sendButton) {
         sendButton.disabled = !enabled;
         sendButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
         sendButton.style.opacity = enabled ? '1' : '0.6';
     }

     if (manualGenerateButton) {
         manualGenerateButton.disabled = !enabled;
         manualGenerateButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
         manualGenerateButton.style.opacity = enabled ? '1' : '0.6';
     }
}

/**
 * 动态调整文本输入框的高度
 */
function adjustTextareaHeight(textarea) {
    if(textarea) {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeightStyle = window.getComputedStyle(textarea).maxHeight;
        const maxHeight = parseInt(maxHeightStyle, 10) || 150;

        textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
}

/**
 * 使用 marked.js 渲染 Markdown 文本到指定元素
 */
function renderMarkdown(element, markdownText) {
    if (element) {
        if (typeof marked === 'undefined') {
            console.error('Marked.js library is not loaded!');
            element.textContent = markdownText || '';
            return;
        }
        try {
            const htmlContent = marked.parse(markdownText || '');
            element.innerHTML = htmlContent;
        } catch (error) {
            console.error("Markdown 渲染失败:", error);
            element.textContent = `--- Markdown渲染出错 ---\n${markdownText || ''}`;
        }
    } else {
        console.warn("尝试渲染 Markdown 但目标元素无效。");
    }
}


// --- 消息操作处理 ---

/**
 * 处理消息操作按钮点击
 */
function handleMessageActions(event) {
     const target = event.target;

    if (target.classList.contains('reasoning-toggle')) {
        const targetId = target.dataset.targetId;
        const reasoningDiv = document.getElementById(targetId);
        if (reasoningDiv) {
            reasoningDiv.classList.toggle('visible');
        }
        return;
    }

    if (!target.classList.contains('action-icon')) return;

    const contentWrapper = target.closest('.message-content-wrapper');
    if (!contentWrapper) return;
    const messageDiv = contentWrapper.closest('.message');
    if (!messageDiv) return;
    const messageId = messageDiv.dataset.messageId;
    const action = target.dataset.action;

    switch (action) {
        case 'edit':
            handleEdit(messageId, messageDiv, contentWrapper);
            break;
        case 'delete':
            handleDelete(messageId, messageDiv);
            break;
        case 'regenerate':
            handleRegenerate(messageId);
            break;
    }
}


/**
 * 处理编辑消息
 */
function handleEdit(messageId, messageDiv, contentWrapper) {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];
    const messageBubble = contentWrapper.querySelector('.message-bubble');
    const contentDiv = messageBubble?.querySelector('.actual-content');
    const actionsDiv = contentWrapper.querySelector('.message-actions');

    if (!messageBubble || !contentDiv || messageBubble.classList.contains('editing')) return;

    if (actionsDiv) actionsDiv.style.display = 'none';

    const originalContent = message.content;
    messageBubble.classList.add('editing');

    const editTextArea = document.createElement('textarea');
    editTextArea.className = 'edit-textarea';
    editTextArea.value = originalContent;
    editTextArea.addEventListener('input', () => adjustTextareaHeight(editTextArea));

    const editActionsDiv = document.createElement('div');
    editActionsDiv.className = 'edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'save-edit-btn';
    saveBtn.onclick = () => {
        const newContent = editTextArea.value.trim();
        if (newContent && newContent !== originalContent) {
            messages[messageIndex].content = newContent;
            renderMarkdown(contentDiv, newContent);
            saveConversationToLocalStorage();
        } else {
            renderMarkdown(contentDiv, originalContent);
        }
        if (messageBubble.contains(editTextArea)) messageBubble.removeChild(editTextArea);
        if (messageBubble.contains(editActionsDiv)) messageBubble.removeChild(editActionsDiv);
        if (!messageBubble.contains(contentDiv)) messageBubble.appendChild(contentDiv);
        messageBubble.classList.remove('editing');
        if (actionsDiv) actionsDiv.style.display = '';
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'cancel-edit-btn';
    cancelBtn.onclick = () => {
        renderMarkdown(contentDiv, originalContent);
        if (messageBubble.contains(editTextArea)) messageBubble.removeChild(editTextArea);
        if (messageBubble.contains(editActionsDiv)) messageBubble.removeChild(editActionsDiv);
        if (!messageBubble.contains(contentDiv)) messageBubble.appendChild(contentDiv);
        messageBubble.classList.remove('editing');
        if (actionsDiv) actionsDiv.style.display = '';
    };

    editActionsDiv.append(saveBtn, cancelBtn);

    if (messageBubble.contains(contentDiv)) messageBubble.removeChild(contentDiv);
    messageBubble.append(editTextArea, editActionsDiv);

    adjustTextareaHeight(editTextArea);
    editTextArea.focus();
    editTextArea.select();
}


/**
 * 处理删除单条消息
 */
function handleDelete(messageId, messageDiv) {
    if (!document.body.contains(messageDiv)) return;

    if (confirm("确定删除这条消息?")) {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            messages.splice(messageIndex, 1);
            saveConversationToLocalStorage();
        }

        messageDiv.style.opacity = '0';
        messageDiv.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
             if (messageDiv.parentNode) {
                messageDiv.remove();
             }
        }, 300);
    }
}


/**
 * 处理重新生成 AI 消息
 */
async function handleRegenerate(messageId) {
     if (sendButton.disabled) {
         alert("请等待当前响应完成。");
         return;
     }

    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1 || messages[messageIndex].role !== 'assistant') {
        return;
    }

    const messagesToDeleteCount = messages.length - 1 - messageIndex;
    let userConfirmed = true;

    if (messagesToDeleteCount > 0) {
        userConfirmed = confirm(`重新生成这条回复将会删除其后的 ${messagesToDeleteCount} 条对话记录。\n确定要继续吗？`);
    }

    if (userConfirmed) {
        if (messagesToDeleteCount > 0) {
            const deletedMessages = messages.splice(messageIndex + 1);
            deletedMessages.forEach(deletedMsg => {
                const msgDiv = chatContainer?.querySelector(`.message[data-message-id="${deletedMsg.id}"]`);
                if (msgDiv?.parentNode) {
                    msgDiv.remove();
                }
            });
        }

        const messagesToSend = messages.slice(0, messageIndex);
        messages = messagesToSend;

        saveConversationToLocalStorage();

        const aiMessageDiv = chatContainer?.querySelector(`.message[data-message-id="${messageId}"]`);
        if (aiMessageDiv?.parentNode) {
            aiMessageDiv.remove();
        }

        toggleSendButton(false);
        try {
            await sendRequestToDeepSeekAPI();
        } catch (error) {
            console.error("重新生成出错:", error);
        }
    }
}


// --- 对话存储与加载 ---

/**
 * 保存对话到 JSON 文件
 */
function saveConversationToFile() {
    if (messages.length === 0) {
        alert("对话为空，无需保存。");
        return;
    }
    try {
        const settingsToSave = getCurrentSettings();
        const conversationData = {
            version: 1,
            timestamp: new Date().toISOString(),
            settings: settingsToSave,
            history: messages
        };
        const jsonString = JSON.stringify(conversationData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepseek_chat_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("保存对话到文件失败:", error);
        alert("保存失败: " + error.message);
    }
}

/**
 * 从 JSON 文件加载对话
 */
function loadConversationFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("加载新对话将覆盖当前对话和设置，确定要继续吗？")) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let loadedData = JSON.parse(e.target.result);
            if (!loadedData || !(typeof loadedData === 'object')) throw new Error("无效JSON");
            
            if (!Array.isArray(loadedData.history)) {
                 if(Array.isArray(loadedData)) {
                     loadedData = { history: loadedData, settings: null };
                 } else {
                     throw new Error("格式无效");
                 }
            }

            messages = loadedData.history.map(msg => ({
                ...msg,
                id: msg.id || generateUniqueId(msg.role || 'unknown')
            }));

            if (chatContainer) chatContainer.innerHTML = '';

            if (loadedData.settings && typeof loadedData.settings === 'object') {
                applySettings(loadedData.settings);
                saveSettings();
            }

            messages.forEach(msg => appendMessageToUI(msg));
            saveConversationToLocalStorage();
            conditionalScrollChatToBottom();
            alert("对话加载成功！");

        } catch (error) {
            console.error("加载对话文件失败:", error);
            alert("加载失败: " + error.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

/**
 * 保存对话到 LocalStorage
 */
function saveConversationToLocalStorage() {
    try {
        localStorage.setItem('deepseekChatHistory', JSON.stringify(messages));
    } catch (error) {
        console.error("保存对话到 LocalStorage 失败:", error);
    }
}

/**
 * 从 LocalStorage 加载对话
 */
function loadConversationFromLocalStorage() {
    try {
        const savedHistory = localStorage.getItem('deepseekChatHistory');
        if (savedHistory) {
             let parsedHistory; try { parsedHistory = JSON.parse(savedHistory); } catch { throw new Error("格式无效"); }
             if (!Array.isArray(parsedHistory)) throw new Error("不是数组");

            messages = parsedHistory.map(msg => ({
                ...msg,
                id: msg.id || generateUniqueId(msg.role || 'unknown')
            }));

            if (chatContainer) chatContainer.innerHTML = '';
            messages.forEach(msg => appendMessageToUI(msg));
            conditionalScrollChatToBottom();
        }
    } catch (error) {
        console.error("从 LocalStorage 加载历史记录失败:", error);
        localStorage.removeItem('deepseekChatHistory');
        messages = [];
        if (chatContainer) chatContainer.innerHTML = '';
    }
}

/**
 * 清空对话
 */
function clearConversation() {
    if (sendButton?.disabled && currentAbortController) {
        if (!confirm("AI 正在响应中，确定要中止并清空所有对话记录吗？")) return;
        currentAbortController.abort("User cleared conversation.");
    } else if (messages.length === 0) {
        alert("对话已经为空。");
        return;
    } else {
        if (!confirm("确定要清空所有对话记录吗？此操作不可恢复。")) return;
    }

    messages = [];
    currentAssistantMessageId = null;
    currentAssistantMessageDiv = null;
    currentReasoningDiv = null;
    currentContentDiv = null;
    currentAbortController = null;
    toggleSendButton(true);

    if (chatContainer) chatContainer.innerHTML = '';
    saveConversationToLocalStorage();
}


// --- 设置管理 ---

/**
 * 获取当前界面的所有设置项值
 */
function getCurrentSettings() {
    const settings = {
        // 【修改】保存新的设置项
        apiUrl: apiUrlSelect.value,
        customUrl: customUrlInput.value,
        model: modelSelect.value,
        customModel: customModelInput.value,
        
        temperature: parseFloat(temperatureSlider.value),
        top_p: parseFloat(topPSlider.value),
        max_tokens: maxTokensInput.value ? parseInt(maxTokensInput.value, 10) : null,
        stop: stopSequencesInput.value.trim() ? stopSequencesInput.value.split(',').map(s => s.trim()).filter(s => s) : null,
        frequency_penalty: parseFloat(frequencyPenaltySlider.value),
        presence_penalty: parseFloat(presencePenaltySlider.value),
        selectedPromptValue: predefinedPromptSelect.value,
        systemPromptContent: systemPromptInput.value,
        reasoningDefaultVisible: reasoningDefaultVisibleCheckbox.checked
    };

    if (settings.max_tokens !== null && (isNaN(settings.max_tokens) || settings.max_tokens < 1)) {
        settings.max_tokens = null;
    }
    return settings;
}

/**
 * 将设置对象应用到界面控件
 */
function applySettings(settings) {
    // 【修改】应用新的设置项
    if (settings.apiUrl !== undefined) apiUrlSelect.value = settings.apiUrl;
    if (settings.customUrl !== undefined) customUrlInput.value = settings.customUrl;
    if (settings.model !== undefined) modelSelect.value = settings.model;
    if (settings.customModel !== undefined) customModelInput.value = settings.customModel;
    
    // 处理界面显示状态
    handleApiUrlChange();
    handleModelChange();

    if (settings.temperature !== undefined) { temperatureSlider.value = settings.temperature; updateSliderValue(temperatureSlider, tempValueSpan); }
    if (settings.top_p !== undefined) { topPSlider.value = settings.top_p; updateSliderValue(topPSlider, topPValueSpan); }
    if (settings.max_tokens !== undefined && settings.max_tokens !== null) maxTokensInput.value = settings.max_tokens; else maxTokensInput.value = '';
    if (settings.stop !== undefined && settings.stop !== null && Array.isArray(settings.stop)) stopSequencesInput.value = settings.stop.join(','); else stopSequencesInput.value = '';
    if (settings.frequency_penalty !== undefined) { frequencyPenaltySlider.value = settings.frequency_penalty; updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan); }
    if (settings.presence_penalty !== undefined) { presencePenaltySlider.value = settings.presence_penalty; updateSliderValue(presencePenaltySlider, presPenaltyValueSpan); }

    if (settings.selectedPromptValue !== undefined) {
        const isValidOption = Array.from(predefinedPromptSelect.options).some(opt => opt.value === settings.selectedPromptValue);
        if (isValidOption) {
            predefinedPromptSelect.value = settings.selectedPromptValue;
            handlePredefinedPromptChange();
            if (settings.selectedPromptValue === customPromptValue && settings.systemPromptContent !== undefined) {
                 systemPromptInput.value = settings.systemPromptContent;
                 adjustTextareaHeight(systemPromptInput);
            }
        } else {
            predefinedPromptSelect.selectedIndex = 0;
            handlePredefinedPromptChange();
        }
    } else {
        predefinedPromptSelect.selectedIndex = 0;
        handlePredefinedPromptChange();
    }

    if (settings.reasoningDefaultVisible !== undefined) {
        reasoningDefaultVisibleCheckbox.checked = settings.reasoningDefaultVisible;
    }
}

/**
 * 应用默认设置到界面
 */
function applyDefaultSettings() {
    console.log("应用默认设置。");
    apiUrlSelect.value = "https://api.deepseek.com"; // 默认标准版
    customUrlInput.value = "";
    modelSelect.value = "deepseek-reasoner";
    customModelInput.value = "";
    
    handleApiUrlChange();
    handleModelChange();

    temperatureSlider.value = 0.7; updateSliderValue(temperatureSlider, tempValueSpan);
    topPSlider.value = 1.0; updateSliderValue(topPSlider, topPValueSpan);
    maxTokensInput.value = '';
    stopSequencesInput.value = '';
    frequencyPenaltySlider.value = 0.5; updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan);
    presencePenaltySlider.value = 0.0; updateSliderValue(presencePenaltySlider, presPenaltyValueSpan);
    predefinedPromptSelect.selectedIndex = 0;
    handlePredefinedPromptChange();
    reasoningDefaultVisibleCheckbox.checked = true;
}


/**
 * 保存当前设置到 LocalStorage
 */
function saveSettings() {
    try {
        const currentSettings = getCurrentSettings();
        currentSettings.apiKey = apiKeyInput.value.trim();
        localStorage.setItem('deepseekChatSettings', JSON.stringify(currentSettings));
    } catch (error) {
        console.error("保存设置到 LocalStorage 失败:", error);
    }
}

/**
 * 从 LocalStorage 加载设置
 */
function loadSettings() {
     try {
        const savedSettings = localStorage.getItem('deepseekChatSettings');
        if (savedSettings) {
            const loadedSettings = JSON.parse(savedSettings);
            applySettings(loadedSettings);
            if (loadedSettings.apiKey) {
                apiKeyInput.value = loadedSettings.apiKey;
            }
        } else {
            applyDefaultSettings();
        }
    } catch (error) {
        localStorage.removeItem('deepseekChatSettings');
        applyDefaultSettings();
    }
}

// --- 设置弹窗控制 ---
function openSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'block';
}
function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'none';
}

// --- 工具函数 ---
function generateUniqueId(prefix = 'msg') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}