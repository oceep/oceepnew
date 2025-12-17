import { useState } from 'react';
import { sendMessageToGemini } from './services/gemini';
import './App.css'; // Assuming you have basic styles

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 1. Add user message to UI
    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. Call the new Puter.js service
      const responseText = await sendMessageToGemini(input);

      // 3. Add Gemini's response to UI
      const aiMessage: ChatMessage = { role: 'model', text: responseText };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = { role: 'model', text: "Sorry, something went wrong with Gemini." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Gemini 3 Pro (via Puter.js)</h1>
      </header>

      <div className="chat-window">
        {messages.length === 0 && (
          <p className="placeholder">Ask Gemini 3 Pro anything...</p>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'Gemini'}:</strong>
            <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
          </div>
        ))}
        
        {isLoading && <div className="loading">Thinking...</div>}
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message here..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
