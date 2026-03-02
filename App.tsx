/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  LogIn, 
  UserPlus, 
  Building2, 
  Database, 
  PlusCircle, 
  ClipboardList, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Send,
  ArrowLeft,
  FlaskConical,
  Thermometer,
  Droplets,
  Sun,
  Flame,
  Bomb,
  Waves,
  Snowflake,
  Zap,
  ShieldCheck
} from 'lucide-react';

type Page = 
  | 'loading' 
  | 'login' 
  | 'signup' 
  | 'company' 
  | 'company_signup' 
  | 'add_user' 
  | 'add_chemical' 
  | 'chemical_question' 
  | 'chemical_inventory'
  | 'chemical_reply'
  | 'inventory_detail';

interface User {
  user_ID: string;
  user_full_name: string;
  user_level: number;
  user_name: string;
}

interface Company {
  company_ID: string;
  company_name: string;
}

interface Chemical {
  chemical_CAS: string;
  chemical_name: string;
  chemical_level?: number;
  life_storage?: string;
  condition?: string;
  stored_for?: string;
  extra_user?: string;
  extra_info?: string;
  temperature?: string;
  humidity?: string;
  light_exposure?: string;
  flammable?: string;
  explosive?: string;
  boiling_point?: string;
  freezing_point?: string;
  ignition_point?: string;
  safe?: string;
  user_ID?: string;
  user_full_name?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// --- Page 06: Add Chemical ---
const AddChemicalPage = ({ company, ai, setCurrentPage, loading, setLoading, showMessage }: any) => {
  const [cas, setCas] = useState('');
  const [chemicalName, setChemicalName] = useState('');
  const [lookupStep, setLookupStep] = useState<'input' | 'confirm' | 'fetching_osha' | 'set_level'>('input');
  const [chemicalData, setChemicalData] = useState<any>(null);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'bot', text: "Hello! I'm here to help you register a new chemical. Please enter the Chemical CAS number to begin." }]);
    }
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleLookup = async (casValue: string) => {
    setLoading(true);
    setCas(casValue);
    setMessages(prev => [...prev, { role: 'user', text: casValue }]);
    try {
      // 1. First, perform the direct GET request to OSHA via our proxy
      const oshaRes = await window.fetch(`/api/osha/lookup/${casValue}`);
      const oshaData = await oshaRes.json();
      
      let context = "";
      if (oshaData.success && oshaData.htmlSnippet && oshaData.htmlSnippet.length > 500) {
        context = `Here is the HTML context from OSHA's database for CAS ${casValue}: ${oshaData.htmlSnippet}`;
      } else {
        // Fallback to CAMEO for name lookup if OSHA fails
        const cameoRes = await window.fetch(`/api/cameo/lookup/${casValue}`);
        const cameoData = await cameoRes.json();
        if (cameoData.success) {
          context = `Here is the HTML context from CAMEO Chemicals database for CAS ${casValue}: ${cameoData.htmlSnippet}`;
        }
      }

      // 2. Use Gemini to parse the data or fallback to search if needed
      // Re-initialize AI instance to ensure fresh key
      const aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await aiInstance.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Task: Identify the chemical name for CAS number ${casValue}.
        ${context ? `Context from official databases: ${context}` : "Please search the internet for this CAS number."}
        
        Use your internal knowledge and search results to provide the most accurate official common or IUPAC name. 
        Even if the search is inconclusive, provide the most likely name associated with this CAS number based on chemical databases. 
        IMPORTANT: Return ONLY the name of the chemical. Do not include sentences, explanations, or phrases like "The chemical name is...". 
        Do not return "NOT_FOUND"; always return a valid chemical name.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = response.text;
      let finalName = "";
      if (!text || text.toLowerCase().includes('not_found') || text.trim().length < 2) {
        // Final fallback: if AI still fails, we'll try one more time with a very direct instruction
        const fallbackRes = await aiInstance.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `What is the chemical name for CAS ${casValue}? Provide ONLY the name.`,
        });
        finalName = fallbackRes.text?.trim() || "";
        if (finalName && finalName.length > 2) {
          setChemicalName(finalName);
        } else {
          setMessages(prev => [...prev, { role: 'bot', text: "I'm having trouble identifying this CAS number. Please ensure it's correct (e.g., 64-17-5)." }]);
          return;
        }
      } else {
        finalName = text.replace(/[*_#`]/g, '').split('\n')[0].trim();
        setChemicalName(finalName);
      }
      
      setLookupStep('confirm');
      setMessages(prev => [...prev, { role: 'bot', text: `Question 01: Is the name of the chemical you want to add to the database is "${casValue} - ${finalName}"?` }]);
    } catch (e: any) {
      console.error("Lookup error:", e);
      setMessages(prev => [...prev, { role: 'bot', text: "I encountered an error while communicating with the safety databases. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (yes: boolean) => {
    setMessages(prev => [...prev, { role: 'user', text: yes ? 'Yes' : 'No' }]);
    if (!yes) {
      setLookupStep('input');
      setCas('');
      setChemicalName('');
      setMessages(prev => [...prev, { role: 'bot', text: "No problem. Let's try again. Please enter the correct Chemical CAS number." }]);
      return;
    }
    
    setLookupStep('fetching_osha'); // Reusing state for fetching safety data
    setLoading(true);
    setMessages(prev => [...prev, { role: 'bot', text: `Great. I'm now searching CAMEO Chemicals for official safety and storage data for ${chemicalName}. This will just take a moment...` }]);
    
    try {
      // 1. Fetch direct data from CAMEO proxy
      let context = "";
      try {
        const cameoRes = await window.fetch(`/api/cameo/lookup/${cas}`);
        if (cameoRes.ok) {
          const cameoData = await cameoRes.json();
          if (cameoData.success && cameoData.htmlSnippet) {
            context = `Context from CAMEO Chemicals for CAS ${cas}: ${cameoData.htmlSnippet}`;
          }
        }
      } catch (fetchErr) {
        console.warn("CAMEO fetch failed, will rely on search:", fetchErr);
      }

      // 2. Use Gemini to parse the data, with Google Search as fallback
      // Re-initialize AI instance to ensure fresh key
      const aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await aiInstance.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Task: Extract official safety and storage data for the chemical "${chemicalName}" (CAS: ${cas}).
        
        Search for this chemical on CAMEO Chemicals (NOAA) or other reliable safety databases.
        
        ${context ? `I have some data from a direct lookup that might help:
        ---
        ${context}
        ---` : ""}
        
        Provide the following details in JSON format. 
        IMPORTANT: You MUST provide a value for every field. If a specific value is not explicitly found in the search results, use your scientific knowledge to provide a safe, conservative estimate or the most common value for this class of chemicals. Do not use "N/A" or "Unknown".
        
        {
          "temperature": "recommended storage temperature (e.g., 15-25°C)",
          "humidity": "recommended storage humidity (e.g., <60%)",
          "light_exposure": "light exposure requirements (e.g., Store in dark)",
          "flammable": "Yes/No",
          "explosive": "Yes/No",
          "boiling_point": "boiling point value",
          "freezing_point": "freezing point value",
          "ignition_point": "ignition point value",
          "safe": "list of incompatible chemicals (Cannot be stored with)"
        }`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("AI returned no text");
      
      // Robust JSON extraction
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not find JSON in AI response");
      
      const data = JSON.parse(jsonMatch[0]);
      setChemicalData(data);
      
      const infoText = `
**Safety Information Found:**
- **Temperature:** ${data.temperature}
- **Humidity:** ${data.humidity}
- **Light exposure:** ${data.light_exposure}
- **Flammable:** ${data.flammable}
- **Explosive:** ${data.explosive}
- **Boiling point:** ${data.boiling_point}
- **Freezing point:** ${data.freezing_point}
- **Ignition point:** ${data.ignition_point}
- **Cannot be stored with:** ${data.safe}
      `;
      setMessages(prev => [...prev, { role: 'bot', text: infoText.trim() }]);
      setMessages(prev => [...prev, { role: 'bot', text: "What level of authorization do you want to handle this chemical? (1 to 5)" }]);
      setLookupStep('set_level');
    } catch (e: any) {
      console.error("Safety lookup error:", e);
      setMessages(prev => [...prev, { role: 'bot', text: `I'm sorry, I couldn't retrieve the safety data from CAMEO Chemicals at this time. (Error: ${e.message || 'Unknown error'})` }]);
      setLookupStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleSetLevel = async (level: number) => {
    setMessages(prev => [...prev, { role: 'user', text: `Level ${level}` }]);
    setLoading(true);
    try {
      const saveRes = await window.fetch('/api/chemical/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cas, 
          name: chemicalName, 
          oshaData: { ...chemicalData, chemical_level: level } 
        })
      });
      const saveData = await saveRes.json();
      
      if (saveData.success) {
        setMessages(prev => [...prev, { role: 'bot', text: "Chemical saved." }]);
        setMessages(prev => [...prev, { role: 'bot', text: "Please enter the Chemical CAS number to begin." }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: "I encountered an error while saving it to the database." }]);
      }
      
      setLookupStep('input');
      setCas('');
      setChemicalName('');
      setChemicalData(null);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', text: "Error saving chemical." }]);
      setLookupStep('input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[80vh] flex flex-col bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
            <PlusCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Registration Assistant</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{company?.company_name}</p>
          </div>
        </div>
        <button onClick={() => setCurrentPage('company')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {messages.map((m, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, x: m.role === 'bot' ? -10 : 10 }} 
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${m.role === 'bot' ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium shadow-sm ${
              m.role === 'bot' 
                ? 'bg-white text-slate-700 border border-slate-100' 
                : 'bg-slate-900 text-white'
            }`}>
              {m.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl text-sm font-medium shadow-sm border border-slate-100 flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        {lookupStep === 'input' && (
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Enter CAS number (e.g. 64-17-5)"
              value={cas || ''}
              onChange={e => setCas(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleLookup(cas)}
              disabled={loading}
            />
            <button 
              onClick={() => handleLookup(cas)} 
              disabled={loading || !cas.trim()}
              className="p-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        )}

        {lookupStep === 'confirm' && (
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => handleConfirm(true)} 
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Yes, that's it
            </button>
            <button 
              onClick={() => handleConfirm(false)} 
              disabled={loading}
              className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              No, try again
            </button>
          </div>
        )}

        {lookupStep === 'fetching_osha' && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-400 animate-pulse">Communicating with safety databases...</p>
          </div>
        )}

        {lookupStep === 'set_level' && (
          <div className="flex flex-wrap gap-2 justify-center">
            {[1, 2, 3, 4, 5].map(lvl => (
              <button 
                key={lvl}
                onClick={() => handleSetLevel(lvl)} 
                disabled={loading}
                className="w-12 h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {lvl}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Page 07: SafeFlow Assistant ---
const ChemicalQuestionPage = ({ user, company, ai, setCurrentPage, loading, setLoading, showMessage, setSelectedChemical }: any) => {
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0);
  const [chatData, setChatData] = useState<any>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      const displayName = user?.user_full_name || company?.company_name || 'Guest';
      setMessages([{ role: 'bot', text: `Hi, ${displayName}. What is the Chemical CAS or Chemical name you want to store?` }]);
    }
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, user, company]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');

    if (step === 0) {
      setLoading(true);
      try {
        const res = await window.fetch('/api/chatbot/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userText })
        });
        const data = await res.json();
        
        if (data.success) {
          setChatData({ ...chatData, chemical: data.chemical });
          setMessages(prev => [...prev, { role: 'bot', text: `Do you want to store ${data.chemical.chemical_CAS} - ${data.chemical.chemical_name}? (Yes/No)` }]);
          setStep(1);
        } else {
          setMessages(prev => [
            ...prev, 
            { role: 'bot', text: "The chemist was not found in the system, please contact the person in charge or try again." },
            { role: 'bot', text: "What is the Chemical CAS or Chemical name you want to store?" }
          ]);
          setStep(0);
        }
      } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'bot', text: `I'm having trouble connecting to my systems. Please try again in a moment.` }]);
      } finally {
        setLoading(false);
      }
    } else if (step === 1) {
      if (userText.toLowerCase() === 'yes') {
        const userLevel = user?.user_level || 0;
        if (userLevel >= (chatData.chemical.chemical_level || 0)) {
          setMessages(prev => [...prev, { role: 'bot', text: `How long the chemical is going to be stored? (Numbers only)` }]);
          setStep(2);
        } else {
          setMessages(prev => [...prev, { role: 'bot', text: `You don't have authorization store this chemical. What is the Chemical CAS or Chemical name you want to store?` }]);
          setStep(0);
        }
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: `What is the Chemical CAS or Chemical name you want to store?` }]);
        setStep(0);
      }
    } else if (step === 2) {
      if (!isNaN(parseInt(userText))) {
        setChatData({ ...chatData, lifeStorage: userText });
        setMessages(prev => [...prev, { role: 'bot', text: `What is the condition of the container? (Sealed/Open)` }]);
        setStep(3);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: `Please enter only numbers. How long the chemical is going to be stored?` }]);
      }
    } else if (step === 3) {
      const cond = userText.toLowerCase();
      if (cond === 'sealed' || cond === 'open') {
        setChatData({ ...chatData, condition: userText });
        setMessages(prev => [...prev, { role: 'bot', text: `Do you have extra information to save? (Yes/No)` }]);
        setStep(4);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: `Please enter "Sealed" or "Open". What is the condition of the container?` }]);
      }
    } else if (step === 4) {
      if (userText.toLowerCase() === 'yes') {
        setMessages(prev => [...prev, { role: 'bot', text: `Please enter the extra information:` }]);
        setStep(5);
      } else {
        await window.fetch('/api/chatbot/save-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cas: chatData.chemical.chemical_CAS, 
            lifeStorage: chatData.lifeStorage, 
            condition: chatData.condition,
            storedFor: user ? `${user.user_ID} - ${user.user_full_name}` : `Company: ${company?.company_name}`,
            extraUser: ''
          })
        });
        setSelectedChemical({ ...chatData.chemical, life_storage: chatData.lifeStorage, condition: chatData.condition, stored_for: user ? `${user.user_ID} - ${user.user_full_name}` : `Company: ${company?.company_name}` });
        setCurrentPage('chemical_reply');
      }
    } else if (step === 5) {
      await window.fetch('/api/chatbot/save-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cas: chatData.chemical.chemical_CAS, 
          lifeStorage: chatData.lifeStorage, 
          condition: chatData.condition,
          storedFor: user ? `${user.user_ID} - ${user.user_full_name}` : `Company: ${company?.company_name}`,
          extraUser: userText
        })
      });
      setSelectedChemical({ ...chatData.chemical, life_storage: chatData.lifeStorage, condition: chatData.condition, extra_user: userText, stored_for: user ? `${user.user_ID} - ${user.user_full_name}` : `Company: ${company?.company_name}` });
      setCurrentPage('chemical_reply');
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-[80vh] flex flex-col bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">SafeFlow Assistant</h2>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Active Session</p>
          </div>
        </div>
        <button onClick={() => setCurrentPage(user ? 'login' : 'company')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {messages.map((m, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, x: m.role === 'bot' ? -10 : 10 }} 
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${m.role === 'bot' ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium shadow-sm ${
              m.role === 'bot' 
                ? 'bg-white text-slate-700 border border-slate-100' 
                : 'bg-emerald-600 text-white'
            }`}>
              {m.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl text-sm font-medium shadow-sm border border-slate-100 flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> SafeFlow is thinking...
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input 
            type="text" 
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Shared Components ---
const Header = ({ title, onBack }: { title: string; onBack?: () => void }) => (
  <div className="flex items-center justify-between mb-8">
    <div className="flex items-center gap-4">
      {onBack && (
        <button onClick={onBack} className="p-2 hover:bg-black/5 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
      )}
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
    </div>
    <div className="flex items-center gap-2 text-slate-500">
      <FlaskConical className="w-6 h-6 text-emerald-600" />
      <span className="font-semibold tracking-widest text-xs uppercase">SafeFlow AI</span>
    </div>
  </div>
);

const DataItem = ({ icon: Icon, label, value, color = "text-slate-500" }: any) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="font-bold text-slate-700 text-sm">{value || 'N/A'}</p>
    </div>
  </div>
);

// --- Page 09: Chemical Inventory ---
const ChemicalInventoryPage = ({ setCurrentPage, setSelectedChemical }: any) => {
  const [chemicals, setChemicals] = useState<Chemical[]>([]);

  useEffect(() => {
    const getInventory = async () => {
      try {
        const res = await window.fetch('/api/inventory');
        const data = await res.json();
        setChemicals(data.chemicals);
      } catch (e) {
        console.error(e);
      }
    };
    getInventory();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <Header title="Chemical Inventory" onBack={() => setCurrentPage('company')} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chemicals.map((c, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { setSelectedChemical(c); setCurrentPage('inventory_detail'); }}
            className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 hover:shadow-xl transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                <FlaskConical className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{c.chemical_CAS} - {c.chemical_name}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Thermometer className="w-3 h-3" /> <span>{c.temperature || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-3 h-3" /> <span>Level {c.chemical_level || 'N/A'}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// --- Page 05: Chemical Reply (Assistant Detail View) ---
const ChemicalReplyPage = ({ selectedChemical, setCurrentPage }: any) => {
  if (!selectedChemical) return null;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Header title="Safety Information" onBack={() => setCurrentPage('chemical_question')} />
      
      <div className="bg-slate-900 p-8 rounded-[2rem] text-white mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Safety Profile</p>
          <h2 className="text-4xl font-bold mb-4">{selectedChemical.chemical_CAS} - {selectedChemical.chemical_name}</h2>
        </div>
        <FlaskConical className="absolute -right-10 -bottom-10 w-64 h-64 text-white/10 rotate-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DataItem icon={Thermometer} label="Temperature" value={selectedChemical.temperature} color="text-orange-500" />
        <DataItem icon={Droplets} label="Humidity" value={selectedChemical.humidity} color="text-blue-500" />
        <DataItem icon={Sun} label="Light exposure" value={selectedChemical.light_exposure} color="text-yellow-500" />
        <DataItem icon={Flame} label="Flammable" value={selectedChemical.flammable} color="text-red-500" />
        <DataItem icon={Bomb} label="Explosive" value={selectedChemical.explosive} color="text-purple-500" />
        <DataItem icon={Waves} label="Boiling point" value={selectedChemical.boiling_point} color="text-cyan-500" />
        <DataItem icon={Snowflake} label="Freezing point" value={selectedChemical.freezing_point} color="text-indigo-500" />
        <DataItem icon={Zap} label="Ignition point" value={selectedChemical.ignition_point} color="text-amber-500" />
        <DataItem icon={ShieldCheck} label="Cannot be stored with" value={selectedChemical.safe} color="text-emerald-500" />
      </div>
    </div>
  );
};

// --- Page 09: Chemical Inventory Detail (Management View) ---
const ChemicalInventoryDetailPage = ({ selectedChemical, setCurrentPage }: any) => {
  if (!selectedChemical) return null;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Header title="Chemical Management" onBack={() => setCurrentPage('chemical_inventory')} />
      
      <div className="bg-emerald-600 p-8 rounded-[2rem] text-white mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Inventory Record</p>
          <h2 className="text-4xl font-bold mb-4">{selectedChemical.chemical_CAS} - {selectedChemical.chemical_name}</h2>
          <div className="flex gap-4">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-md">Level: {selectedChemical.chemical_level || 'N/A'}</span>
          </div>
        </div>
        <FlaskConical className="absolute -right-10 -bottom-10 w-64 h-64 text-white/10 rotate-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DataItem icon={Thermometer} label="Temperature" value={selectedChemical.temperature} color="text-orange-500" />
        <DataItem icon={Droplets} label="Humidity" value={selectedChemical.humidity} color="text-blue-500" />
        <DataItem icon={Sun} label="Light exposure" value={selectedChemical.light_exposure} color="text-yellow-500" />
        <DataItem icon={Flame} label="Flammable" value={selectedChemical.flammable} color="text-red-500" />
        <DataItem icon={Bomb} label="Explosive" value={selectedChemical.explosive} color="text-purple-500" />
        <DataItem icon={Waves} label="Boiling point" value={selectedChemical.boiling_point} color="text-cyan-500" />
        <DataItem icon={Snowflake} label="Freezing point" value={selectedChemical.freezing_point} color="text-indigo-500" />
        <DataItem icon={Zap} label="Ignition point" value={selectedChemical.ignition_point} color="text-amber-500" />
        <DataItem icon={ShieldCheck} label="Cannot be stored with" value={selectedChemical.safe} color="text-emerald-500" />
        
        <DataItem icon={ClipboardList} label="Life Storage" value={selectedChemical.life_storage} />
        <DataItem icon={Database} label="Condition" value={selectedChemical.condition} />
        <DataItem icon={UserPlus} label="Stored For" value={selectedChemical.stored_for} />
        <DataItem icon={AlertCircle} label="Extra User" value={selectedChemical.extra_user} />
      </div>
    </div>
  );
};

// --- Page 01: Log In ---
const LoginPage = ({ setCurrentPage, setUser, showMessage, setLoading, loading }: any) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await window.fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setCurrentPage('chemical_question');
      } else {
        showMessage(data.message);
      }
    } catch (e) {
      showMessage('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
          <FlaskConical className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
        <p className="text-slate-500 text-sm">Sign in to manage chemicals safely</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Username</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            value={username || ''}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
          <input 
            type="password" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            value={password || ''}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          Enter
        </button>

        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentPage('signup')}
            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all"
          >
            Sign In
          </button>
          <button 
            onClick={() => setCurrentPage('company')}
            className="flex-1 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-semibold text-sm hover:bg-emerald-100 transition-all"
          >
            Company
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Page 02: Sign In (User) ---
const UserSignupPage = ({ setCurrentPage, showMessage, setLoading, loading }: any) => {
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const checkCompany = async () => {
    const res = await window.fetch('/api/user/check-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });
    const data = await res.json();
    if (data.success) setCompanyName(data.companyName);
    else showMessage(data.message);
  };

  const checkUser = async () => {
    const res = await window.fetch('/api/user/check-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.success) setFullName(data.userFullName);
    else showMessage(data.message);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await window.fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, companyId, username, password, email })
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Registration successful!');
        setCurrentPage('login');
      } else {
        showMessage(data.message);
      }
    } catch (e) {
      showMessage('Registration error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
      <Header title="User Registration" onBack={() => setCurrentPage('login')} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Company ID</label>
              <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200" value={companyId} onChange={e => setCompanyId(e.target.value)} />
            </div>
            <button onClick={checkCompany} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Search className="w-5 h-5" /></button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Company Name</label>
            <input type="text" readOnly className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500" value={companyName} />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">User ID</label>
              <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200" value={userId} onChange={e => setUserId(e.target.value)} />
            </div>
            <button onClick={checkUser} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Search className="w-5 h-5" /></button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Full Name</label>
            <input type="text" readOnly className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500" value={fullName} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Username</label>
            <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
            <input type="password" className="w-full px-4 py-2 rounded-xl border border-slate-200" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">E-mail</label>
            <input type="email" className="w-full px-4 py-2 rounded-xl border border-slate-200" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button 
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold mt-4 hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Page 03: Company Portal ---
const CompanyPage = ({ setCurrentPage, setCompany, showMessage, setLoading, loading, company }: any) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      showMessage('Please enter company credentials.');
      return;
    }

    setLoading(true);
    try {
      const res = await window.fetch('/api/company/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setCompany(data.company);
        showMessage('Login successful!');
      } else {
        showMessage(data.message);
      }
    } catch (e) {
      showMessage('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
      <Header title="Company Portal" onBack={() => setCurrentPage('login')} />
      
      {!company ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-900" />
            </div>
            <p className="text-slate-500 text-sm text-center">Enter company administrator credentials to access the portal</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">User Name (Admin)</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Company Admin Username"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
            <input 
              type="password" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
            />
          </div>
          
          <button 
            onClick={handleLogin} 
            disabled={loading} 
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Login to Portal
          </button>

          <button 
            onClick={() => setCurrentPage('company_signup')}
            className="w-full text-xs text-slate-400 hover:text-emerald-600 transition-colors mt-4 underline text-center"
          >
            New company? Click here if its your first time log in.
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 mb-6">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Authenticated As</p>
            <p className="font-bold text-slate-900">{company.company_name}</p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => setCurrentPage('add_chemical')} 
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-sm"
            >
              <PlusCircle className="w-5 h-5" /> Add Chemical
            </button>
            <button 
              onClick={() => setCurrentPage('add_user')} 
              className="w-full bg-white text-slate-700 border border-slate-200 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
            >
              <UserPlus className="w-5 h-5" /> Add User
            </button>
            <button 
              onClick={() => setCurrentPage('chemical_inventory')} 
              className="w-full bg-emerald-50 text-emerald-700 border border-emerald-100 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all shadow-sm"
            >
              <ClipboardList className="w-5 h-5" /> Chemical Management
            </button>
            
            <button 
              onClick={() => setCompany(null)} 
              className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors mt-6 font-medium"
            >
              Logout from Company Portal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Page 04: Company Sign In ---
const CompanySignupPage = ({ setCurrentPage, showMessage, setLoading, loading }: any) => {
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [devCode, setDevCode] = useState('');

  const checkCompany = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await window.fetch('/api/user/check-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId })
      });
      const data = await res.json();
      if (data.success) {
        setCompanyName(data.companyName);
      } else {
        showMessage(data.message);
      }
    } catch (e) {
      showMessage('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!companyId || !username || !password || !devCode) {
      showMessage('Please fill all fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await window.fetch('/api/company/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, username, password, devCode })
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Company registered successfully!');
        setCurrentPage('company');
      } else {
        showMessage(data.message);
      }
    } catch (e) {
      showMessage('Signup error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
      <Header title="Company Setup" onBack={() => setCurrentPage('company')} />
      <div className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Company ID</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" 
              value={companyId} 
              onChange={e => setCompanyId(e.target.value)} 
            />
          </div>
          <button 
            onClick={checkCompany} 
            disabled={loading}
            className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Company Name</label>
          <input 
            type="text" 
            readOnly 
            className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-500" 
            value={companyName} 
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">User Name (Admin)</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
          <input 
            type="password" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Developer Authorization Code</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" 
            value={devCode} 
            onChange={e => setDevCode(e.target.value)} 
          />
        </div>
        <button 
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
        </button>
      </div>
    </div>
  );
};

// --- Page 08: Add User (Admin) ---
const AddUserPage = ({ company, setCurrentPage, showMessage, setLoading, loading }: any) => {
  const [nextUserId, setNextUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [level, setLevel] = useState('1');

  useEffect(() => {
    const getNextId = async () => {
      try {
        const res = await window.fetch('/api/company/next-user-id');
        const data = await res.json();
        setNextUserId(data.userId);
      } catch (e) {
        console.error(e);
      }
    };
    getNextId();
  }, []);

  const handleAddUser = async () => {
    if (!nextUserId || nextUserId === 'N/A') {
      showMessage('Invalid User ID');
      return;
    }
    if (!fullName || !level) {
      showMessage('Please fill all fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await window.fetch('/api/company/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: nextUserId, 
          fullName, 
          level: parseInt(level),
          companyId: company?.company_ID
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showMessage(data.message || 'User added successfully');
        setFullName('');
        setLevel('1');
        
        // Refresh next ID separately so it doesn't block the success message
        try {
          const nextRes = await window.fetch('/api/company/next-user-id');
          if (nextRes.ok) {
            const nextData = await nextRes.json();
            setNextUserId(nextData.userId);
          }
        } catch (nextErr) {
          console.error('Error fetching next ID:', nextErr);
        }
      } else {
        showMessage(data.message || 'Failed to add user');
      }
    } catch (e: any) {
      console.error('Add user error:', e);
      showMessage(e.message || 'Error adding user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
      <Header title="Add New User" onBack={() => setCurrentPage('company')} />
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">User ID</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
            value={nextUserId || ''} 
            onChange={e => setNextUserId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">User Full Name</label>
          <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" value={fullName || ''} onChange={e => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Authorization Level (1-5)</label>
          <input 
            type="number" 
            min="1" 
            max="5" 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" 
            value={level || ''} 
            onChange={e => {
              const val = parseInt(e.target.value);
              if (val >= 1 && val <= 5) setLevel(e.target.value);
              else if (e.target.value === '') setLevel('');
            }} 
          />
        </div>
        <button 
          onClick={handleAddUser} 
          disabled={loading || !nextUserId || nextUserId === 'N/A'}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold mt-4 hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add User'}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);

  // --- Page 00: Loading ---
  useEffect(() => {
    if (currentPage === 'loading') {
      const timer = setTimeout(() => setCurrentPage('login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <AnimatePresence mode="wait">
        {currentPage === 'loading' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="mb-8"
            >
              <FlaskConical className="w-24 h-24 text-emerald-500" />
            </motion.div>
            <h1 className="text-4xl font-black text-white tracking-tighter mb-2">SafeFlow AI</h1>
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-full h-full bg-emerald-500"
              />
            </div>
            <p className="mt-4 text-slate-400 font-mono text-xs uppercase tracking-[0.3em]">Initializing Systems</p>
          </motion.div>
        )}

        <motion.main 
          key={`page-${currentPage}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="container mx-auto px-4 py-12"
        >
          {currentPage === 'login' && (
            <LoginPage 
              setCurrentPage={setCurrentPage} 
              setUser={setUser} 
              showMessage={showMessage} 
              setLoading={setLoading} 
              loading={loading} 
            />
          )}
          {currentPage === 'signup' && (
            <UserSignupPage 
              setCurrentPage={setCurrentPage} 
              showMessage={showMessage} 
              setLoading={setLoading} 
              loading={loading} 
            />
          )}
          {currentPage === 'company' && (
            <CompanyPage 
              setCurrentPage={setCurrentPage} 
              setCompany={setCompany} 
              showMessage={showMessage} 
              setLoading={setLoading} 
              loading={loading} 
              company={company}
            />
          )}
          {currentPage === 'company_signup' && (
            <CompanySignupPage 
              setCurrentPage={setCurrentPage} 
              showMessage={showMessage} 
              setLoading={setLoading} 
              loading={loading} 
            />
          )}
          {currentPage === 'add_user' && (
            <AddUserPage 
              company={company} 
              setCurrentPage={setCurrentPage} 
              showMessage={showMessage} 
              setLoading={setLoading} 
              loading={loading} 
            />
          )}
          {currentPage === 'add_chemical' && (
            <AddChemicalPage 
              company={company} 
              ai={ai} 
              setCurrentPage={setCurrentPage} 
              loading={loading} 
              setLoading={setLoading} 
              showMessage={showMessage} 
            />
          )}
          {currentPage === 'chemical_question' && (
            <ChemicalQuestionPage 
              user={user} 
              company={company} 
              ai={ai} 
              setCurrentPage={setCurrentPage} 
              loading={loading} 
              setLoading={setLoading} 
              showMessage={showMessage} 
              setSelectedChemical={setSelectedChemical} 
            />
          )}
          {currentPage === 'chemical_inventory' && (
            <ChemicalInventoryPage 
              setCurrentPage={setCurrentPage} 
              setSelectedChemical={setSelectedChemical} 
            />
          )}
          {currentPage === 'chemical_reply' && (
            <ChemicalReplyPage 
              selectedChemical={selectedChemical} 
              setCurrentPage={setCurrentPage} 
            />
          )}
          {currentPage === 'inventory_detail' && (
            <ChemicalInventoryDetailPage 
              selectedChemical={selectedChemical} 
              setCurrentPage={setCurrentPage} 
            />
          )}
        </motion.main>
      </AnimatePresence>

      {/* Global Message Toast */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10"
          >
            <AlertCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
