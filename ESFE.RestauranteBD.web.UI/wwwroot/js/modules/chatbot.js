
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

    // Procesa la información de add.
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
    // Reproducción por voz de las respuestas del asistente
    // Reproduce en voz alta la respuesta del asistente.
    const speak = text => {
        if (!canUseSpeechSynthesis() || !text) return Promise.resolve();

        return new Promise(resolve => {
            try {
                window.speechSynthesis.cancel();

                const utterance =
                    new SpeechSynthesisUtterance(String(text));

                utterance.lang = 'es-SV';
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
    // Estado compartido del módulo: voiceState.
    const voiceState = {
        active: false,
        listening: false,
        processing: false,
        recognition: null,
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

    // Inicia la captura de voz del usuario.
    const startListening = () => {
        if (!voiceState.active || voiceState.processing || voiceState.listening) return;

        if (!canUseSpeechRecognition()) {
            add(
                'Este navegador no tiene reconocimiento de voz disponible.'
            );
            voiceState.active = false;
            setVoiceModeButton(false);
            return;
        }

        stopListening();

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        const recognition = new SpeechRecognition();

        recognition.lang = 'es-SV';
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        voiceState.recognition = recognition;
        voiceState.listening = true;
        setVoiceStatus('Escuchando...', 'Habla normalmente con el asistente.');

        const voiceButton = getVoiceButton();

        voiceButton?.classList.add('recording');
        voiceButton?.setAttribute(
            'aria-label',
            'Detener escucha'
        );

        recognition.onresult = event => {
            const text =
                event.results?.[0]?.[0]?.transcript?.trim() || '';

            voiceState.listening = false;

            voiceButton?.classList.remove('recording');

            if (!text) {
                if (voiceState.active) {
                    setTimeout(startListening, 250);
                }
                return;
            }

            const input = getInput();

            if (input) {
                input.value = text;
            }

            // Evita que onend vuelva a activar el micrófono mientras Gemini responde.
            voiceState.processing = true;
            setVoiceStatus('Procesando...', 'Estoy preparando la respuesta.');
            sendToAi(text, true);
        };

        recognition.onerror = event => {
            voiceState.listening = false;
            voiceButton?.classList.remove('recording');

            if (
                event.error === 'not-allowed' ||
                event.error === 'service-not-allowed'
            ) {
                add(
                    'El navegador no permitió usar el micrófono.'
                );

                voiceState.active = false;
                setVoiceModeButton(false);
                setVoiceOverlay(false);

                return;
            }

            if (voiceState.active) {
                setTimeout(startListening, 500);
            }
        };

        recognition.onend = () => {
            voiceState.listening = false;
            voiceButton?.classList.remove('recording');

            if (voiceState.active && !voiceState.processing) {
                setTimeout(startListening, 300);
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

            // Estado compartido del módulo: headers.
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
                        message: text
                    })
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

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
                        setTimeout(startListening, 500);
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
                    setTimeout(startListening, 250);
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

            recognition.lang = 'es-SV';
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
