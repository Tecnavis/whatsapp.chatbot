document.getElementById('send-button').addEventListener('click', async () => {
    const messageInput = document.getElementById('message-input');
    const messagesDiv = document.getElementById('messages');
    const userMessage = messageInput.value.trim();
  
    if (userMessage) {
      // Display the user's message
      const userMessageDiv = document.createElement('div');
      userMessageDiv.textContent = `You: ${userMessage}`;
      messagesDiv.appendChild(userMessageDiv);
  
      // Send the message to the server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMessage })
      });
  
      if (response.ok) {
        const data = await response.json();
        const botMessage = data.responseMessage;
  
        // Display the bot's response
        const botMessageDiv = document.createElement('div');
        botMessageDiv.textContent = `Bot: ${botMessage}`;
        messagesDiv.appendChild(botMessageDiv);
      }
  
      // Clear the input field
      messageInput.value = '';
    }
  });
  