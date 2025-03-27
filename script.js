// --- 全局变量和常量 ---
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const saveButton = document.getElementById('save-button');
const loadInput = document.getElementById('load-input');
const clearButton = document.getElementById('clear-button');
const settingsButton = document.getElementById('settings-button'); // 设置按钮
const settingsModal = document.getElementById('settings-modal'); // 设置弹窗
const closeModalButton = settingsModal.querySelector('.close-button'); // 关闭弹窗按钮

// 设置项元素 (在弹窗内)
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const temperatureSlider = document.getElementById('temperature');
const tempValueSpan = document.getElementById('temp-value');
const frequencyPenaltySlider = document.getElementById('frequency-penalty');
const penaltyValueSpan = document.getElementById('penalty-value');
const predefinedPromptSelect = document.getElementById('predefined-prompt-select'); // 预设提示词下拉框
const systemPromptInput = document.getElementById('system-prompt');
const reasoningDefaultVisibleCheckbox = document.getElementById('reasoning-default-visible');

const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com'; // DeepSeek API Base URL

// --- 预设提示词数据 ---
const predefinedPrompts = [
    { name: "默认助理 (通用)", content: "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information." },
    { name: "代码助手 (精简)", content: "You are an AI programming assistant. Follow the user's requirements carefully & to the letter. First, think step-by-step for internal thought process. Then, write code in the requested language. Ensure code correctness and efficiency. Minimize conversational preamble." },
    { name: "翻译专家 (中英互译)", content: "You are a professional translator. Translate the user's text between Chinese and English accurately and naturally. Maintain the original meaning and tone. If the language is ambiguous, ask for clarification. Only provide the translation, no extra explanations unless asked." },
    { name: "周报生成器", content: "你是一个周报生成助手，根据用户提供的工作内容，生成一份简洁、专业的周报。请注意使用书面语，突出重点，条理清晰。" },
    // --- 在这里添加更多预设提示词 ---
];
const customPromptValue = "custom"; // 特殊值，表示用户选择了自定义


let messages = []; // 存储对话历史 { id, role, content, reasoning_content }
let currentAssistantMessageId = null; // 当前正在流式输出的AI消息ID
let currentAssistantMessageDiv = null; // 当前正在更新的AI消息DOM元素
let currentReasoningDiv = null; // 当前AI消息的思维链DOM元素
let currentContentDiv = null; // 当前AI消息的最终内容DOM元素
let currentAbortController = null; // 用于中断 fetch 请求

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("文档加载完成，开始初始化...");
    populatePredefinedPrompts();
    loadSettings();
    loadConversationFromLocalStorage();
    addEventListeners();
    updateSliderValue(temperatureSlider, tempValueSpan);
    updateSliderValue(frequencyPenaltySlider, penaltyValueSpan);
    adjustTextareaHeight(userInput);
    handlePredefinedPromptChange(); // 根据加载的设置（或默认）更新文本域状态
    console.log("初始化完成.");
});

// --- 填充预设提示词下拉框 ---
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
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.addEventListener('input', () => adjustTextareaHeight(userInput));

    saveButton.addEventListener('click', saveConversationToFile);
    loadInput.addEventListener('change', loadConversationFromFile);
    clearButton.addEventListener('click', clearConversation); // 修改点：指向修复后的 clearConversation

    // 设置按钮和弹窗相关事件
    settingsButton.addEventListener('click', openSettingsModal);
    closeModalButton.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            closeSettingsModal();
        }
    });

    // 预设提示词和设置项监听
    predefinedPromptSelect.addEventListener('change', handlePredefinedPromptChange);
    predefinedPromptSelect.addEventListener('change', saveSettings);
    apiKeyInput.addEventListener('change', saveSettings);
    modelSelect.addEventListener('change', saveSettings);
    temperatureSlider.addEventListener('input', () => { updateSliderValue(temperatureSlider, tempValueSpan); saveSettings(); });
    frequencyPenaltySlider.addEventListener('input', () => { updateSliderValue(frequencyPenaltySlider, penaltyValueSpan); saveSettings(); });
    systemPromptInput.addEventListener('change', saveSettings);
    reasoningDefaultVisibleCheckbox.addEventListener('change', saveSettings);

    // 消息操作事件委托
    chatContainer.addEventListener('click', handleMessageActions);
}

// --- 处理预设提示词选择变化 ---
function handlePredefinedPromptChange() {
    const selectedValue = predefinedPromptSelect.value;
    if (selectedValue === customPromptValue) {
        systemPromptInput.disabled = false;
        systemPromptInput.placeholder = "在此输入自定义提示词...";
        systemPromptInput.focus();
    } else {
        const index = parseInt(selectedValue, 10);
        if (!isNaN(index) && index >= 0 && index < predefinedPrompts.length) {
            systemPromptInput.value = predefinedPrompts[index].content;
            systemPromptInput.disabled = true;
            systemPromptInput.placeholder = "使用上方选择的模板";
            adjustTextareaHeight(systemPromptInput);
        } else {
            console.warn("无效的预设提示词索引:", selectedValue);
            systemPromptInput.disabled = false;
            systemPromptInput.placeholder = "选择模板或自定义...";
        }
    }
}


// --- 核心功能 ---

/**
 * 处理发送消息的逻辑
 */
async function handleSendMessage() {
    const userText = userInput.value.trim();
    if (!userText) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("请点击右上角的设置按钮 ⚙️，输入您的 DeepSeek API Key。");
        openSettingsModal();
        return;
    }

    // 检查发送按钮是否被禁用，防止重复发送
    if (sendButton.disabled) {
        console.log("正在处理上一条消息，请稍候...");
        return;
    }


    const userMessage = {
        id: generateUniqueId('user'),
        role: 'user',
        content: userText
    };
    messages.push(userMessage);
    appendMessageToUI(userMessage);
    saveConversationToLocalStorage();

    userInput.value = '';
    adjustTextareaHeight(userInput);
    scrollChatToBottom();
    toggleSendButton(false); // 禁用按钮

    try {
        await sendRequestToDeepSeekAPI();
    } catch (error) {
        console.error("发送或处理请求时出错:", error); // 更通用的错误日志
        // 只有在非用户主动中止的情况下才显示 UI 错误
        if (error.name !== 'AbortError') {
             appendErrorMessageToUI("与 DeepSeek API 通信时出错: " + error.message);
        } else {
            console.log("请求被用户中止。"); // 明确是中止操作
        }
        // 错误发生时，也需要确保按钮被重新启用
         toggleSendButton(true);
         // 并清理状态变量，以防部分流式处理后出错
         currentAssistantMessageId = null;
         currentAssistantMessageDiv = null;
         currentReasoningDiv = null;
         currentContentDiv = null;
         currentAbortController = null;
    }
    // 注意：成功完成时的状态清理现在移到 sendRequestToDeepSeekAPI 的 finally 块中
}

/**
 * 发送请求到 DeepSeek API 并处理流式响应
 */
async function sendRequestToDeepSeekAPI() {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const temperature = parseFloat(temperatureSlider.value);
    const frequency_penalty = parseFloat(frequencyPenaltySlider.value);
    const systemPrompt = systemPromptInput.value.trim();

    const apiMessages = messages.map(({ role, content }) => ({ role, content }));

    if (systemPrompt) {
        apiMessages.unshift({ role: 'system', content: systemPrompt });
    }

    // --- 创建新的AI消息状态 ---
    currentAssistantMessageId = generateUniqueId('assistant');
    const assistantMessagePlaceholder = {
        id: currentAssistantMessageId,
        role: 'assistant',
        content: '...',
        reasoning_content: ''
    };
    // appendMessageToUI 会设置 currentAssistantMessageDiv, currentReasoningDiv, currentContentDiv
    appendMessageToUI(assistantMessagePlaceholder, true);

    currentAbortController = new AbortController(); // 创建新的 AbortController
    const signal = currentAbortController.signal;

    try {
        console.log("发送请求到 DeepSeek API:", { model, messages: apiMessages.length, temperature, frequency_penalty });
        const response = await fetch(`${DEEPSEEK_API_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
                temperature: temperature,
                frequency_penalty: frequency_penalty,
                stream: true
            }),
            signal: signal // 关联 AbortController
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API 请求失败: ${response.status} ${response.statusText}. ${errorData.error?.message || errorData.message || ''}`);
        }

        // --- 处理流式响应 ---
        await processStream(response.body);

    } catch (error) {
        // 在 catch 块中，如果是因为 AbortError，通常是预期的（例如用户点击停止或清空）
        if (error.name === 'AbortError') {
            console.log('Fetch 请求被中止:', error.message);
            // 如果中止发生在流式输出期间，可能需要在UI上显示一个中止标记
            if (currentContentDiv) {
                // 检查 currentContentDiv 是否还存在于 DOM 中
                if (document.body.contains(currentContentDiv)) {
                     currentContentDiv.textContent += " (已中止)";
                     currentContentDiv.style.opacity = '0.7'; // 例如，视觉上标记中止
                }
            }
        } else {
            // 对于其他错误，记录并可能在UI上显示
            console.error("API 请求或流处理失败:", error);
            if (currentContentDiv && document.body.contains(currentContentDiv)) {
                 currentContentDiv.textContent = `请求错误: ${error.message}`;
                 currentContentDiv.style.color = 'red';
            } else if (!document.body.contains(currentAssistantMessageDiv)){
                 // 如果连占位符都被清了，就追加一个独立的错误消息
                 appendErrorMessageToUI(`API 请求处理失败: ${error.message}`);
            }
        }
        // 抛出错误，让 handleSendMessage 的 catch 处理UI提示和状态重置
        throw error;
    } finally {
        // --- 清理本次请求的状态 ---
        // 无论成功、失败还是中止，最后都应该清理状态并确保按钮可用
         toggleSendButton(true); // 确保按钮最终可用
         currentAssistantMessageId = null;
         currentAssistantMessageDiv = null;
         currentReasoningDiv = null;
         currentContentDiv = null;
         currentAbortController = null;
         scrollChatToBottom(); // 确保滚动到底部
         saveConversationToLocalStorage(); // 保存最终状态（包括可能的中止标记或错误）
         console.log("sendRequestToDeepSeekAPI finally block executed.");
    }
}

/**
 * 处理 API 返回的流式数据
 * @param {ReadableStream} stream - fetch 返回的 ReadableStream
 */
async function processStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let accumulatedContent = "";
    let accumulatedReasoning = "";
    let initialChunkReceived = false;
    const localMessageId = currentAssistantMessageId; // 捕获当前ID，防止并发问题

    console.log("开始处理流...");

    while (true) {
         // 在读取前检查是否已被中止
        if (currentAbortController && currentAbortController.signal.aborted) {
            console.log("检测到中止信号，停止处理流。");
            // 可能需要更新UI以反映中止状态，或者依赖 finally 块
            break; // 退出循环
        }

        const { done, value } = await reader.read();
        if (done) {
            console.log("流处理完成.");
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const dataJson = line.substring(6).trim();
                if (dataJson === "[DONE]") {
                    console.log("收到 [DONE] 标记");
                    continue;
                }
                try {
                    const chunk = JSON.parse(dataJson);
                    if (chunk.choices && chunk.choices.length > 0) {
                        const delta = chunk.choices[0].delta;

                        // 检查是否仍在处理同一个消息
                        if (currentAssistantMessageId !== localMessageId) {
                            console.warn("消息 ID 已更改，停止更新旧消息的 UI。");
                            return; // 停止处理这个流
                        }

                         if (!initialChunkReceived && (delta.reasoning_content || delta.content)) {
                            initialChunkReceived = true;
                             // 确保 currentContentDiv 存在再操作
                             if (currentContentDiv && document.body.contains(currentContentDiv) && currentContentDiv.textContent === '思考中...') {
                                currentContentDiv.textContent = '';
                            }
                        }

                        if (delta.reasoning_content) {
                            accumulatedReasoning += delta.reasoning_content;
                            // 确保 currentReasoningDiv 存在再操作
                            if (currentReasoningDiv && document.body.contains(currentReasoningDiv)) {
                                currentReasoningDiv.textContent = accumulatedReasoning;
                                const toggle = currentAssistantMessageDiv?.querySelector('.reasoning-toggle');
                                // 确保 toggle 存在再操作
                                if(toggle && document.body.contains(toggle)) {
                                    if (toggle.style.display === 'none') {
                                        toggle.style.display = 'block';
                                    }
                                    if (!currentReasoningDiv.classList.contains('visible') && reasoningDefaultVisibleCheckbox.checked) {
                                        currentReasoningDiv.classList.add('visible');
                                    }
                                }
                            }
                        }
                        if (delta.content) {
                            accumulatedContent += delta.content;
                             // 确保 currentContentDiv 存在再操作
                            if (currentContentDiv && document.body.contains(currentContentDiv)) {
                                currentContentDiv.textContent = accumulatedContent;
                            }
                        }
                    }
                     scrollChatToBottom();
                } catch (e) {
                    console.error("解析流数据 JSON 失败:", e, "原始数据:", dataJson);
                }
            }
        }
    }

    // --- 流处理循环结束后 ---
     // 再次检查是否仍在处理同一个消息
    if (currentAssistantMessageId !== localMessageId) {
        console.warn("消息 ID 已更改，跳过最终更新。");
        return;
    }

    // 更新 messages 数组中的对应项
    const messageIndex = messages.findIndex(msg => msg.id === localMessageId);
    if (messageIndex !== -1) {
        messages[messageIndex].content = accumulatedContent;
        messages[messageIndex].reasoning_content = accumulatedReasoning;
        console.log("更新消息数组:", messages[messageIndex]);

        // 渲染最终 Markdown 和处理 reasoning 显隐 (检查元素是否存在)
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
                 }
             }
         }

    } else {
        // 如果消息在处理过程中被删除了（例如，用户快速删除了AI的占位符）
        console.warn("无法找到要更新的 AI 消息（可能已被删除），ID:", localMessageId);
    }
}

// --- UI 更新 ---

/**
 * 将单条消息添加到聊天界面
 * (添加 DOM 存在性检查和错误处理)
 */
function appendMessageToUI(message, isStreaming = false) {
    try {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', message.role);
        messageDiv.dataset.messageId = message.id;

        const avatar = document.createElement('img');
        avatar.classList.add('avatar');
        avatar.src = message.role === 'user' ? 'user-avatar.png' : 'bot-avatar.png';
        avatar.alt = message.role;
        avatar.onerror = () => {
            console.warn(`无法加载头像: ${avatar.src}`);
            avatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjY2NjIj4KICAgIDxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQxIDAtOC0zLjU5LTgtOHMzLjU5LTggOC04IDggMy41OSA4IDgtMy41OSA4LTggOHoiLz4KICAgIDxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjUiLz4KPC9zdmc+Cg=='; // 默认占位符
        };

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('message-content-wrapper');

        let reasoningDiv = null;
        let reasoningToggle = null;
        if (message.role === 'assistant') {
            reasoningToggle = document.createElement('span');
            reasoningToggle.classList.add('reasoning-toggle');
            reasoningToggle.textContent = '显示/隐藏 思维链';
            reasoningToggle.dataset.targetId = `reasoning-${message.id}`;
            reasoningToggle.style.display = (message.reasoning_content || isStreaming) ? 'block' : 'none';
            contentWrapper.appendChild(reasoningToggle);

            reasoningDiv = document.createElement('div');
            reasoningDiv.classList.add('reasoning-content');
            reasoningDiv.id = `reasoning-${message.id}`;
            reasoningDiv.textContent = message.reasoning_content || '';
            if ((isStreaming && reasoningDefaultVisibleCheckbox.checked) || (!isStreaming && message.reasoning_content && reasoningDefaultVisibleCheckbox.checked)) {
                reasoningDiv.classList.add('visible');
            }
            if (!isStreaming && !message.reasoning_content) {
                reasoningDiv.style.display = 'none';
            }
            contentWrapper.appendChild(reasoningDiv);
        }

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        const actualContentDiv = document.createElement('div');
        actualContentDiv.classList.add('actual-content');

        if (isStreaming && message.role === 'assistant') {
             // --- 更新全局状态 ---
            currentAssistantMessageId = message.id; // 确保 ID 正确
            currentAssistantMessageDiv = messageDiv;
            currentReasoningDiv = reasoningDiv;     // 可能为 null
            currentContentDiv = actualContentDiv;
            actualContentDiv.textContent = '思考中...';
        } else {
            renderMarkdown(actualContentDiv, message.content);
        }

        messageBubble.appendChild(actualContentDiv);
        contentWrapper.appendChild(messageBubble);

        const actionsDiv = createMessageActions(message.id, message.role);
        contentWrapper.appendChild(actionsDiv);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentWrapper);

        // 确保 chatContainer 存在再添加
        if (chatContainer) {
             chatContainer.appendChild(messageDiv);
             scrollChatToBottom();
        } else {
             console.error("无法找到 chatContainer 来添加消息。");
        }

    } catch (error) {
        console.error("添加到 UI 时出错:", error, "消息:", message);
        // 可以在这里尝试添加一个错误提示，但要小心不要再次触发错误
        appendErrorMessageToUI(`渲染消息 ${message.id} 时出错: ${error.message}`);
    }
}

/**
 * 创建消息的操作按钮区域 (无修改)
 */
function createMessageActions(messageId, role) {
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('message-actions');

    const editBtn = document.createElement('i');
    editBtn.classList.add('fas', 'fa-pencil-alt', 'action-icon', 'edit-btn');
    editBtn.title = '编辑';
    editBtn.dataset.action = 'edit';
    actionsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement('i');
    deleteBtn.classList.add('fas', 'fa-trash-alt', 'action-icon', 'delete-btn');
    deleteBtn.title = '删除';
    deleteBtn.dataset.action = 'delete';
    actionsDiv.appendChild(deleteBtn);

    if (role === 'assistant') {
        const regenerateBtn = document.createElement('i');
        regenerateBtn.classList.add('fas', 'fa-sync-alt', 'action-icon', 'regenerate-btn');
        regenerateBtn.title = '重新生成';
        regenerateBtn.dataset.action = 'regenerate';
        actionsDiv.appendChild(regenerateBtn);
    }

    return actionsDiv;
}


/**
 * 将错误信息添加到聊天界面 (无修改)
 */
function appendErrorMessageToUI(errorText) {
    try {
        const errorDiv = document.createElement('div');
        errorDiv.classList.add('message', 'error');
        errorDiv.style.color = 'red';
        errorDiv.style.backgroundColor = '#ffebee';
        errorDiv.style.padding = '10px 15px';
        errorDiv.style.border = '1px solid #e57373';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.marginTop = '10px';
        errorDiv.style.alignSelf = 'center';
        errorDiv.style.maxWidth = '85%';
        errorDiv.textContent = errorText;
        if (chatContainer && document.body.contains(chatContainer)) {
            chatContainer.appendChild(errorDiv);
            scrollChatToBottom();
        } else {
             console.error("无法添加错误消息，chatContainer 不可用:", errorText);
        }
    } catch(uiError) {
        console.error("添加错误消息时发生错误:", uiError, "原始错误:", errorText);
    }
}


/**
 * 滚动聊天容器到底部 (无修改)
 */
function scrollChatToBottom() {
    // 增加检查，确保 chatContainer 存在
    if (chatContainer) {
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 0);
    }
}

/**
 * 更新滑块旁边显示的数值 (无修改)
 */
function updateSliderValue(slider, valueSpan) {
    if(slider && valueSpan) { // 添加存在性检查
        valueSpan.textContent = slider.value;
    }
}

/**
 * 切换发送按钮的启用/禁用状态 (无修改)
 */
function toggleSendButton(enabled) {
     if (sendButton) { // 添加存在性检查
        sendButton.disabled = !enabled;
        sendButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
        sendButton.style.opacity = enabled ? '1' : '0.6';
     }
}

/**
 * 动态调整文本输入框的高度 (无修改)
 */
function adjustTextareaHeight(textarea) {
    if(textarea) { // 添加存在性检查
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10) || 150;
        if (scrollHeight > maxHeight) {
            textarea.style.height = maxHeight + 'px';
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.height = (scrollHeight + 2) + 'px'; // +2 防止单行滚动条
            textarea.style.overflowY = 'hidden';
        }
    }
}

/**
 * 简单 Markdown 渲染 (无修改)
 */
function renderMarkdown(element, markdownText) {
    if(element) { // 添加存在性检查
        element.textContent = markdownText;
    }
}


// --- 消息操作处理 ---

/**
 * 处理消息操作按钮的点击（事件委托）(无修改)
 */
function handleMessageActions(event) {
    const target = event.target;

    // 思维链切换
    if (target.classList.contains('reasoning-toggle')) {
        const targetId = target.dataset.targetId;
        const reasoningDiv = document.getElementById(targetId);
        if (reasoningDiv) {
            reasoningDiv.classList.toggle('visible');
        }
        return;
    }

    // 操作图标处理
    if (!target.classList.contains('action-icon')) {
        return;
    }

    const action = target.dataset.action;
    const contentWrapper = target.closest('.message-content-wrapper');
    if (!contentWrapper) return;
    const messageDiv = contentWrapper.closest('.message');
    if (!messageDiv) return;

    const messageId = messageDiv.dataset.messageId;

    console.log(`触发操作: ${action}, 消息 ID: ${messageId}`);

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
        default:
            console.warn("未知的操作:", action);
    }
}


/**
 * 处理编辑消息 (无修改)
 */
function handleEdit(messageId, messageDiv, contentWrapper) {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];
    const messageBubble = contentWrapper.querySelector('.message-bubble');
    const contentDiv = messageBubble?.querySelector('.actual-content'); // 安全访问
    const actionsDiv = contentWrapper.querySelector('.message-actions');

    // 增加检查
    if (!messageBubble || !contentDiv || messageBubble.classList.contains('editing')) return;

    if (actionsDiv) actionsDiv.style.display = 'none';

    const originalContent = message.content;
    messageBubble.classList.add('editing');

    const editTextArea = document.createElement('textarea');
    editTextArea.classList.add('edit-textarea');
    editTextArea.value = originalContent;

    const editActionsDiv = document.createElement('div');
    editActionsDiv.classList.add('edit-actions');

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.classList.add('save-edit-btn');
    saveBtn.onclick = () => {
        const newContent = editTextArea.value.trim();
        if (newContent && newContent !== originalContent) {
            messages[messageIndex].content = newContent;
            renderMarkdown(contentDiv, newContent);
            saveConversationToLocalStorage();
            console.log("编辑已保存, ID:", messageId);
        } else {
             renderMarkdown(contentDiv, originalContent); // 恢复原始内容
             console.log("编辑内容未改变或为空，已取消, ID:", messageId);
        }

        // 确保元素存在再移除/添加
        if (messageBubble.contains(editTextArea)) messageBubble.removeChild(editTextArea);
        if (messageBubble.contains(editActionsDiv)) messageBubble.removeChild(editActionsDiv);
        if (!messageBubble.contains(contentDiv)) messageBubble.appendChild(contentDiv);
        messageBubble.classList.remove('editing');
        if (actionsDiv) actionsDiv.style.display = '';
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.classList.add('cancel-edit-btn');
    cancelBtn.onclick = () => {
        renderMarkdown(contentDiv, originalContent);
        if (messageBubble.contains(editTextArea)) messageBubble.removeChild(editTextArea);
        if (messageBubble.contains(editActionsDiv)) messageBubble.removeChild(editActionsDiv);
        if (!messageBubble.contains(contentDiv)) messageBubble.appendChild(contentDiv);
        messageBubble.classList.remove('editing');
        if (actionsDiv) actionsDiv.style.display = '';
        console.log("编辑已取消, ID:", messageId);
    };

    editActionsDiv.appendChild(saveBtn);
    editActionsDiv.appendChild(cancelBtn);

    // 确保 contentDiv 存在再移除
    if (messageBubble.contains(contentDiv)) messageBubble.removeChild(contentDiv);
    messageBubble.appendChild(editTextArea);
    messageBubble.appendChild(editActionsDiv);
    editTextArea.focus();
    adjustTextareaHeight(editTextArea);
    editTextArea.addEventListener('input', () => adjustTextareaHeight(editTextArea));
}


/**
 * 处理删除消息 (无修改)
 */
function handleDelete(messageId, messageDiv) {
    // 增加检查 messageDiv 是否还在 DOM 中
    if (!document.body.contains(messageDiv)) {
        console.warn("尝试删除的消息已不在 DOM 中, ID:", messageId);
        return;
    }

    if (confirm("确定要删除这条消息吗？")) {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            messages.splice(messageIndex, 1);
            console.log("消息已从数组中删除, ID:", messageId);
            saveConversationToLocalStorage();
        } else {
             console.warn("无法在数组中找到要删除的消息, ID:", messageId);
        }
        // 再次检查，防止并发删除
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.remove();
            console.log("消息已从 UI 中删除, ID:", messageId);
        }
    }
}


/**
 * 处理重新生成 AI 消息 (无修改)
 */
async function handleRegenerate(messageId) {
    if (sendButton.disabled) {
        alert("请等待当前响应完成后再重新生成。");
        return;
    }

    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1 || messages[messageIndex].role !== 'assistant') {
        console.error("无法找到有效的 AI 消息进行重新生成, ID:", messageId);
        return;
    }

     if (messageIndex === 0 || messages[messageIndex - 1].role !== 'user') {
         alert("无法重新生成第一条消息或非用户提问后的消息。");
         return;
     }

    console.log("准备重新生成消息, ID:", messageId);

    messages.splice(messageIndex, 1); // 从数组移除
    saveConversationToLocalStorage();

    const aiMessageDiv = chatContainer?.querySelector(`.message[data-message-id="${messageId}"]`); // 安全访问
    if (aiMessageDiv && aiMessageDiv.parentNode) { // 检查父节点
        aiMessageDiv.remove();
        console.log("已删除旧的 AI 消息 UI, ID:", messageId);
    } else {
        console.warn("未在 UI 中找到或已移除要删除的 AI 消息 div, ID:", messageId);
    }

    toggleSendButton(false); // 禁用按钮

    try {
        // 注意：sendRequestToDeepSeekAPI 现在在 finally 中处理按钮和状态
        await sendRequestToDeepSeekAPI();
    } catch (error) {
        // 错误处理已移至 handleSendMessage 和 sendRequestToDeepSeekAPI 内部
        console.error("重新生成过程中捕获到错误:", error);
        // 不需要在这里 toggleSendButton(true) 或重置状态，finally 会处理
    }
    // 无需 finally 块，因为 sendRequestToDeepSeekAPI 会处理
}


// --- 对话存储与加载 ---

/**
 * 将当前对话保存到 JSON 文件 (无修改)
 */
function saveConversationToFile() {
    if (messages.length === 0) {
        alert("对话为空，无需保存。");
        return;
    }
    try {
        const settingsToSave = getCurrentSettings();
        // delete settingsToSave.apiKey; // 确保不保存 key

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
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
        a.download = `deepseek_chat_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("对话已保存到文件.");
    } catch (error) {
        console.error("保存对话到文件失败:", error);
        alert("保存对话失败: " + error.message);
    }
}

/**
 * 从 JSON 文件加载对话 (无修改)
 */
function loadConversationFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("加载新对话将覆盖当前对话和设置，确定要加载吗？")) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonString = e.target.result;
            const loadedData = JSON.parse(jsonString);

            if (!loadedData || !(Array.isArray(loadedData.history) || Array.isArray(loadedData))) {
                 throw new Error("无效的对话文件格式。");
            }

            let loadedMessages = [];
            let loadedSettings = null;

            if(Array.isArray(loadedData)) {
                console.warn("加载旧格式对话记录。");
                loadedMessages = loadedData;
            } else {
                loadedMessages = loadedData.history || [];
                loadedSettings = loadedData.settings;
            }

             messages = loadedMessages.map(msg => ({
                 ...msg,
                 id: msg.id || generateUniqueId(msg.role)
             }));

             // 清空 UI 前确保 chatContainer 存在
             if(chatContainer) chatContainer.innerHTML = '';
             else console.error("加载对话时 chatContainer 不存在!");


             if (loadedSettings) {
                 applySettings(loadedSettings);
                 saveSettings(); // 保存加载的设置到 LocalStorage
                 console.log("对话设置已从文件加载。");
             } else {
                 console.log("未找到设置信息，应用默认设置。");
                 applyDefaultSettings();
             }

            messages.forEach(msg => appendMessageToUI(msg)); // 渲染消息
            saveConversationToLocalStorage();
            scrollChatToBottom();
            console.log("对话已从文件加载并渲染.");
            alert("对话加载成功！");
        } catch (error) {
            console.error("加载对话文件失败:", error);
            alert("加载对话文件失败: " + error.message);
             // 出错时尝试恢复到安全状态
            messages = [];
            if(chatContainer) chatContainer.innerHTML = '';
            saveConversationToLocalStorage();
            applyDefaultSettings();
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = (e) => {
        console.error("读取文件失败:", e);
        alert("读取文件失败。");
        event.target.value = '';
    };
    reader.readAsText(file);
}

/**
 * 将当前对话保存到浏览器的 LocalStorage (无修改)
 */
function saveConversationToLocalStorage() {
    try {
        localStorage.setItem('deepseekChatHistory', JSON.stringify(messages));
    } catch (error) {
        console.error("保存对话到 LocalStorage 失败:", error);
        if (error.name === 'QuotaExceededError') {
            alert("无法保存对话，浏览器存储空间已满。");
        }
    }
}

/**
 * 从 LocalStorage 加载对话 (无修改)
 */
function loadConversationFromLocalStorage() {
    try {
        const savedHistory = localStorage.getItem('deepseekChatHistory');
        if (savedHistory) {
            const loadedMessages = JSON.parse(savedHistory);
            messages = loadedMessages.map(msg => ({
                ...msg,
                id: msg.id || generateUniqueId(msg.role)
            }));
            console.log(`从 LocalStorage 加载了 ${messages.length} 条消息.`);
            if(chatContainer) chatContainer.innerHTML = ''; // 安全清空
            else console.error("加载历史时 chatContainer 不存在!");

            messages.forEach(msg => appendMessageToUI(msg));
            scrollChatToBottom();
        } else {
            console.log("LocalStorage 中没有找到保存的对话历史。");
        }
    } catch (error) {
        console.error("从 LocalStorage 加载对话失败:", error);
        localStorage.removeItem('deepseekChatHistory');
        messages = [];
         if(chatContainer) chatContainer.innerHTML = ''; // 出错时也清空UI
    }
}

// --- 修改点：修复后的 clearConversation 函数 ---
/**
 * 清空当前对话 (已修复)
 */
function clearConversation() {
    // 1. 检查是否正在响应中
    if (sendButton && sendButton.disabled && currentAbortController) {
        // 如果正在响应，询问是否中止并清空
        if (!confirm("AI 正在响应中，确定要中止并清空所有对话记录吗？")) {
            return;
        }
        // 用户确认中止，调用 abort
        console.log("用户请求中止当前响应并清空...");
        currentAbortController.abort("User cleared conversation."); // 传递中止原因
    } else if (messages.length === 0) {
        // 如果没有消息，直接提示
        alert("对话已经为空。");
        return;
    } else {
        // 如果不在响应中，且有消息，正常询问是否清空
        if (!confirm("确定要清空所有对话记录吗？此操作不可恢复。")) {
            return;
        }
    }

    // 2. 执行清空操作 (无论之前是否中止)
    console.log("执行清空操作...");

    // --- 关键：无条件重置状态 ---
    messages = []; // 清空数据模型
    currentAssistantMessageId = null;
    currentAssistantMessageDiv = null;
    currentReasoningDiv = null;
    currentContentDiv = null;
    currentAbortController = null; // 确保 abort controller 被清除

    // 确保发送按钮可用
    toggleSendButton(true);

    // 清空 UI
    if (chatContainer) {
        chatContainer.innerHTML = '';
    } else {
         console.error("清空对话时 chatContainer 不存在!");
    }


    // 清空 LocalStorage 中的记录
    saveConversationToLocalStorage();

    console.log("对话已清空。");
}


// --- 设置管理 ---

/**
 * 获取当前界面上的设置值 (无修改)
 */
function getCurrentSettings() {
    const selectedPromptOption = predefinedPromptSelect.value;
    const settings = {
        model: modelSelect.value,
        temperature: parseFloat(temperatureSlider.value),
        frequency_penalty: parseFloat(frequencyPenaltySlider.value),
        selectedPromptValue: selectedPromptOption,
        systemPromptContent: systemPromptInput.value,
        reasoningDefaultVisible: reasoningDefaultVisibleCheckbox.checked
    };
    return settings;
}

/**
 * 将设置对象应用到界面控件 (无修改)
 */
function applySettings(settings) {
     console.log("应用加载的设置:", settings);

    if (settings.model !== undefined) modelSelect.value = settings.model;
    if (settings.temperature !== undefined) {
        temperatureSlider.value = settings.temperature;
        updateSliderValue(temperatureSlider, tempValueSpan);
    }
    if (settings.frequency_penalty !== undefined) {
        frequencyPenaltySlider.value = settings.frequency_penalty;
        updateSliderValue(frequencyPenaltySlider, penaltyValueSpan);
    }

    let appliedPrompt = false;
    if (settings.selectedPromptValue !== undefined) {
        const isValidOption = Array.from(predefinedPromptSelect.options).some(opt => opt.value === settings.selectedPromptValue);
        if (isValidOption) {
            predefinedPromptSelect.value = settings.selectedPromptValue;
            handlePredefinedPromptChange(); // 更新文本域状态

            if (settings.selectedPromptValue === customPromptValue && settings.systemPromptContent !== undefined) {
                 systemPromptInput.value = settings.systemPromptContent;
                 adjustTextareaHeight(systemPromptInput);
            }
            appliedPrompt = true;
        } else {
             console.warn("加载了无效的 selectedPromptValue:", settings.selectedPromptValue);
        }
    }

    if (!appliedPrompt) {
         predefinedPromptSelect.selectedIndex = 0;
         handlePredefinedPromptChange();
    }

    if (settings.reasoningDefaultVisible !== undefined) reasoningDefaultVisibleCheckbox.checked = settings.reasoningDefaultVisible;
}

/**
 * 应用默认设置到 UI (无修改)
 */
function applyDefaultSettings() {
    console.log("应用默认设置。");
    modelSelect.value = "deepseek-reasoner";
    temperatureSlider.value = 0.7;
    frequencyPenaltySlider.value = 0.5;
    updateSliderValue(temperatureSlider, tempValueSpan);
    updateSliderValue(frequencyPenaltySlider, penaltyValueSpan);
    predefinedPromptSelect.selectedIndex = 0;
    handlePredefinedPromptChange();
    reasoningDefaultVisibleCheckbox.checked = true;
}


/**
 * 保存当前设置到 LocalStorage (包括 API Key) (无修改)
 */
function saveSettings() {
    try {
        const currentSettings = getCurrentSettings();
        currentSettings.apiKey = apiKeyInput.value; // 添加 API Key
        localStorage.setItem('deepseekChatSettings', JSON.stringify(currentSettings));
    } catch (error) {
        console.error("保存设置到 LocalStorage 失败:", error);
    }
}

/**
 * 从 LocalStorage 加载设置并应用 (无修改)
 */
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('deepseekChatSettings');
        if (savedSettings) {
            const loadedSettings = JSON.parse(savedSettings);
            applySettings(loadedSettings); // 应用除 API Key 外的设置
            if (loadedSettings.apiKey) { // 单独加载 API Key
               apiKeyInput.value = loadedSettings.apiKey;
            }
            console.log("设置已从 LocalStorage 加载。");
        } else {
            console.log("未找到保存的设置，应用默认设置。");
            applyDefaultSettings();
        }
    } catch (error) {
        console.error("从 LocalStorage 加载设置失败:", error);
        localStorage.removeItem('deepseekChatSettings');
        applyDefaultSettings();
    }
}

// --- 设置弹窗控制 ---

/**
 * 打开设置弹窗 (无修改)
 */
function openSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'block';
}

/**
 * 关闭设置弹窗 (无修改)
 */
function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'none';
}


// --- 工具函数 ---

/**
 * 生成唯一 ID (无修改)
 * @param {string} prefix - ID 前缀 (可选)
 * @returns {string} 唯一的 ID 字符串
 */
function generateUniqueId(prefix = 'msg') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
