// --- 全局变量和常量 ---
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const saveButton = document.getElementById('save-button');
const loadInput = document.getElementById('load-input');
const clearButton = document.getElementById('clear-button');
const manualGenerateButton = document.getElementById('manual-generate-button'); // 【新增】
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeModalButton = settingsModal.querySelector('.close-button');

// 设置项元素获取 (包括新增的)
const apiKeyInput = document.getElementById('api-key');
// 【修改】模型选择相关
const modelSelect = document.getElementById('model-select');
const customModelInput = document.getElementById('custom-model-input'); // 新增自定义模型输入框

// 【新增】API URL 选择相关
const apiUrlSelect = document.getElementById('api-url-select');
const customUrlInput = document.getElementById('custom-url-input');

const temperatureSlider = document.getElementById('temperature');
const tempValueSpan = document.getElementById('temp-value');
const topPSlider = document.getElementById('top-p'); // 新增：Top P 滑块
const topPValueSpan = document.getElementById('top-p-value'); // 新增：Top P 显示值
const maxTokensInput = document.getElementById('max-tokens'); // 新增：Max Tokens 输入框
const stopSequencesInput = document.getElementById('stop-sequences'); // 新增：Stop Sequences 输入框
const frequencyPenaltySlider = document.getElementById('frequency-penalty');
const freqPenaltyValueSpan = document.getElementById('freq-penalty-value'); // ID 修正为 freq-penalty-value
const presencePenaltySlider = document.getElementById('presence-penalty'); // 新增：Presence Penalty 滑块
const presPenaltyValueSpan = document.getElementById('pres-penalty-value'); // 新增：Presence Penalty 显示值
const predefinedPromptSelect = document.getElementById('predefined-prompt-select');
const systemPromptInput = document.getElementById('system-prompt');
const reasoningDefaultVisibleCheckbox = document.getElementById('reasoning-default-visible');

// const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com'; // 【修改】移除常量，改为动态获取

// --- 预设提示词数据 ---
const predefinedPrompts =[
    { name: "默认助理 (通用)", content: "You are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information." },
    { name: "周报生成器", content: "你是一个周报生成助手，根据用户提供的工作内容，生成一份简洁、专业的周报。请注意使用书面语，突出重点，条理清晰。" },
    // 在这里可以添加更多预设提示词对象
    // { name: "提示词名称", content: "提示词内容..." },
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
    handleApiUrlChange(); // 【新增】初始化 URL 输入框状态
    handleModelChange(); // 【新增】初始化模型输入框状态
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

    // **【核心修改点】** 处理用户输入框的按键事件
    userInput.addEventListener('keydown', (e) => {
        // 当按下 Ctrl + Enter 时发送消息
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault(); // 阻止可能的默认行为（如在某些表单中提交）
            handleSendMessage();
        }
        // 如果只是按下 Enter 键 (没有 Ctrl)，则会执行 textarea 的默认行为，即换行
        // 不需要额外处理 Shift+Enter，它也会默认换行
    });

    userInput.addEventListener('input', () => adjustTextareaHeight(userInput));
    saveButton.addEventListener('click', saveConversationToFile);
    loadInput.addEventListener('change', loadConversationFromFile);
    clearButton.addEventListener('click', clearConversation);
    
    // 【新增】监听手动生成按钮
    if (manualGenerateButton) {
        manualGenerateButton.addEventListener('click', handleManualGenerate);
    }

    settingsButton.addEventListener('click', openSettingsModal);
    closeModalButton.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) closeSettingsModal(); });

    // 设置项变化监听 (包括新增的)
    apiKeyInput.addEventListener('change', saveSettings);
    
    // 【新增】URL 和模型变化监听
    apiUrlSelect.addEventListener('change', () => { handleApiUrlChange(); saveSettings(); });
    customUrlInput.addEventListener('change', saveSettings);
    modelSelect.addEventListener('change', () => { handleModelChange(); saveSettings(); });
    customModelInput.addEventListener('change', saveSettings);
    
    temperatureSlider.addEventListener('input', () => { updateSliderValue(temperatureSlider, tempValueSpan); saveSettings(); });
    topPSlider.addEventListener('input', () => { updateSliderValue(topPSlider, topPValueSpan); saveSettings(); }); // 新增
    maxTokensInput.addEventListener('change', saveSettings); // 新增 (用 change 而不是 input)
    stopSequencesInput.addEventListener('change', saveSettings); // 新增 (用 change)
    frequencyPenaltySlider.addEventListener('input', () => { updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan); saveSettings(); });
    presencePenaltySlider.addEventListener('input', () => { updateSliderValue(presencePenaltySlider, presPenaltyValueSpan); saveSettings(); }); // 新增
    predefinedPromptSelect.addEventListener('change', handlePredefinedPromptChange);
    predefinedPromptSelect.addEventListener('change', saveSettings);
    systemPromptInput.addEventListener('change', saveSettings);
    reasoningDefaultVisibleCheckbox.addEventListener('change', saveSettings);

    // 聊天容器滚动监听 (用于优化自动滚动)
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
        // 不自动聚焦，避免加载时弹窗跳出
        // systemPromptInput.focus();
    } else {
        const index = parseInt(selectedValue, 10);
        if (!isNaN(index) && index >= 0 && index < predefinedPrompts.length) {
            systemPromptInput.value = predefinedPrompts[index].content;
            systemPromptInput.disabled = true;
            systemPromptInput.placeholder = "使用上方选择的模板";
            adjustTextareaHeight(systemPromptInput); // 调整高度以适应新内容
        } else {
            // 处理无效索引或未选择的情况（例如页面刚加载时）
            console.warn("未选择或无效的预设索引:", selectedValue);
            systemPromptInput.disabled = false; // 允许编辑
            systemPromptInput.value = ''; // 清空内容
            systemPromptInput.placeholder = "选择模板或自定义...";
        }
    }
    // 确保自定义选项被选中时，systemPromptInput 是启用的
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

    // 发送消息时，认为用户希望看到最新消息，强制滚动到底部
    forceScrollChatToBottom();

    toggleSendButton(false); // 禁用发送按钮

    try {
        await sendRequestToDeepSeekAPI();
    } catch (error) {
        console.error("发送或处理请求出错:", error);
        if (error.name !== 'AbortError') {
            // 如果是网络错误或API错误，显示错误信息
            appendErrorMessageToUI("与 DeepSeek API 通信出错: " + error.message);
        } else {
            // 如果是用户主动中止，则不显示错误信息
            console.log("请求被中止。");
            // 检查是否需要清理流式输出的占位符
             const placeholderIndex = messages.findIndex(msg => msg.id === currentAssistantMessageId && msg.content === '...');
             if (placeholderIndex !== -1) {
                 messages.splice(placeholderIndex, 1); // 从数据中移除
                 const placeholderDiv = chatContainer.querySelector(`.message[data-message-id="${currentAssistantMessageId}"]`);
                 if (placeholderDiv) placeholderDiv.remove(); // 从 UI 移除
                 saveConversationToLocalStorage(); // 更新本地存储
             }
        }
    }
    // finally 块将在 sendRequestToDeepSeekAPI 中处理按钮启用等
}

/**
 * 【新增】处理手动触发 AI 回复
 * 用于在修改历史记录后，手动请求 AI 基于当前上下文生成内容
 */
async function handleManualGenerate() {
    // 1. 检查是否正在生成中
    if (sendButton.disabled) {
        alert("AI 正在响应中，请稍候...");
        return;
    }

    // 2. 检查是否有消息
    if (messages.length === 0) {
        alert("当前没有对话记录，无法生成回复。");
        return;
    }

    // 3. 检查最后一条消息的角色
    // 只有当最后一条是 User (或 System) 时，AI 回复才符合逻辑
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user' && lastMessage.role !== 'system') {
        alert("最后一条消息不是用户发送的。请先发送消息或删除末尾的 AI 消息后再试。");
        return;
    }

    // 4. 二次确认 (防止误触)
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

    // 5. 触发 API 请求
    // 逻辑与 handleSendMessage 类似，但不需要处理输入框
    toggleSendButton(false); // 禁用按钮
    forceScrollChatToBottom(); // 滚动到底部

    try {
        // 直接调用现有的请求函数，它会读取全局 messages 数组
        // 并自动添加 assistant 的占位符
        await sendRequestToDeepSeekAPI(); 
    } catch (error) {
        console.error("手动请求出错:", error);
        if (error.name !== 'AbortError') {
            appendErrorMessageToUI("请求出错: " + error.message);
        }
    }
    // finally 块会在 sendRequestToDeepSeekAPI 中处理
}

/**
 * 发送请求到 DeepSeek API (增加新参数)
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
    // --- 新增参数获取 ---
    const presence_penalty = parseFloat(presencePenaltySlider.value);
    const top_p = parseFloat(topPSlider.value);
    const max_tokens_str = maxTokensInput.value.trim();
    const max_tokens = max_tokens_str ? parseInt(max_tokens_str, 10) : null; // 如果为空则为 null
    const stopSequencesStr = stopSequencesInput.value.trim();
    // 将逗号分隔的字符串转为数组，过滤空字符串
    const stop = stopSequencesStr ? stopSequencesStr.split(',').map(s => s.trim()).filter(s => s) : null;
    // --- 新增结束 ---

    // 构建发送消息列表 (过滤逻辑不变)
    let apiMessages = messages.map(({ role, content }) => ({ role, content }));
    if (systemPrompt) {
        if (apiMessages.length === 0 || apiMessages[0].role !== 'system') {
            apiMessages.unshift({ role: 'system', content: systemPrompt });
        } else { // 如果第一条已经是 system, 更新它
            apiMessages[0].content = systemPrompt;
        }
    }
    // 过滤掉连续的同角色消息（除了 system）
     apiMessages = apiMessages.reduce((acc, current, index, arr) => {
        if (index > 0 && current.role === arr[index - 1].role && current.role !== 'system') {
             // 如果当前消息和前一个消息角色相同（非system），用当前消息覆盖前一个
             // 这通常不应该发生，因为用户和助手是交替的，但作为健壮性检查
             console.warn("过滤掉连续的同角色消息:", arr[index - 1], current);
             acc[acc.length - 1] = current; // 替换数组中最后一个元素
        } else {
             acc.push(current); // 否则，正常添加
        }
        return acc;
     }, []);

    // 添加 AI 占位符到 messages 数组
    currentAssistantMessageId = generateUniqueId('assistant');
    const assistantMessagePlaceholder = { id: currentAssistantMessageId, role: 'assistant', content: '...', reasoning_content: '' };
    messages.push(assistantMessagePlaceholder);
    saveConversationToLocalStorage(); // 保存包含占位符的状态

    // 显示占位符 UI
    appendMessageToUI(assistantMessagePlaceholder, true);

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // --- 构建请求体 (包含新参数) ---
    const requestBody = {
        model: model, // 使用动态模型变量
        messages: apiMessages,
        temperature: temperature,
        top_p: top_p, // 新增
        max_tokens: max_tokens, // 新增 (API 接受 null)
        stop: stop, // 新增 (API 接受 null 或数组)
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty, // 新增
        stream: true
    };
    // 移除值为 null 或无效值的参数，或与默认值相同的参数（可选，但更规范）
    if (requestBody.max_tokens === null || isNaN(requestBody.max_tokens) || requestBody.max_tokens <= 0) {
        delete requestBody.max_tokens;
    }
    if (requestBody.stop === null || requestBody.stop.length === 0) {
        delete requestBody.stop;
    }
    // API 通常有默认值，如果参数值等于默认值，可以不传以减小请求体积
    // if (requestBody.top_p === 1.0) delete requestBody.top_p;
    // if (requestBody.temperature === 默认值) delete requestBody.temperature;
    // ...等等
    // --- 请求体构建结束 ---

    try {
        console.log("发送请求:", JSON.stringify(requestBody, null, 2), "URL:", baseUrl); // 打印请求体（调试用）
        // 【修改】使用动态获取的 baseUrl
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody), // 使用构建好的请求体
            signal: signal // 传递中止信号
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // 尝试解析错误信息
            const detail = errorData.error?.message || errorData.message || JSON.stringify(errorData);
            throw new Error(`API 请求失败: ${response.status} ${response.statusText}. ${detail}`);
        }

        await processStream(response.body); // 处理流式响应

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("请求被用户中止。");
            // 确保移除占位符或部分消息
            const msgIndex = messages.findIndex(m => m.id === currentAssistantMessageId);
            if (msgIndex !== -1) {
                 messages.splice(msgIndex, 1); // 从数据中移除
                 const msgDiv = chatContainer.querySelector(`.message[data-message-id="${currentAssistantMessageId}"]`);
                 if (msgDiv) msgDiv.remove(); // 从 UI 中移除
            }
        } else {
            console.error("API 请求或流处理中出错:", error);
            // 尝试更新 UI 显示错误信息
             if (currentContentDiv && document.body.contains(currentContentDiv)) {
                 currentContentDiv.textContent = `请求出错: ${error.message}`;
                 currentContentDiv.style.color = 'red';
                 // 将错误信息也保存到 messages 数组
                 const msgIndex = messages.findIndex(m => m.id === currentAssistantMessageId);
                 if (msgIndex !== -1) {
                     messages[msgIndex].content = `请求出错: ${error.message}`;
                     messages[msgIndex].role = 'error'; // 可以加个角色标记
                 }
             } else {
                 appendErrorMessageToUI("请求出错: " + error.message);
             }
        }
        throw error; // 重新抛出错误，让上层调用者知道出错了
    } finally {
         // 无论成功失败，最后都清理状态
         toggleSendButton(true); // 重新启用发送按钮
         currentAssistantMessageId = null;
         currentAssistantMessageDiv = null;
         currentReasoningDiv = null;
         currentContentDiv = null;
         currentAbortController = null; // 清理中止控制器
         conditionalScrollChatToBottom(); // 尝试滚动到底部
         saveConversationToLocalStorage(); // 保存最终状态
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
    let initialChunkReceived = false; // 标记是否收到第一个有效块
    const localMessageId = currentAssistantMessageId; // 捕获当前 ID
    console.log("开始处理流 for ID:", localMessageId);

    // 查找对应的消息在数组中的索引
    const messageIndex = messages.findIndex(msg => msg.id === localMessageId);
    if (messageIndex === -1) {
        console.error("无法在 messages 数组中找到流对应的消息, ID:", localMessageId);
        // 也许应该停止处理？或者记录错误？
        return; // 提前退出以防后续错误
    }

    while (true) {
        // 检查是否已中止
        if (currentAbortController?.signal.aborted) {
            console.log("流处理中止。");
            break;
        }

        const { done, value } = await reader.read();
        if (done) {
            console.log("流读取完成 for ID:", localMessageId);
            break; // 读取完毕，退出循环
        }

        buffer += decoder.decode(value, { stream: true }); // 解码并追加到缓冲区
        const lines = buffer.split('\n\n'); // 按 SSE 的分隔符分割
        buffer = lines.pop() || ""; // 保留最后不完整的行到缓冲区

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const dataJson = line.substring(6).trim();
                if (dataJson === "[DONE]") {
                    console.log("[DONE] 信号收到 for ID:", localMessageId);
                    // 通常不需要在这里 break，等 reader.read() 返回 done
                    continue;
                }

                 try {
                     const chunk = JSON.parse(dataJson);
                     if (chunk.choices && chunk.choices.length > 0) {
                         const delta = chunk.choices[0].delta;

                          // 首次收到有效内容时，清空占位符 '...'
                          if (!initialChunkReceived && (delta.reasoning_content || delta.content)) {
                              initialChunkReceived = true;
                              if (currentContentDiv && document.body.contains(currentContentDiv) && currentContentDiv.textContent === '...') {
                                  currentContentDiv.textContent = ''; // 清空占位符
                              }
                          }

                          // 更新思维链内容
                          if (delta.reasoning_content) {
                              accumulatedReasoning += delta.reasoning_content;
                              if (messages[messageIndex]) { // 再次检查索引有效性
                                  messages[messageIndex].reasoning_content = accumulatedReasoning;
                              }
                              // 更新 UI (确保元素存在)
                              if (currentReasoningDiv && document.body.contains(currentReasoningDiv)) {
                                  currentReasoningDiv.textContent = accumulatedReasoning; // 直接更新文本
                                  // 确保切换按钮可见
                                  const toggle = currentAssistantMessageDiv?.querySelector('.reasoning-toggle');
                                  if (toggle && document.body.contains(toggle)) {
                                      if (toggle.style.display === 'none') toggle.style.display = 'block';
                                      // 如果默认可见，则添加 visible 类
                                      if (!currentReasoningDiv.classList.contains('visible') && reasoningDefaultVisibleCheckbox.checked) {
                                          currentReasoningDiv.classList.add('visible');
                                      }
                                  }
                              }
                          }

                          // 更新主要内容
                          if (delta.content) {
                              accumulatedContent += delta.content;
                              if (messages[messageIndex]) { // 再次检查索引有效性
                                  messages[messageIndex].content = accumulatedContent;
                              }
                              // 更新 UI (确保元素存在)
                              if (currentContentDiv && document.body.contains(currentContentDiv)) {
                                  // **【修改点】** 流式更新时，依然使用 textContent 提供即时反馈
                                  // Markdown 渲染将在流结束后进行
                                  currentContentDiv.textContent = accumulatedContent;
                              }
                          }
                     }
                      // --- 修改点：调用条件滚动 ---
                      conditionalScrollChatToBottom(); // 每次收到数据块都尝试滚动
                 } catch (e) {
                     console.error("解析流 JSON 失败:", e, "数据:", dataJson);
                 }
            }
        }
    } // end while loop

    // --- 流结束后 ---
    console.log("流结束，最终更新 UI for ID:", localMessageId);
    // **【修改点】** 在流结束后，使用 marked.js 渲染最终的 Markdown 内容
    if (currentContentDiv && document.body.contains(currentContentDiv)) {
        renderMarkdown(currentContentDiv, accumulatedContent); // 调用 Markdown 渲染函数
    }
    // 最终处理 reasoning 显隐
    if (currentReasoningDiv && document.body.contains(currentReasoningDiv)) {
        currentReasoningDiv.textContent = accumulatedReasoning; // 确保最终文本正确
        const toggle = currentAssistantMessageDiv?.querySelector('.reasoning-toggle');
        if (toggle && document.body.contains(toggle)) {
            // 如果最终没有 reasoning 内容，隐藏它和切换按钮
            if (!accumulatedReasoning) {
                currentReasoningDiv.classList.remove('visible');
                currentReasoningDiv.style.display = 'none';
                toggle.style.display = 'none';
            } else {
                // 否则确保它们可见
                currentReasoningDiv.style.display = ''; // 或者 'block' 如果需要
                toggle.style.display = 'block';
                 // 如果默认可见但当前不可见，添加 visible 类
                 if (reasoningDefaultVisibleCheckbox.checked && !currentReasoningDiv.classList.contains('visible')) {
                     currentReasoningDiv.classList.add('visible');
                 }
            }
        }
    }
    // 确保保存包含完整内容的对话记录
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
        messageDiv.className = `message ${message.role || 'unknown'}`; // 添加默认角色以防万一
        messageDiv.dataset.messageId = message.id;

        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = message.role === 'user' ? 'user-avatar.png' : 'bot-avatar.png';
        avatar.alt = message.role || 'avatar';
        // 简单的 SVG 占位符作为备用
        avatar.onerror = () => avatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNjY2MiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjBweCIgZmlsbD0iI2ZmZiI+PzwvdGV4dD48L3N2Zz4=';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';

        let reasoningDiv = null, reasoningToggle = null;

        // 只为 assistant 消息创建 reasoning 相关元素
        if (message.role === 'assistant') {
            reasoningToggle = document.createElement('span');
            reasoningToggle.className = 'reasoning-toggle';
            reasoningToggle.textContent = '显示/隐藏 思维链';
            reasoningToggle.dataset.targetId = `reasoning-${message.id}`;
            // 初始时，如果正在流式传输或已有内容，则显示按钮
            reasoningToggle.style.display = (message.reasoning_content || isStreaming) ? 'block' : 'none';
            contentWrapper.appendChild(reasoningToggle);

            reasoningDiv = document.createElement('div');
            reasoningDiv.className = 'reasoning-content';
            reasoningDiv.id = `reasoning-${message.id}`;
            reasoningDiv.textContent = message.reasoning_content || ''; // 设置现有内容
            // 如果设置了默认可见，并且有内容或正在流式传输，则添加 'visible' 类
            if ((reasoningDefaultVisibleCheckbox.checked && (message.reasoning_content || isStreaming))) {
                reasoningDiv.classList.add('visible');
            }
            // 如果不是流式传输且没有内容，则彻底隐藏
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
            // 如果是流式传输的助手消息，设置全局引用并显示初始文本 ('...')
            currentAssistantMessageDiv = messageDiv;
            currentReasoningDiv = reasoningDiv; // 即使开始为空也要设置
            currentContentDiv = actualContentDiv;
            actualContentDiv.textContent = message.content; // 初始是 '...'
        } else if (message.role === 'assistant') {
            // 如果是已完成的助手消息，渲染 Markdown
            renderMarkdown(actualContentDiv, message.content);
        } else {
             // 如果是用户消息或其他，直接设置文本内容
             actualContentDiv.textContent = message.content;
        }

        messageBubble.appendChild(actualContentDiv);
        contentWrapper.appendChild(messageBubble);

        // 添加操作按钮
        const actionsDiv = createMessageActions(message.id, message.role);
        contentWrapper.appendChild(actionsDiv);

        messageDiv.append(avatar, contentWrapper);
        chatContainer.appendChild(messageDiv);

        // --- 修改点：添加新消息时，判断是否滚动到底部 ---
        conditionalScrollChatToBottom(); // 每次添加消息都检查滚动

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

    // 编辑按钮 (所有消息都有)
    const editBtn = document.createElement('i');
    editBtn.className = 'fas fa-pencil-alt action-icon edit-btn';
    editBtn.title = '编辑';
    editBtn.dataset.action = 'edit';
    actionsDiv.appendChild(editBtn);

    // 删除按钮 (所有消息都有)
    const deleteBtn = document.createElement('i');
    deleteBtn.className = 'fas fa-trash-alt action-icon delete-btn';
    deleteBtn.title = '删除';
    deleteBtn.dataset.action = 'delete';
    actionsDiv.appendChild(deleteBtn);

    // 重新生成按钮 (仅 assistant 消息有)
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
        errorDiv.className = 'message error'; // 使用 message 类，但添加 error 子类
        // 增加更明显的错误样式
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
        errorDiv.textContent = `错误：${errorText}`; // 添加“错误：”前缀

        if (chatContainer && document.body.contains(chatContainer)) {
            chatContainer.appendChild(errorDiv);
            conditionalScrollChatToBottom(); // 尝试滚动到底部
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
    // 定义一个阈值，比如比容器高度少 50 像素，判断是否接近底部
    const threshold = 50;
    const isNearBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + threshold;

    // 如果用户没有正在手动滚动，并且当前视口接近底部，则滚动到底部
    if (!isUserScrolling && isNearBottom) {
        // 使用平滑滚动以获得更好的体验
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        // console.log("Conditional scroll executed.");
    } else {
        // console.log(`Scroll skipped: isUserScrolling=${isUserScrolling}, isNearBottom=${isNearBottom}`);
    }
}

/**
 * 强制滚动到底部 (用于发送消息等明确需要滚动到底部的场景)
 */
 function forceScrollChatToBottom() {
    if (chatContainer) {
        // 强制滚动，不管用户当前在哪
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        console.log("Forced scroll executed.");
    }
 }


/**
 * 处理聊天容器滚动事件，标记用户是否在滚动
 */
function handleChatScroll() {
    if (!chatContainer) return;
    // 用户开始滚动时设置标记
    isUserScrolling = true;
    // 清除之前的计时器（如果存在）
    clearTimeout(scrollTimeout);
    // 设置一个新的计时器，一段时间（例如 150ms）后认为用户停止了滚动
    scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        // console.log("User scrolling stopped.");
    }, 150); // 150ms 的延迟，可以调整
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
         // 可选：更改图标或背景色以示区别
         // const icon = sendButton.querySelector('i');
         // if (icon) icon.className = enabled ? 'fas fa-paper-plane' : 'fas fa-spinner fa-spin'; // 示例：用加载图标
     }

     // 【新增】同步控制手动生成按钮的状态
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
        textarea.style.height = 'auto'; // 重置高度以便获取 scrollHeight
        const scrollHeight = textarea.scrollHeight;
        // 获取 CSS 中定义的最大高度，如果没有则默认为 150px
        const maxHeightStyle = window.getComputedStyle(textarea).maxHeight;
        const maxHeight = parseInt(maxHeightStyle, 10) || 150;

        // 设置高度，但不超过最大高度
        textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';

        // 如果内容超过最大高度，显示滚动条，否则隐藏
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
}

/**
 * **【修改点】** 使用 marked.js 渲染 Markdown 文本到指定元素
 * @param {HTMLElement} element 要渲染内容的 HTML 元素
 * @param {string} markdownText Markdown 格式的文本
 */
function renderMarkdown(element, markdownText) {
    if (element) {
        if (typeof marked === 'undefined') {
            console.error('Marked.js library is not loaded!');
            // 作为后备，显示原始文本
            element.textContent = markdownText || '';
            return;
        }
        try {
            // **核心：使用 marked.parse() 转换 Markdown 为 HTML**
            const htmlContent = marked.parse(markdownText || ''); // 处理 null 或 undefined 输入
            // **核心：使用 innerHTML 将转换后的 HTML 放入元素**
            element.innerHTML = htmlContent;
        } catch (error) {
            console.error("Markdown 渲染失败:", error);
            // 渲染失败时，显示原始文本并提示错误
            element.textContent = `--- Markdown渲染出错 ---\n${markdownText || ''}`;
        }
    } else {
        console.warn("尝试渲染 Markdown 但目标元素无效。");
    }
}


// --- 消息操作处理 ---

/**
 * 处理消息操作按钮点击 (编辑、删除、重新生成、切换思维链)
 */
function handleMessageActions(event) {
     const target = event.target;

    // 切换思维链可见性
    if (target.classList.contains('reasoning-toggle')) {
        const targetId = target.dataset.targetId;
        const reasoningDiv = document.getElementById(targetId);
        if (reasoningDiv) {
            reasoningDiv.classList.toggle('visible');
            // 可以选择保存这个状态到 messages 数组或本地存储，以便刷新后保持
        }
        return; // 处理完毕，不再继续
    }

    // 检查是否是操作图标
    if (!target.classList.contains('action-icon')) return;

    // 获取相关元素和 ID
    const contentWrapper = target.closest('.message-content-wrapper');
    if (!contentWrapper) return;
    const messageDiv = contentWrapper.closest('.message');
    if (!messageDiv) return;
    const messageId = messageDiv.dataset.messageId;
    const action = target.dataset.action;

    console.log(`操作: ${action}, 消息 ID: ${messageId}`);

    // 根据操作类型调用相应处理函数
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
            console.warn("未知的消息操作:", action);
    }
}


/**
 * 处理编辑消息
 * **【修改点】** 保存和取消时调用 renderMarkdown
 */
function handleEdit(messageId, messageDiv, contentWrapper) {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) { console.error("未找到要编辑的消息, ID:", messageId); return; }

    const message = messages[messageIndex];
    const messageBubble = contentWrapper.querySelector('.message-bubble');
    const contentDiv = messageBubble?.querySelector('.actual-content');
    const actionsDiv = contentWrapper.querySelector('.message-actions');

    if (!messageBubble || !contentDiv || messageBubble.classList.contains('editing')) return; // 防止重复编辑

    if (actionsDiv) actionsDiv.style.display = 'none'; // 隐藏操作按钮

    const originalContent = message.content; // 保存原始 Markdown 文本
    messageBubble.classList.add('editing'); // 添加编辑状态类

    // 创建编辑用的 textarea
    const editTextArea = document.createElement('textarea');
    editTextArea.className = 'edit-textarea';
    editTextArea.value = originalContent; // 填充原始内容
    editTextArea.addEventListener('input', () => adjustTextareaHeight(editTextArea)); // 动态调整高度

    // 创建编辑操作按钮（保存、取消）
    const editActionsDiv = document.createElement('div');
    editActionsDiv.className = 'edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'save-edit-btn';
    saveBtn.onclick = () => {
        const newContent = editTextArea.value.trim(); // 获取新内容
        if (newContent && newContent !== originalContent) {
            messages[messageIndex].content = newContent; // 更新数据模型
            renderMarkdown(contentDiv, newContent); // **修改点：** 使用 renderMarkdown 显示新内容
            saveConversationToLocalStorage(); // 保存更改
            console.log("编辑已保存, ID:", messageId);
        } else {
            // 如果内容为空或未改变，恢复原始内容
            renderMarkdown(contentDiv, originalContent); // **修改点：** 恢复时也用 renderMarkdown
            console.log("编辑取消或无变化, ID:", messageId);
        }
        // 清理编辑 UI
        if (messageBubble.contains(editTextArea)) messageBubble.removeChild(editTextArea);
        if (messageBubble.contains(editActionsDiv)) messageBubble.removeChild(editActionsDiv);
        if (!messageBubble.contains(contentDiv)) messageBubble.appendChild(contentDiv); // 确保内容区域存在
        messageBubble.classList.remove('editing'); // 移除编辑状态
        if (actionsDiv) actionsDiv.style.display = ''; // 恢复操作按钮
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'cancel-edit-btn';
    cancelBtn.onclick = () => {
        // 取消编辑，恢复原始内容
        renderMarkdown(contentDiv, originalContent); // **修改点：** 恢复时也用 renderMarkdown
        // 清理编辑 UI
        if (messageBubble.contains(editTextArea)) messageBubble.removeChild(editTextArea);
        if (messageBubble.contains(editActionsDiv)) messageBubble.removeChild(editActionsDiv);
        if (!messageBubble.contains(contentDiv)) messageBubble.appendChild(contentDiv);
        messageBubble.classList.remove('editing');
        if (actionsDiv) actionsDiv.style.display = '';
        console.log("编辑已取消, ID:", messageId);
    };

    editActionsDiv.append(saveBtn, cancelBtn); // 添加按钮到操作区

    // 替换内容显示为编辑区域
    if (messageBubble.contains(contentDiv)) messageBubble.removeChild(contentDiv);
    messageBubble.append(editTextArea, editActionsDiv);

    // 初始调整高度并聚焦
    adjustTextareaHeight(editTextArea);
    editTextArea.focus();
    editTextArea.select(); // 选中所有文本，方便修改
}


/**
 * 处理删除单条消息
 */
function handleDelete(messageId, messageDiv) {
    // 确保元素存在于 DOM 中
    if (!document.body.contains(messageDiv)) {
        console.warn("尝试删除的消息不在 DOM 中, ID:", messageId);
        return;
    }

    if (confirm("确定删除这条消息?")) {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            messages.splice(messageIndex, 1); // 从数据模型中删除
            saveConversationToLocalStorage(); // 保存更改
            console.log("消息数据已删除, ID:", messageId);
        } else {
            console.warn("未在数据模型中找到要删除的消息, ID:", messageId);
        }

        // 从 UI 中平滑移除 (可选动画)
        messageDiv.style.opacity = '0';
        messageDiv.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
             if (messageDiv.parentNode) {
                messageDiv.remove();
                console.log("消息 UI 已删除, ID:", messageId);
             }
        }, 300); // 等待动画完成

    } else {
        console.log("删除操作已取消, ID:", messageId);
    }
}


/**
 * 处理重新生成 AI 消息 (包含删除后续对话逻辑)
 */
async function handleRegenerate(messageId) {
     // 如果当前正在请求，则阻止
     if (sendButton.disabled) {
         alert("请等待当前响应完成。");
         return;
     }

    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    // 必须是 assistant 消息且存在
    if (messageIndex === -1 || messages[messageIndex].role !== 'assistant') {
        console.error("无法重新生成：无效消息或非 AI 消息, ID:", messageId);
        return;
    }

    // 检查重新生成的消息后面是否有其他消息
    const messagesToDeleteCount = messages.length - 1 - messageIndex;
    let userConfirmed = true; // 默认确认（如果后面没有消息）

    if (messagesToDeleteCount > 0) {
        userConfirmed = confirm(`重新生成这条回复将会删除其后的 ${messagesToDeleteCount} 条对话记录。\n确定要继续吗？`);
    }

    if (userConfirmed) {
        console.log("准备重新生成, ID:", messageId);

        // --- 删除后续消息 (数据和 UI) ---
        if (messagesToDeleteCount > 0) {
            // 从数据模型中删除
            const deletedMessages = messages.splice(messageIndex + 1); // 删除 messageIndex 后面的所有元素
            console.log(`删除了 ${deletedMessages.length} 条后续消息数据。`);

            // 从 UI 中删除
            deletedMessages.forEach(deletedMsg => {
                const msgDiv = chatContainer?.querySelector(`.message[data-message-id="${deletedMsg.id}"]`);
                if (msgDiv?.parentNode) {
                    msgDiv.remove();
                    console.log(`删除了 UI 消息, ID: ${deletedMsg.id}`);
                }
            });
        }
        // --- 删除结束 ---

        // 删除当前 AI 消息本身 (数据和 UI)
        // 注意：现在我们不立即删除当前 AI 消息，而是让 sendRequestToDeepSeekAPI 发起请求
        // 请求完成后，旧的占位符会被新的流式响应替换
        // messages 数组在发起请求前应该只包含到当前 AI 消息之前的对话
        const messagesToSend = messages.slice(0, messageIndex); // 获取重新生成点之前的所有消息
        messages = messagesToSend; // 更新全局 messages 数组

        saveConversationToLocalStorage(); // 保存删除操作后的状态

        // 从 UI 中移除旧的 AI 消息
        const aiMessageDiv = chatContainer?.querySelector(`.message[data-message-id="${messageId}"]`);
        if (aiMessageDiv?.parentNode) {
            aiMessageDiv.remove();
            console.log("已删除旧 AI 消息 UI, ID:", messageId);
        } else {
            console.warn("未找到要移除的旧 AI 消息 UI, ID:", messageId);
        }

        // 禁用按钮并发送请求 (此时 messages 已经是截断后的)
        toggleSendButton(false);
        try {
            await sendRequestToDeepSeekAPI(); // sendRequest 会使用当前的 messages 数组
        } catch (error) {
            console.error("重新生成出错:", error);
            // 错误处理已包含在 sendRequest... 和其调用者中
            // 考虑是否需要恢复被删除的消息？(目前不恢复)
            // 如果请求失败，messages 数组已经是截断状态，UI 也已移除旧消息
            // 可以在这里添加逻辑来恢复被删除的消息和 UI，但会增加复杂度
        }
        // finally 块在 sendRequestToDeepSeekAPI 中处理状态重置和按钮启用
    } else {
        console.log("用户取消了重新生成操作。");
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
        const settingsToSave = getCurrentSettings(); // 获取当前设置
        const conversationData = {
            version: 1, // 版本号，便于未来扩展
            timestamp: new Date().toISOString(), // 保存时间戳
            settings: settingsToSave, // 保存相关设置
            history: messages // 保存对话历史
        };
        const jsonString = JSON.stringify(conversationData, null, 2); // 格式化 JSON
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 生成文件名，包含日期时间
        a.download = `deepseek_chat_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.json`;
        document.body.appendChild(a); // 添加到页面以便触发点击
        a.click(); // 模拟点击下载
        document.body.removeChild(a); // 移除元素
        URL.revokeObjectURL(url); // 释放内存
        console.log("对话已保存到文件。");
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
        event.target.value = ''; // 清空文件选择，以便可以再次选择同一个文件
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedData = JSON.parse(e.target.result);
            // 基础验证
            if (!loadedData || !(typeof loadedData === 'object')) {
                throw new Error("文件格式无效，不是有效的 JSON 对象。");
            }
            // 检查 history 是否存在且为数组
            if (!Array.isArray(loadedData.history)) {
                 // 兼容旧格式（直接是消息数组）
                 if(Array.isArray(loadedData)) {
                     loadedData = { history: loadedData, settings: null }; // 包装成新格式
                     console.log("检测到旧格式文件，已尝试兼容。");
                 } else {
                     throw new Error("文件格式无效，缺少 'history' 数组。");
                 }
            }

            // 加载消息，确保每条消息有 ID
            messages = loadedData.history.map(msg => ({
                ...msg,
                id: msg.id || generateUniqueId(msg.role || 'unknown') // 补充或生成 ID
            }));

            // 清空当前 UI
            if (chatContainer) chatContainer.innerHTML = '';
            else console.error("加载对话时 chatContainer 不存在!");

            // 加载设置 (如果存在)
            if (loadedData.settings && typeof loadedData.settings === 'object') {
                applySettings(loadedData.settings);
                saveSettings(); // 将加载的设置保存到 LocalStorage
                console.log("对话文件中的设置已加载并应用。");
            } else {
                console.log("对话文件中未找到设置，将保留当前或应用默认设置。");
                // 可以选择加载默认设置：applyDefaultSettings();
                // 或者保留当前已加载的设置（通常更好）
            }

            // 重新渲染 UI
            messages.forEach(msg => appendMessageToUI(msg));
            saveConversationToLocalStorage(); // 保存加载的对话到 LocalStorage
            conditionalScrollChatToBottom(); // 滚动到底部
            console.log("对话已从文件加载。");
            alert("对话加载成功！");

        } catch (error) {
            console.error("加载对话文件失败:", error);
            alert("加载失败: " + error.message + "\n请确保文件是正确的 JSON 格式。");
            // 出错时不应清除当前对话
            // messages = [];
            // if(chatContainer) chatContainer.innerHTML = '';
            // saveConversationToLocalStorage();
            // applyDefaultSettings(); // 重置为默认设置？
        } finally {
            event.target.value = ''; // 清空文件选择
        }
    };
    reader.onerror = (e) => {
        console.error("读取文件时出错:", e);
        alert("读取文件失败。");
        event.target.value = ''; // 清空文件选择
    };
    reader.readAsText(file); // 读取文件内容
}

/**
 * 保存对话到 LocalStorage
 */
function saveConversationToLocalStorage() {
    try {
        localStorage.setItem('deepseekChatHistory', JSON.stringify(messages));
    } catch (error) {
        console.error("保存对话到 LocalStorage 失败:", error);
        // 可以考虑给出提示，例如 LocalStorage 已满
    }
}

/**
 * 从 LocalStorage 加载对话
 */
function loadConversationFromLocalStorage() {
    try {
        const savedHistory = localStorage.getItem('deepseekChatHistory');
        if (savedHistory) {
            // 验证是否是有效的 JSON 数组
             let parsedHistory; try { parsedHistory = JSON.parse(savedHistory); } catch { throw new Error("LocalStorage 中的历史记录格式无效。"); }
             if (!Array.isArray(parsedHistory)) throw new Error("LocalStorage 中的历史记录不是数组。");

            messages = parsedHistory.map(msg => ({
                ...msg,
                id: msg.id || generateUniqueId(msg.role || 'unknown') // 确保有 ID
            }));

            console.log(`从 LocalStorage 加载了 ${messages.length} 条历史记录.`);
            if (chatContainer) chatContainer.innerHTML = ''; // 清空现有 UI
            else console.error("加载历史时 chatContainer 不存在!");

            messages.forEach(msg => appendMessageToUI(msg)); // 重新渲染 UI
            conditionalScrollChatToBottom(); // 滚动到底部

        } else {
            console.log("LocalStorage 中未找到历史记录。");
        }
    } catch (error) {
        console.error("从 LocalStorage 加载历史记录失败:", error);
        localStorage.removeItem('deepseekChatHistory'); // 清除损坏的数据
        messages = []; // 重置消息数组
        if (chatContainer) chatContainer.innerHTML = ''; // 清空 UI
    }
}

/**
 * 清空对话
 */
function clearConversation() {
    // 如果正在响应，先中止
    if (sendButton?.disabled && currentAbortController) {
        if (!confirm("AI 正在响应中，确定要中止并清空所有对话记录吗？")) return;
        console.log("用户中止并清空对话...");
        currentAbortController.abort("User cleared conversation."); // 发出中止信号
        // 中止后，finally 块会清理状态，但这里需要确保 messages 被清空
    } else if (messages.length === 0) {
        alert("对话已经为空。");
        return;
    } else {
        // 正常清空确认
        if (!confirm("确定要清空所有对话记录吗？此操作不可恢复。")) return;
    }

    console.log("执行清空操作...");
    messages = []; // 清空消息数组
    // 重置可能存在的流式输出状态
    currentAssistantMessageId = null;
    currentAssistantMessageDiv = null;
    currentReasoningDiv = null;
    currentContentDiv = null;
    currentAbortController = null; // 确保中止控制器为空
    toggleSendButton(true); // 确保发送按钮可用

    // 清空 UI
    if (chatContainer) chatContainer.innerHTML = '';
    else console.error("清空对话时 chatContainer 不存在!");

    saveConversationToLocalStorage(); // 清除 LocalStorage 中的记录
    console.log("对话已清空。");
}


// --- 设置管理 ---

/**
 * 获取当前界面的所有设置项值
 */
function getCurrentSettings() {
    const settings = {
        // 【修改】新增 URL 和模型配置
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
        selectedPromptValue: predefinedPromptSelect.value, // 保存当前选中的模板值
        systemPromptContent: systemPromptInput.value, // 保存系统提示词内容（即使是模板生成的）
        reasoningDefaultVisible: reasoningDefaultVisibleCheckbox.checked
    };

    // 清理无效的 max_tokens (确保是正整数)
    if (settings.max_tokens !== null && (isNaN(settings.max_tokens) || settings.max_tokens < 1)) {
        console.warn("无效的 Max Tokens 值将被忽略:", settings.max_tokens);
        settings.max_tokens = null; // 设为 null，让 API 使用默认值
    }
    return settings;
}

/**
 * 将设置对象应用到界面控件
 */
function applySettings(settings) {
     console.log("正在应用设置:", settings);
     // API Key 加载由 loadSettings 单独处理，不在此处覆盖

    // 【修改】应用 URL 和模型配置
    if (settings.apiUrl !== undefined) apiUrlSelect.value = settings.apiUrl;
    if (settings.customUrl !== undefined) customUrlInput.value = settings.customUrl;
    if (settings.model !== undefined) modelSelect.value = settings.model;
    if (settings.customModel !== undefined) customModelInput.value = settings.customModel;
    
    // 触发 UI 更新 (显示/隐藏自定义输入框)
    handleApiUrlChange();
    handleModelChange();

    if (settings.temperature !== undefined) { temperatureSlider.value = settings.temperature; updateSliderValue(temperatureSlider, tempValueSpan); }
    if (settings.top_p !== undefined) { topPSlider.value = settings.top_p; updateSliderValue(topPSlider, topPValueSpan); }
    if (settings.max_tokens !== undefined && settings.max_tokens !== null) maxTokensInput.value = settings.max_tokens; else maxTokensInput.value = '';
    if (settings.stop !== undefined && settings.stop !== null && Array.isArray(settings.stop)) stopSequencesInput.value = settings.stop.join(','); else stopSequencesInput.value = '';
    if (settings.frequency_penalty !== undefined) { frequencyPenaltySlider.value = settings.frequency_penalty; updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan); }
    if (settings.presence_penalty !== undefined) { presencePenaltySlider.value = settings.presence_penalty; updateSliderValue(presencePenaltySlider, presPenaltyValueSpan); }

    // 处理预设提示词和自定义提示词
    if (settings.selectedPromptValue !== undefined) {
        // 检查加载的值是否在当前选项中有效
        const isValidOption = Array.from(predefinedPromptSelect.options).some(opt => opt.value === settings.selectedPromptValue);
        if (isValidOption) {
            predefinedPromptSelect.value = settings.selectedPromptValue;
            handlePredefinedPromptChange(); // 更新 systemPromptInput 的状态和内容（如果是模板）
            // 如果加载的是自定义选项，确保 systemPrompt 的内容也被加载
            if (settings.selectedPromptValue === customPromptValue && settings.systemPromptContent !== undefined) {
                 systemPromptInput.value = settings.systemPromptContent;
                 adjustTextareaHeight(systemPromptInput); // 调整高度
            }
        } else {
            console.warn("加载了无效的 selectedPromptValue:", settings.selectedPromptValue, "将使用默认选项。");
            predefinedPromptSelect.selectedIndex = 0; // 回退到第一个选项
            handlePredefinedPromptChange();
        }
    } else {
        // 如果设置中没有 selectedPromptValue，则使用默认选项
        predefinedPromptSelect.selectedIndex = 0;
        handlePredefinedPromptChange();
    }

    // 加载思维链可见性设置
    if (settings.reasoningDefaultVisible !== undefined) {
        reasoningDefaultVisibleCheckbox.checked = settings.reasoningDefaultVisible;
    }
}

/**
 * 应用默认设置到界面
 */
function applyDefaultSettings() {
    console.log("应用默认设置。");
    // 【修改】默认值
    apiUrlSelect.value = "https://api.deepseek.com"; 
    customUrlInput.value = "";
    modelSelect.value = "deepseek-reasoner";
    customModelInput.value = "";
    handleApiUrlChange();
    handleModelChange();

    temperatureSlider.value = 0.7; updateSliderValue(temperatureSlider, tempValueSpan);
    topPSlider.value = 1.0; updateSliderValue(topPSlider, topPValueSpan);
    maxTokensInput.value = ''; // 默认空，让 API 使用默认值
    stopSequencesInput.value = '';
    frequencyPenaltySlider.value = 0.5; updateSliderValue(frequencyPenaltySlider, freqPenaltyValueSpan);
    presencePenaltySlider.value = 0.0; updateSliderValue(presencePenaltySlider, presPenaltyValueSpan);
    predefinedPromptSelect.selectedIndex = 0; // 默认选择第一个预设提示词
    handlePredefinedPromptChange(); // 应用提示词
    reasoningDefaultVisibleCheckbox.checked = true; // 默认显示思维链
    // 注意：不应在此处清除 API Key
    // apiKeyInput.value = '';
}


/**
 * 保存当前设置到 LocalStorage
 */
function saveSettings() {
    try {
        const currentSettings = getCurrentSettings(); // 获取界面上的设置
        // 将 API Key 也保存进去，但不包含在 getCurrentSettings 返回的对象中（那里用于 API 请求）
        currentSettings.apiKey = apiKeyInput.value.trim();
        localStorage.setItem('deepseekChatSettings', JSON.stringify(currentSettings));
        // console.log("设置已保存到 LocalStorage:", currentSettings); // 减少日志噪音
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
            applySettings(loadedSettings); // 应用加载的设置到界面
            // 单独加载 API Key
            if (loadedSettings.apiKey) {
                apiKeyInput.value = loadedSettings.apiKey;
            }
            console.log("设置已从 LocalStorage 加载。");
        } else {
            console.log("未找到保存的设置，应用默认设置。");
            applyDefaultSettings(); // 如果没有保存的设置，应用默认值
        }
    } catch (error) {
        console.error("从 LocalStorage 加载设置失败:", error);
        localStorage.removeItem('deepseekChatSettings'); // 清除可能损坏的数据
        applyDefaultSettings(); // 加载失败时应用默认值
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
    // 生成更可靠的唯一 ID
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}