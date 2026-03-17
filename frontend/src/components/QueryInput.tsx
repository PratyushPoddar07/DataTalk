import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  placeholder?: string;
}

export default function QueryInput({ 
  onSubmit, 
  isLoading,
  query,
  setQuery,
  placeholder = "Ask your data anything..."
}: QueryInputProps) {
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSubmit(query.trim());
      setQuery('');
    }
  };
  
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition not supported in your browser');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [query]);
  
  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card relative">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={placeholder}
              className="w-full bg-transparent text-slate-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none min-h-[60px] max-h-[200px]"
              rows={1}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Voice input button */}
            <motion.button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-3 rounded-lg transition-all ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'glass-effect hover:bg-white/10'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isLoading}
            >
              {isListening ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-gray-300" />
              )}
            </motion.button>
            
            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={!query.trim() || isLoading}
              className={`p-3 rounded-lg transition-all ${
                query.trim() && !isLoading
                  ? 'bg-primary-600 hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-500/50'
                  : 'glass-effect opacity-50 cursor-not-allowed'
              }`}
              whileHover={query.trim() && !isLoading ? { scale: 1.05 } : {}}
              whileTap={query.trim() && !isLoading ? { scale: 0.95 } : {}}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </motion.button>
          </div>
        </div>
        
        {/* Voice listening indicator */}
        {isListening && (
          <motion.div
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-full">
              Listening...
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Quick suggestions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          "Show me all customers",
          "What are the top 10 products by revenue?",
          "Count orders by status",
        ].map((suggestion, index) => (
          <motion.button
            key={index}
            type="button"
            onClick={() => setQuery(suggestion)}
            className="text-xs glass-effect px-3 py-1.5 rounded-full text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </motion.form>
  );
}
