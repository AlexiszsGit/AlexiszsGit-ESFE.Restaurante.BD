
(() => {
    if (!window.ESFERestaurante?.chat) return;

    const bot = ESFERestaurante.chat;

    // Escapa caracteres especiales para insertar texto de forma segura en HTML.
    const esc = value =>
        String(value ?? '').replace(
            /[&<>"']/g,
            char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char])
        );

    // Agrega el nuevo dato a la conversación.
    const add = (html, kind = 'bot') => {
        const box = document.getElementById('chatMessages');
        if (!box) return null;

        const item = document.createElement('div');
        item.className = `chat-bubble ${kind}`;
        item.innerHTML = html;

        box.appendChild(item);
        box.scrollTop = box.scrollHeight;

        return item;
    };

    // Muestra el indicador de que el asistente está escribiendo.
    const addTyping = () => {
        const box = document.getElementById('chatMessages');
        if (!box) return null;

        const item = document.createElement('div');
        item.className = 'chat-bubble bot chat-typing';
        item.setAttribute('aria-label', 'El asistente está escribiendo');
        item.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        box.appendChild(item);
        box.scrollTop = box.scrollHeight;

        return item;
    };

    // Elimina o limpia los datos de typing.
    const removeTyping = item => {
        if (item?.parentNode) {
            item.remove();
        }
    };

    // Obtiene el botón que activa el modo de conversación por voz.
    const getVoiceModeButton = () =>
        document.getElementById('chatVoiceModeButton');

    // Obtiene el botón del micrófono para dictado.
    const getVoiceButton = () =>
        document.getElementById('chatVoiceButton');

    // Obtiene el campo donde el usuario escribe el mensaje.
    const getInput = () =>
        document.getElementById('chatInput');

    // Obtiene la capa visual del modo de voz.
    const getVoiceOverlay = () =>
        document.getElementById('chatVoiceMode');

    // Muestra u oculta la interfaz del modo de voz.
    const setVoiceOverlay = open => {
        const overlay = getVoiceOverlay();
        overlay?.classList.toggle('show', open);
        overlay?.setAttribute('aria-hidden', String(!open));
    };

    // Actualiza el estado visible del modo de voz.
    const setVoiceStatus = (status, hint) => {
        const state = document.getElementById('chatVoiceStatus');
        const help = document.getElementById('chatVoiceHint');
        const orb = document.getElementById('chatVoiceOrb');
        if (state && status) state.textContent = status;
        if (help && hint) help.textContent = hint;
        orb?.classList.toggle('listening', String(status || '').toLowerCase().includes('escuch'));
    };

    // Comprueba si el navegador permite reconocimiento de voz.
    const canUseSpeechRecognition = () =>
        !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    // Comprueba si el navegador permite síntesis de voz.
    const canUseSpeechSynthesis = () =>
        !!window.speechSynthesis;
    // Obtiene el idioma que eligió el usuario para el chat y la voz.
    const currentChatLocale = () => {
        const code = String(localStorage.getItem('restaurantebd.language') || document.documentElement.lang || 'es').toLowerCase();
        const map = { es:'es-SV', en:'en-US', pt:'pt-BR', fr:'fr-FR', de:'de-DE', it:'it-IT', nl:'nl-NL', tr:'tr-TR', ru:'ru-RU', pl:'pl-PL', zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', ar:'ar-SA', hi:'hi-IN', id:'id-ID', vi:'vi-VN', th:'th-TH', he:'he-IL', sv:'sv-SE' };
        return map[code] || 'es-SV';
    };

    // Reproduce en voz alta la respuesta del asistente.
    const speak = text => {
        if (!canUseSpeechSynthesis() || !text) return Promise.resolve();

        return new Promise(resolve => {
            try {
                window.speechSynthesis.cancel();

                const speechText = String(text)
                    .replace(/[\*`_#•]+/g, ' ')
                    .replace(/\s{2,}/g, ' ')
                    .trim();

                const utterance =
                    new SpeechSynthesisUtterance(speechText);

                utterance.lang = currentChatLocale();
                utterance.rate = 1;
                utterance.pitch = 1;

                utterance.onend = () => resolve();
                utterance.onerror = () => resolve();

                window.speechSynthesis.speak(utterance);
            }
            catch {
                resolve();
            }
        });
    };
    // Estado y controles del modo de voz
    // Guarda el estado de la conversación por voz.
    const voiceState = {
        active: false,
        listening: false,
        processing: false,
        recognition: null,
        transcript: '',
        restartOnEnd: true,
        currentRequest: 0
    };

    // Actualiza el estado visual del botón de modo voz.
    const setVoiceModeButton = active => {
        const button = getVoiceModeButton();
        if (!button) return;

        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));

        button.setAttribute(
            'title',
            active
                ? 'Desactivar conversación por voz'
                : 'Activar conversación por voz'
        );

        const text =
            button.querySelector('.chat-voice-mode-label');

        if (text) {
            text.textContent = active
                ? 'Voz activa'
                : 'Voz';
        }
    };
    // Captura de voz mediante reconocimiento del navegador
    // Detiene la captura de voz actual.
    const stopListening = () => {
        voiceState.listening = false;
        voiceState.restartOnEnd = false;
        voiceState.transcript = '';
        clearTimeout(voiceState.voicePauseTimer);

        try {
            voiceState.recognition?.stop();
        }
        catch { }

        const button = getVoiceButton();
        button?.classList.remove('recording');
        setVoiceStatus('Pausado', 'Puedes cerrar este modo o volver a escuchar.');

        if (button) {
            button.setAttribute(
                'aria-label',
                'Hablar con el asistente'
            );
        }
    };

    // Inicia la captura de voz del usuario en modo conversación continua.
    const startListening = () => {
        if (!voiceState.active || voiceState.processing || voiceState.listening) return;

        if (!canUseSpeechRecognition()) {
            add('Este navegador no tiene reconocimiento de voz disponible.');
            voiceState.active = false;
            setVoiceModeButton(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.lang = currentChatLocale();
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        voiceState.recognition = recognition;
        voiceState.listening = true;
        voiceState.restartOnEnd = true;
        voiceState.transcript = '';
        setVoiceStatus('Escuchando...', 'Habla normalmente. La conversación seguirá sin cortar la escucha entre frases.');

        const voiceButton = getVoiceButton();
        voiceButton?.classList.add('recording');
        voiceButton?.setAttribute('aria-label', 'Detener escucha');

        recognition.onresult = event => {
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const piece = event.results[i]?.[0]?.transcript?.trim() || '';
                if (event.results[i]?.isFinal && piece) finalText += `${piece} `;
            }

            if (!finalText.trim()) return;

            voiceState.transcript = `${voiceState.transcript} ${finalText}`.trim();
            clearTimeout(voiceState.voicePauseTimer);
            voiceState.voicePauseTimer = window.setTimeout(() => {
                const text = voiceState.transcript.trim();
                if (!text || voiceState.processing || !voiceState.active) return;

                voiceState.transcript = '';
                voiceState.listening = false;
                voiceState.restartOnEnd = false;

                try { recognition.stop(); } catch { }

                voiceButton?.classList.remove('recording');
                const input = getInput();
                if (input) input.value = text;

                voiceState.processing = true;
                setVoiceStatus('Procesando...', 'Estoy preparando la respuesta.');
                sendToAi(text, true);
            }, 650);
        };

        recognition.onerror = event => {
            voiceState.listening = false;
            voiceButton?.classList.remove('recording');

            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                add('El navegador no permitió usar el micrófono.');
                voiceState.active = false;
                setVoiceModeButton(false);
                setVoiceOverlay(false);
                return;
            }

            if (voiceState.active && !voiceState.processing) {
                setVoiceStatus('Escuchando...', 'La escucha se está reconectando.');
            }
        };

        recognition.onend = () => {
            voiceState.listening = false;
            voiceButton?.classList.remove('recording');

            if (voiceState.active && voiceState.restartOnEnd && !voiceState.processing) {
                window.setTimeout(() => startListening(), 180);
            }
        };

        try {
            recognition.start();
        }
        catch {
            voiceState.listening = false;
            voiceButton?.classList.remove('recording');
        }
    };
    // Aplica las acciones que el asistente ejecutó sobre la interfaz real.
    const applyAssistantActions = actions => {
        if (!Array.isArray(actions)) return;
        for (const action of actions) {
            if (!action || typeof action !== 'object') continue;
            if (action.type === 'cart.replace') {
                const incoming = Array.isArray(action.cart) ? action.cart : [];
                const catalog = window.ESFERestaurante?.catalogProducts?.() || [];
                const next = incoming.map(item => {
                    const dbId = Number(item.dbId || 0);
                    const product = catalog.find(p => Number(p.dbId || 0) === dbId || String(p.name).toLowerCase() === String(item.name || '').toLowerCase());
                    if (!product) return null;
                    return {productId:product.id,dbId:product.dbId||dbId,name:product.name,price:Number(product.price||item.price||0),image:product.image,qty:Math.max(1,Math.min(20,Number(item.qty||1))),ingredients:Array.isArray(product.ingredients)?product.ingredients:[]};
                }).filter(Boolean);
                window.ESFERestaurante?.cart?.replaceItems?.(next);
                window.dispatchEvent(new CustomEvent('esfe:assistant-cart-updated'));
            }
            if (action.type === 'checkout.open') {
                try {
                    sessionStorage.setItem('esfe_order_type',String(action.orderType||'Para llevar'));
                    sessionStorage.setItem('esfe_payment_method',String(action.method||'Efectivo'));
                    sessionStorage.setItem('esfe_assistant_auto_submit',action.autoSubmit?'1':'0');
                    if(action.phone) sessionStorage.setItem('esfe_delivery_phone',String(action.phone));
                    if(action.address) sessionStorage.setItem('esfe_delivery_address',String(action.address));
                    window.setTimeout(()=>{window.location.href='/ProcesarPago1/Index';},260);
                } catch { }
            }
        }
    };

    // Envío del mensaje al servicio de inteligencia artificial
    // Envía el mensaje al servicio de inteligencia artificial.
    const sendToAi = async (question, speakResponse = false) => {
        const text = String(question || '').trim();

        if (!text) return;

        const typing = addTyping();

        try {
            const token =
                document.querySelector(
                    'meta[name="request-verification-token"]'
                )?.content || '';

            // Prepara los encabezados que necesita la petición.
            const headers = {
                'Content-Type': 'application/json'
            };

            if (token) {
                headers['RequestVerificationToken'] = token;
            }

            const response = await fetch(
                '/api/chat/ask',
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers,
                    body: JSON.stringify({
                        message: text,
                        language: currentChatLocale().split('-')[0],
                        cart: window.ESFERestaurante?.cart?.getItems?.() || [],
                        draft: (()=>{try{return JSON.parse(localStorage.getItem('esfe_chat_order_draft')||'{}')}catch{return {}}})()
                    })
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();
            try { localStorage.setItem('esfe_chat_order_draft',JSON.stringify(data?.draft||{})); } catch { }
            applyAssistantActions(data?.actions);

            const answer =
                String(data?.answer || '').trim();

            removeTyping(typing);

            if (!answer) {
                add(
                    'No pude obtener una respuesta en este momento.'
                );

                if (speakResponse) {
                    voiceState.processing = false;
                    if (voiceState.active) {
                        voiceState.restartOnEnd = true;
                        setTimeout(startListening, 350);
                    }
                }

                return;
            }

            // La respuesta SIEMPRE aparece escrita.
            add(esc(answer), 'bot');

            // Solo habla cuando está activado el modo voz.
            if (speakResponse && voiceState.active) {
                setVoiceStatus('Hablando...', 'Escucha la respuesta. Después volveré a escucharte.');
                await speak(answer);
            }

            if (speakResponse) {
                voiceState.processing = false;
                if (voiceState.active) {
                    voiceState.restartOnEnd = true;
                    setTimeout(startListening, 180);
                }
            }
        }
        catch (error) {
            removeTyping(typing);

            console.error(
                'Error del asistente:',
                error
            );

            add(
                'El asistente no pudo responder en este momento. Intenta nuevamente.'
            );

            if (speakResponse) {
                voiceState.processing = false;
                if (voiceState.active) {
                    setVoiceStatus('Error temporal', 'Intentaré escucharte de nuevo.');
                    setTimeout(startListening, 800);
                }
            }
        }
    };
    // Envío de mensajes escritos
    bot.send = () => {
        const input = getInput();

        const text =
            String(input?.value || '').trim();

        if (!text) return;

        if (input) {
            input.value = '';
        }

        bot.toggle(true);

        add(esc(text), 'user');

        // El envío escrito muestra la respuesta sin activar la voz
        sendToAi(text, false);
    };
    // Acciones rápidas sugeridas para el usuario
    bot.ask = text => {
        const value =
            String(text || '').trim();

        if (!value) return;

        bot.toggle(true);

        add(esc(value), 'user');

        // Las sugerencias envían mensajes escritos
        sendToAi(value, false);
    };
    // Botón de micrófono para dictado
    bot.voice = {
        active: false,

        start() {
            // Si está activado el modo conversación,
            // el botón controla la escucha actual.
            if (voiceState.active) {
                if (voiceState.listening) {
                    stopListening();
                }
                else {
                    startListening();
                }

                return;
            }

            if (!canUseSpeechRecognition()) {
                add(
                    'Este navegador no tiene reconocimiento de voz disponible.'
                );
                return;
            }

            stopListening();

            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;

            const recognition =
                new SpeechRecognition();

            recognition.lang = currentChatLocale();
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;

            voiceState.recognition = recognition;
            voiceState.listening = true;

            const button = getVoiceButton();

            button?.classList.add('recording');

            button?.setAttribute(
                'aria-label',
                'Detener grabación'
            );

            recognition.onresult = event => {
                const text =
                    event.results?.[0]?.[0]?.transcript?.trim() || '';

                voiceState.listening = false;

                button?.classList.remove('recording');

                if (!text) return;

                const input = getInput();

                if (input) {
                    input.value = text;
                }

                // El micrófono normal envía el texto reconocido
                // envía el texto y responde SOLO ESCRITO.
                bot.send();
            };

            recognition.onerror = event => {
                voiceState.listening = false;
                button?.classList.remove('recording');

                if (
                    event.error !== 'aborted'
                ) {
                    add(
                        'No pude procesar el audio. Puedes intentarlo nuevamente.'
                    );
                }
            };

            recognition.onend = () => {
                voiceState.listening = false;
                button?.classList.remove('recording');
            };

            try {
                recognition.start();
            }
            catch {
                voiceState.listening = false;
                button?.classList.remove('recording');
            }
        },

        stop() {
            stopListening();
        }
    };
    // Flujo de conversación continua por voz
    // Activa o desactiva el modo de conversación continua por voz.
    const toggleVoiceMode = () => {
        voiceState.active = !voiceState.active;

        setVoiceModeButton(
            voiceState.active
        );

        if (!voiceState.active) {
            voiceState.processing = false;
            stopListening();
            setVoiceOverlay(false);

            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }

            return;
        }

        bot.toggle(true);
        setVoiceOverlay(true);
        setVoiceStatus('Preparando...', 'Activa el micrófono y habla normalmente.');

        if (!canUseSpeechRecognition()) {
            add(
                'Tu navegador no permite conversación por voz.'
            );

            voiceState.active = false;
            setVoiceModeButton(false);
            setVoiceOverlay(false);
            return;
        }

        if (!canUseSpeechSynthesis()) {
            add(
                'Tu navegador no tiene síntesis de voz disponible.'
            );

            voiceState.active = false;
            setVoiceModeButton(false);
            setVoiceOverlay(false);
            return;
        }

        setTimeout(startListening, 300);
    };

    bot.stopVoiceMode = () => {
        voiceState.active = false;
        voiceState.processing = false;
        stopListening();
        setVoiceModeButton(false);
        setVoiceOverlay(false);
        try { window.speechSynthesis?.cancel(); } catch { }
    };
    // Inicialización del chatbot y sus eventos
    // Evento que conecta una acción del usuario con la lógica del módulo.
    document.addEventListener(
        'DOMContentLoaded',
        () => {
            const voiceButton =
                getVoiceButton();

            // Evento que conecta una acción del usuario con la lógica del módulo.
            voiceButton?.addEventListener(
                'click',
                () => bot.voice.start()
            );

            const voiceModeButton =
                getVoiceModeButton();

            // Evento que conecta una acción del usuario con la lógica del módulo.
            voiceModeButton?.addEventListener(
                'click',
                toggleVoiceMode
            );

            // Mensaje inicial con el nombre o el rol para que se sienta personal.
            const messages = document.getElementById('chatMessages');
            if (messages && !messages.children.length) {
                const name = String(document.body?.dataset.userName || '').trim();
                const role = String(document.body?.dataset.role || '').trim().toLowerCase();
                const roleNames = { administrador: 'admin', dueno: 'admin', barra: 'barra', cocina: 'cocina', repartidor: 'repartidor', cliente: 'cliente' };
                const who = role === 'administrador' || role === 'dueno' ? roleNames[role] : (name || roleNames[role] || 'usuario');
                const greeting = `Hola, ${who}.`;
                messages.innerHTML = `
                    <div class="chat-empty-state">
                        <div>
                            <span class="chat-empty-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M7 10.5a5 5 0 0 1 10 0v3.1a3.9 3.9 0 0 1-3.9 3.9H11l-2.8 2v-2.8A4 4 0 0 1 5 12.8v-1.4a5 5 0 0 1 2-0.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M9 12h.01M15 12h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </span>
                            <strong>${esc(greeting)}</strong>
                            <p>Estoy aquí para ayudarte con el menú, pedidos, reservas y pagos.</p>
                        </div>
                    </div>`;
            }

            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('chatVoiceModeClose')?.addEventListener(
                'click',
                () => bot.stopVoiceMode()
            );

            setVoiceModeButton(false);
        }
    );

    bot.__enhancedReady = true;
})();
