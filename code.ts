const rewriteText = async (inputText: string, apiKey: string, type: string): Promise<string> => {
  try {
    // Remove surrounding quotes from the input text if present
    const sanitizedInputText = inputText.replace(/^"|"$/g, '');

    // Calculate the approximate number of tokens based on character count
    const characterCount = sanitizedInputText.length;
    const maxTokens = Math.ceil(characterCount / 4) + 10; // Rough estimate: 1 token ~ 4 characters

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      const errorText = await response.text();
      throw new Error(`${response.status} - ${response.statusText}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error during API call:', error);
    throw error;
  }
};

// Main function that handles plugin behavior
figma.on('run', async () => {
  let apiKey = await figma.clientStorage.getAsync('openaiApiKey');
  if (!apiKey) {
    figma.showUI(__html__, { width: 300, height: 150 });

    figma.ui.onmessage = async (message) => {
      if (message.type === 'submit-api-key') {
        apiKey = message.apiKey;
        await figma.clientStorage.setAsync('openaiApiKey', apiKey);
        figma.notify('API key saved successfully!');
        figma.closePlugin();
      }
    };
    return;
  }

  let lastTextNode: TextNode | null = null;

  const updateUI = (textNode: TextNode) => {
    const selectedText = textNode.characters;
    figma.ui.postMessage({ type: 'load-text', selectedText });
  };

  const refreshUI = () => {
    const selectedNodes = figma.currentPage.selection;
    if (selectedNodes.length > 0 && selectedNodes[0].type === 'TEXT') {
      const currentTextNode = selectedNodes[0] as TextNode;
      if (lastTextNode !== currentTextNode) {
        lastTextNode = currentTextNode;
        updateUI(lastTextNode);
      }
    } else if (lastTextNode) {
      figma.notify('Please select a text layer to rewrite.');
      updateUI(lastTextNode);
    } else {
      figma.notify('Please select a text layer to rewrite.');
    }
  };

  figma.showUI(__html__, { width: 300, height: 300 }); // Initial size
  refreshUI();

  figma.on('selectionchange', refreshUI);

  figma.ui.onmessage = async (message) => {
    if (message.type === 'resize-ui') {
      // Resize the UI to the height received from the frontend
      figma.ui.resize(300, message.height);
    } else if (message.type === 'rewrite-text') {
      try {
        if (lastTextNode) {
          await figma.loadFontAsync(lastTextNode.fontName as FontName);
          const rewrittenText = await rewriteText(message.selectedText, apiKey, message.rewriteType);
          lastTextNode.characters = rewrittenText;
          figma.notify('Text rewritten successfully!');
        }
      } catch (error) {
        figma.notify('Failed to rewrite text. Please check the console for more details.');
        console.error('Error rewriting text:', error);
      }
      figma.closePlugin();
    }
  };
});
