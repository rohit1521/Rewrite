"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const rewriteText = (inputText, apiKey, type) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Remove surrounding quotes from the input text if present
        const sanitizedInputText = inputText.replace(/^"|"$/g, '');
        // Calculate the approximate number of tokens based on character count
        const characterCount = sanitizedInputText.length;
        const maxTokens = Math.ceil(characterCount / 4) + 10; // Rough estimate: 1 token ~ 4 characters
        const response = yield fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: `Rephrase and rewrite the following sentence as a ${type}, similar to Microsoft's UX copy for apps and products, not marketing materials: ${sanitizedInputText}` }],
                max_tokens: maxTokens,
                temperature: 0.7
            })
        });
        if (response.status === 429) {
            throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`${response.status} - ${response.statusText}: ${errorText}`);
        }
        const data = yield response.json();
        return data.choices[0].message.content.trim();
    }
    catch (error) {
        console.error('Error during API call:', error);
        throw error;
    }
});
// Main function that handles plugin behavior
figma.on('run', () => __awaiter(void 0, void 0, void 0, function* () {
    let apiKey = yield figma.clientStorage.getAsync('openaiApiKey');
    if (!apiKey) {
        figma.showUI(__html__, { width: 300, height: 150 });
        figma.ui.onmessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
            if (message.type === 'submit-api-key') {
                apiKey = message.apiKey;
                yield figma.clientStorage.setAsync('openaiApiKey', apiKey);
                figma.notify('API key saved successfully!');
                figma.closePlugin();
            }
        });
        return;
    }
    let lastTextNode = null;
    const updateUI = (textNode) => {
        const selectedText = textNode.characters;
        figma.ui.postMessage({ type: 'load-text', selectedText });
    };
    const refreshUI = () => {
        const selectedNodes = figma.currentPage.selection;
        if (selectedNodes.length > 0 && selectedNodes[0].type === 'TEXT') {
            const currentTextNode = selectedNodes[0];
            if (lastTextNode !== currentTextNode) {
                lastTextNode = currentTextNode;
                updateUI(lastTextNode);
            }
        }
        else if (lastTextNode) {
            figma.notify('Please select a text layer to rewrite.');
            updateUI(lastTextNode);
        }
        else {
            figma.notify('Please select a text layer to rewrite.');
        }
    };
    figma.showUI(__html__, { width: 300, height: 300 }); // Initial size
    refreshUI();
    figma.on('selectionchange', refreshUI);
    figma.ui.onmessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
        if (message.type === 'resize-ui') {
            // Resize the UI to the height received from the frontend
            figma.ui.resize(300, message.height);
        }
        else if (message.type === 'rewrite-text') {
            try {
                if (lastTextNode) {
                    yield figma.loadFontAsync(lastTextNode.fontName);
                    const rewrittenText = yield rewriteText(message.selectedText, apiKey, message.rewriteType);
                    lastTextNode.characters = rewrittenText;
                    figma.notify('Text rewritten successfully!');
                }
            }
            catch (error) {
                figma.notify('Failed to rewrite text. Please check the console for more details.');
                console.error('Error rewriting text:', error);
            }
            figma.closePlugin();
        }
    });
}));
