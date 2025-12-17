import { useState } from 'react';
import { sendMessageToGemini } from './services/geminiService'; // Fixed import path
import './App.css';

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

    // Add User Message
    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call Service
      const responseText = await sendMessageToGemini(input);

      // Add AI Message
      const aiMessage: ChatMessage = { role: 'model', text: responseText };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = { role: 'model', text: "Error: Could not reach Gemini." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Gemini 3 Pro Chat</h1>
      
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        height: '400px', 
        overflowY: 'auto', 
        padding: '10px', 
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: msg.role === 'user' ? '#007bff' : '#f1f1f1',
            color: msg.role === 'user' ? 'white' : 'black',
            padding: '10px',
            borderRadius: '10px',
            maxWidth: '80%'
          }}>
            <strong>{msg.role === 'user' ? 'You' : 'Gemini'}: </strong>
            {msg.text}
          </div>
        ))}
        {isLoading && <div><em>Gemini is typing...</em></div>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          style={{ flex: 1, padding: '10px' }}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading} style={{ padding: '10px 20px' }}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
