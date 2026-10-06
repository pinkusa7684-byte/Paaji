import React, { useState } from 'react';
import { AssistantSettings, VoiceName, PersonalityMode, LanguagePreference, StoredMemory, ContactItem } from '../types/assistant';
import { AVAILABLE_VOICES } from '../config/constants';
import { memoryService } from '../services/memoryService';
import { contactsService } from '../services/contactsService';
import { runSpeakerDiagnostic, setMasterVolume } from '../audio/audioContext';
import {
  X,
  Volume2,
  Sparkles,
  Globe,
  Brain,
  Users,
  Trash2,
  Plus,
  Phone,
  Shield,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AssistantSettings;
  onUpdateSettings: (newSettings: AssistantSettings) => void;
  onClearConversation: () => void;
}

type TabType = 'voice' | 'personality' | 'language' | 'memory' | 'contacts' | 'privacy';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearConversation,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('voice');
  const [memories, setMemories] = useState<StoredMemory[]>(memoryService.getMemories());
  const [contacts, setContacts] = useState<ContactItem[]>(contactsService.getContacts());
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('');
  const [testToneMessage, setTestToneMessage] = useState('');

  if (!isOpen) return null;

  const handleVoiceChange = (voice: VoiceName) => {
    onUpdateSettings({ ...settings, voiceName: voice });
  };

  const handleVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    onUpdateSettings({ ...settings, voiceVolume: vol });
  };

  const handlePersonalityChange = (personality: PersonalityMode) => {
    onUpdateSettings({ ...settings, personality });
  };

  const handleLanguageChange = (language: LanguagePreference) => {
    onUpdateSettings({ ...settings, language });
  };

  const handleToggleMemory = (enable: boolean) => {
    onUpdateSettings({ ...settings, enableMemory: enable });
  };

  const handleDeleteMemory = (id: string) => {
    memoryService.deleteMemory(id);
    setMemories(memoryService.getMemories());
  };

  const handleClearAllMemories = () => {
    if (window.confirm('Are you sure you want to delete all stored memories?')) {
      memoryService.clearAll();
      setMemories([]);
    }
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    contactsService.addContact({
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRel.trim() || undefined,
    });
    setContacts(contactsService.getContacts());
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRel('');
  };

  const handleDeleteContact = (id: string) => {
    contactsService.deleteContact(id);
    setContacts(contactsService.getContacts());
  };

  const handleSpeakerTest = async () => {
    setTestToneMessage('Testing...');
    const result = await runSpeakerDiagnostic();
    if (result.success) {
      setTestToneMessage('Tone played successfully!');
    } else {
      setTestToneMessage(`Failed: ${result.error || 'Audio error'}`);
    }
    setTimeout(() => setTestToneMessage(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Paaji Settings</h3>
              <p className="text-xs text-white/50">Personalize your assistant companion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex overflow-x-auto border-b border-white/10 px-4 bg-black/20 scrollbar-none">
          {[
            { id: 'voice', label: 'Voice', icon: Volume2 },
            { id: 'personality', label: 'Personality', icon: Sparkles },
            { id: 'language', label: 'Language', icon: Globe },
            { id: 'memory', label: 'Memory', icon: Brain },
            { id: 'contacts', label: 'Contacts', icon: Users },
            { id: 'privacy', label: 'Privacy', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                  active
                    ? 'border-amber-400 text-amber-300 bg-white/5'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* VOICE TAB */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider block mb-3">
                  AI Model Voice Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVAILABLE_VOICES.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => handleVoiceChange(v.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        settings.voiceName === v.id
                          ? 'border-amber-400 bg-amber-500/15 text-white shadow-lg'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">{v.name}</span>
                        {settings.voiceName === v.id && (
                          <Check className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-xs text-white/60">{v.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Volume
                  </label>
                  <span className="text-xs text-white/60 font-mono">
                    {Math.round(settings.voiceVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.voiceVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Audio Pipeline Check</h4>
                  <p className="text-xs text-white/50">Run speaker diagnostic test</p>
                </div>
                <button
                  onClick={handleSpeakerTest}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{testToneMessage || 'Test Speaker'}</span>
                </button>
              </div>
            </div>
          )}

          {/* PERSONALITY TAB */}
          {activeTab === 'personality' && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider block">
                Paaji's Personality Style
              </label>
              {[
                {
                  id: 'friendly',
                  title: 'Friendly & Witty (Recommended)',
                  desc: 'Warm, smart, emotionally aware, confident, and witty like a real best companion.',
                },
                {
                  id: 'playful',
                  title: 'Playful & Funny',
                  desc: 'Extra teasing, sarcastic when appropriate, humorous, and energetic.',
                },
                {
                  id: 'casual',
                  title: 'Casual & Brotherly',
                  desc: 'Pure elder brother / Paaji vibe, very relaxed, grounded, and conversational.',
                },
                {
                  id: 'professional',
                  title: 'Professional & Focused',
                  desc: 'Crisp, polite, direct, and zero fluff.',
                },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => handlePersonalityChange(p.id as PersonalityMode)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    settings.personality === p.id
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{p.title}</span>
                    {settings.personality === p.id && <Check className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-xs text-white/60 mt-1">{p.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* LANGUAGE TAB */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider block mb-2">
                  Language Intelligence
                </label>
                <p className="text-xs text-white/60 mb-4">
                  Paaji naturally understands and adapts to any spoken language without switching modes.
                </p>
              </div>

              {[
                { id: 'auto', title: 'Auto Detect (Recommended)', desc: 'Automatically matches whatever language you speak (English, Hindi, Punjabi, Hinglish, Marathi, etc.)' },
                { id: 'hinglish', title: 'Hinglish & Casual Hindi', desc: 'Prioritizes friendly Indian bilingual phrasing ("Haan paaji, bolo!")' },
                { id: 'hi', title: 'Hindi (हिंदी)', desc: 'Responds primarily in clear, natural Hindi' },
                { id: 'pa', title: 'Punjabi (ਪੰਜਾਬੀ)', desc: 'Responds warmly in Punjabi ("Satsriakal paaji!")' },
                { id: 'en', title: 'English', desc: 'Responds in clean, expressive conversational English' },
              ].map((lang) => (
                <div
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang.id as LanguagePreference)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    settings.language === lang.id
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{lang.title}</span>
                    {settings.language === lang.id && <Check className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-xs text-white/60 mt-1">{lang.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* MEMORY TAB */}
          {activeTab === 'memory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <h4 className="text-sm font-semibold text-white">Enable Long-Term Memory</h4>
                  <p className="text-xs text-white/60">Allow Paaji to remember safe preferences and user facts</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableMemory}
                  onChange={(e) => handleToggleMemory(e.target.checked)}
                  className="w-5 h-5 accent-amber-400 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Stored Memories ({memories.length})
                  </label>
                  {memories.length > 0 && (
                    <button
                      onClick={handleClearAllMemories}
                      className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>

                {memories.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40 bg-white/5 rounded-2xl border border-white/5">
                    No memories saved yet. Speak to Paaji, e.g. "My friend is Rahul", "Remember my favorite color is blue".
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {memories.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-amber-300">{m.key}: </span>
                          <span className="text-white/90">{m.value}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteMemory(m.id)}
                          className="text-white/40 hover:text-rose-400 p-1 rounded transition-colors"
                          title="Delete memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONTACTS TAB */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">Safe Address Book</h4>
                <p className="text-xs text-white/60 mb-4">
                  Contacts that Paaji can dial when you say "Paaji, call Mom" or "Mom ko phone karo".
                </p>

                <form onSubmit={handleAddContact} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 mb-4">
                  <span className="text-xs font-semibold text-white/80 block">Add New Quick Contact</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Name (e.g. Mom, Rahul)"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone (+91...)"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Relationship (Optional)"
                      value={newContactRel}
                      onChange={(e) => setNewContactRel(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Contact</span>
                  </button>
                </form>

                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: c.avatarColor || '#f59e0b' }}
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                        >
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {c.name} {c.relationship && <span className="text-white/40 font-normal">({c.relationship})</span>}
                          </div>
                          <div className="text-white/60 font-mono text-[11px]">{c.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => contactsService.initiateCall(c.phone)}
                          className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                          title="Call contact"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY TAB */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-sm font-semibold text-white">Clear Conversation</h4>
                <p className="text-xs text-white/60">
                  Wipe current transcript and conversation turns from the screen.
                </p>
                <button
                  onClick={() => {
                    onClearConversation();
                    alert('Conversation transcript cleared.');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Clear Current Conversation
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-3">
                <h4 className="text-sm font-semibold text-rose-300">Wipe All Stored Data</h4>
                <p className="text-xs text-rose-200/70">
                  Delete all local notes, reminders, memories, and contacts from your browser.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to completely reset all Paaji local data?')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Reset All Assistant Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
