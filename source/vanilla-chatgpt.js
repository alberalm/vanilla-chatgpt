/*****************************************************************************
* vanilla-chatgpt.js - chat library for openai-chatgpt
* last updated on 2023/03/28, v0.60, basic chat, responsive, print-friendly, export.
*
* Copyright (c) 2023, Casualwriter (MIT Licensed)
* https://github.com/casualwriter/vanilla-chatgpt
*****************************************************************************/

const chat = function(id) { return window.document.getElementById(id); };

// Set the API endpoint URL
chat.endPoint = "https://mamba-foundry.cognitiveservices.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2025-01-01-preview";
chat.model = "gpt-4.1";
chat.body = { model: chat.model, temperature: 0.8 };
chat.history = [];

// stream result from openai
chat.stream = function(prompt) {

  chat.body.stream = true;
  chat.body.messages = [{ role: "user", content: prompt }];
  chat.headers = { "Authorization": "Bearer " + chat.apiKey, "Content-Type": "application/json" };
  chat.result = '';
  
  // Build message history
  for (var i = chat.history.length - 1; i >= 0 && i > (chat.history.length - 3); i--) {
    chat.body.messages.unshift({ role: 'assistant', content: chat.history[i].result });
    chat.body.messages.unshift({ role: 'user', content: chat.history[i].prompt });
  }
  
  fetch(chat.endPoint, { 
    method: 'POST', 
    headers: chat.headers, 
    body: JSON.stringify(chat.body)
  })
  .then(function(response) {
  
    if (!response.ok) {
      if (response.status == 401) throw new Error('401 Unauthorized, invalid API Key');
      throw new Error('failed to get data, error status ' + response.status);
    }
    
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    
    function processStream() {
      return reader.read().then(function(result) {
        
        if (result.done) {
          return chat.oncomplete(chat.result);
        }
        
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        
        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j];
          if (!line.startsWith("data:")) continue;
          
          var data = line.slice(5).trim();
          if (data === "[DONE]") {
            return chat.oncomplete(chat.result);
          }
          
          try {
            chat.json = JSON.parse(data);
            // Replace optional chaining with safe property access
            if (chat.json.choices && 
                chat.json.choices[0] && 
                chat.json.choices[0].delta && 
                chat.json.choices[0].delta.content) {
              chat.result += chat.json.choices[0].delta.content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        
        chat.onmessage(chat.result);
        return processStream();
      });
    }
    
    return processStream();
    
  }).catch(chat.onerror);

};
    
// send prompt to openai API (not used in vanilla-chatGPT)
chat.send = function(prompt) {
  
  chat.body.stream = false;
  chat.body.messages = [{ role: "user", content: prompt }];
  chat.headers = { "Authorization": "Bearer " + chat.apiKey, "Content-Type": "application/json" };
  chat.result = '';
   
  fetch(chat.endPoint, { 
    method: 'POST', 
    headers: chat.headers, 
    body: JSON.stringify(chat.body)
  })
  .then(function(response) { return response.json(); })
  .then(function(json) {
    chat.json = json;
    if (json.choices) {
      chat.result = json.choices[0].message.content;
      chat.onmessage(chat.result);
      chat.oncomplete(chat.result);
    }	 
  })
  .catch(function(error) { console.error(error); });
};

// default error handle
chat.onerror = function(error) { alert(error); };

// clear API key when logout
chat.logout = function() { 
  if (confirm('Logout and clear API Key?')) localStorage.clear();
};

// export conversation
chat.export = function(fname) {
  var link = document.createElement('a');
  link.href = 'data:text/plain;charset=utf-8,';
  for (var i = 0; i < chat.history.length; i++) {
    var x = chat.history[i];
    link.href += encodeURIComponent('### ' + x.prompt + '\n\n' + x.result + '\n\n');
  }
  link.download = fname || ('chat-' + new Date().toISOString().substr(0, 16)) + '.md';
  link.click();
};