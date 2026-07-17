import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useProjectStore, ProjectFile, Chat } from '../../store/projectStore';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  FileCode,
  FolderOpen,
  MessageSquare,
  Send,
  Upload,
  Play,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Terminal,
  FileText,
  Copy,
  Check,
  Code2,
  AlertTriangle,
  Activity,
  Heart,
  Maximize2,
  Eye,
  Settings as SettingsIcon,
  Shield,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkspaceProps {
  onBackToDashboard: () => void;
  projectId: string;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onBackToDashboard, projectId }) => {
  const {
    activeProject,
    files,
    setFiles,
    activeFile,
    setActiveFile,
    chats,
    setChats,
    activeChat,
    setActiveChat,
    updateFileContent,
  } = useProjectStore();

  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [activeTab, setActiveTab] = useState<'files' | 'chat' | 'analyzer'>('files');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Analysis / Git reports
  const [reports, setReports] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<any | null>(null);

  // Code runner states
  const [showConsole, setShowConsole] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<{ stdout: string; stderr: string; exitCode: number } | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const runCode = async () => {
    if (!activeFile) return;
    setShowConsole(true);
    setConsoleOutput(null);
    setRunLoading(true);
    try {
      const res = await api.post('/analysis/run', {
        code: activeFile.content,
        language: activeFile.name.split('.').pop(),
      });
      setConsoleOutput(res.data.data);
    } catch (err: any) {
      setConsoleOutput({
        stdout: '',
        stderr: err.response?.data?.error?.message || 'Failed to execute code.',
        exitCode: 1,
      });
    } finally {
      setRunLoading(false);
    }
  };

  // Load project details, files, chats, and analyses
  useEffect(() => {
    const loadWorkspaceData = async () => {
      try {
        const [filesRes, chatsRes, reportsRes] = await Promise.all([
          api.get(`/files/projects/${projectId}/files`),
          api.get(`/chat/projects/${projectId}/chats`),
          api.get(`/github/projects/${projectId}/analyses`),
        ]);

        setFiles(filesRes.data.data.files);
        setChats(chatsRes.data.data.chats);
        setReports(reportsRes.data.data.analyses);

        // Auto-select first chat or create one if none
        if (chatsRes.data.data.chats.length > 0) {
          setActiveChat(chatsRes.data.data.chats[0]);
        } else {
          const createChatRes = await api.post(`/chat/projects/${projectId}/chats`, {
            title: 'Welcome Chat',
          });
          const newChat = createChatRes.data.data.chat;
          setChats([newChat]);
          setActiveChat(newChat);
        }

        if (reportsRes.data.data.analyses.length > 0) {
          setActiveReport(reportsRes.data.data.analyses[0]);
        }
      } catch (err) {
        console.error('Workspace data load failed', err);
      }
    };
    loadWorkspaceData();
  }, [projectId, setFiles, setChats, setActiveChat]);

  // Load chat messages when active chat changes
  useEffect(() => {
    if (!activeChat) return;
    const loadMessages = async () => {
      try {
        const res = await api.get(`/chat/chats/${activeChat.id}/messages`);
        setChatMessages(res.data.data.messages);
      } catch (err) {
        console.error('Messages load failed', err);
      }
    };
    loadMessages();
  }, [activeChat]);

  // Handle code change in Editor
  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile.id, value);
    }
  };

  // Save changes to database
  const saveFileChanges = async () => {
    if (!activeFile) return;
    try {
      await api.delete(`/files/files/${activeFile.id}`); // simple replacement or we just upload updated content
      // Create again or update
      await api.post(`/files/projects/${projectId}/files/upload`, {
        files: [
          new File([activeFile.content], activeFile.name, { type: activeFile.mimeType }),
        ],
        paths: [activeFile.path],
      });
    } catch (e) {
      console.error('Failed to save file changes', e);
    }
  };

  // Upload trigger helpers
  const triggerFileUpload = () => fileInputRef.current?.click();
  const triggerFolderUpload = () => folderInputRef.current?.click();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    const paths: string[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      formData.append('files', uploadedFiles[i]);
      // Detect folder layout if relativePath metadata exists
      const relativePath = (uploadedFiles[i] as any).webkitRelativePath || uploadedFiles[i].name;
      paths.push(relativePath);
    }

    // Pass paths as array strings
    paths.forEach((p, idx) => {
      formData.append(`paths[${idx}]`, p);
    });

    try {
      const res = await api.post(`/files/projects/${projectId}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Refresh files list
      const filesRes = await api.get(`/files/projects/${projectId}/files`);
      setFiles(filesRes.data.data.files);
    } catch (err) {
      console.error('File upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  // Send message with streaming tokens
  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || userInput;
    if (!content.trim() || !activeChat) return;

    setUserInput('');
    setChatLoading(true);

    // Save temporary user message locally
    const userMsg = { id: `temp-${Date.now()}`, sender: 'USER', content, createdAt: new Date().toISOString() };
    setChatMessages((prev) => [...prev, userMsg]);

    const token = localStorage.getItem('token');
    let aiMsgId = `temp-ai-${Date.now()}`;

    // Add placeholder AI message
    setChatMessages((prev) => [
      ...prev,
      { id: aiMsgId, sender: 'AI', content: '', createdAt: new Date().toISOString() },
    ]);

    try {
      // Use standard fetch for SSE stream reader
      const response = await fetch(`/api/chat/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.body) throw new Error('Readable stream not supported');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let accumulatedText = '';
      let streamError: string | null = null;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.replace('data: ', ''));
                if (parsed.token) {
                  accumulatedText += parsed.token;
                  setChatMessages((prev) =>
                    prev.map((msg) => (msg.id === aiMsgId ? { ...msg, content: accumulatedText } : msg))
                  );
                }
                if (parsed.error) {
                  streamError = parsed.error;
                  done = true;
                }
                if (parsed.done) {
                  done = true;
                }
              } catch (e) {
                // partial parsing errors
              }
            }
          }
        }
      }

      // Surface any error the backend sent through the stream
      if (streamError) {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, content: `⚠️ ${streamError}` } : msg
          )
        );
      }
    } catch (err: any) {
      console.error('Send message failed', err);
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, content: `Error: ${err.message || 'Failed to stream response.'}` } : msg
        )
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!activeChat) return;
    if (!window.confirm('Clear all messages in this chat?')) return;
    try {
      await api.delete(`/chat/chats/${activeChat.id}/messages`);
      setChatMessages([]);
    } catch (err) {
      console.error('Failed to clear chat', err);
    }
  };

  // Code Helper Quick Triggers (Explain, Optimize, Write Tests)
  const triggerCodeHelper = async (action: 'explain' | 'optimize' | 'debug' | 'tests' | 'doc') => {
    if (!activeFile) return;

    setActiveTab('chat');
    const promptText = `Please perform a code action: [${action.toUpperCase()}] on the file ${activeFile.name}.`;
    setUserInput('');
    setChatLoading(true);

    const userMsg = { id: `temp-${Date.now()}`, sender: 'USER', content: promptText, createdAt: new Date().toISOString() };
    setChatMessages((prev) => [...prev, userMsg]);

    const token = localStorage.getItem('token');
    let aiMsgId = `temp-ai-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      { id: aiMsgId, sender: 'AI', content: '', createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await fetch('/api/analysis/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          code: activeFile.content,
          language: activeFile.name.split('.').pop(),
        }),
      });

      if (!response.body) throw new Error('Readable stream not supported');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let accumulatedText = '';
      let streamError: string | null = null;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.replace('data: ', ''));
                if (parsed.token) {
                  accumulatedText += parsed.token;
                  setChatMessages((prev) =>
                    prev.map((msg) => (msg.id === aiMsgId ? { ...msg, content: accumulatedText } : msg))
                  );
                }
                if (parsed.error) {
                  streamError = parsed.error;
                  done = true;
                }
                if (parsed.done) {
                  done = true;
                }
              } catch (e) {
                // ignore parsing
              }
            }
          }
        }
      }

      // Surface any error the backend sent through the stream
      if (streamError) {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, content: `⚠️ ${streamError}` } : msg
          )
        );
      }
    } catch (err: any) {
      console.error('Code action trigger failed', err);
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, content: `Error: ${err.message || 'Failed to analyze code.'}` } : msg
        )
      );
    } finally {
      setChatLoading(false);
    }
  };

  // Helper component to copy code blocks to clipboard
  const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <button onClick={copy} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </button>
    );
  };

  // Render markdown with formatting (custom implementation to show code highlighting + copy button)
  const renderMessageContent = (text: string) => {
    // Regex matches markdown code blocks ```lang code ```
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const index = match.index;
      // Plain text before the code block
      if (index > lastIndex) {
        parts.push(<p key={lastIndex} className="whitespace-pre-wrap text-sm leading-relaxed mb-4">{text.slice(lastIndex, index)}</p>);
      }

      const lang = match[1] || 'Code';
      const code = match[2];

      parts.push(
        <div key={index} className="my-4 rounded-xl border border-border bg-muted/30 overflow-hidden">
          <div className="flex justify-between items-center bg-muted px-4 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
            <span className="uppercase tracking-wider">{lang}</span>
            <CopyButton text={code} />
          </div>
          <pre className="p-4 text-sm font-mono overflow-x-auto max-w-full text-foreground bg-[#1e1e2e]/50">
            <code>{code}</code>
          </pre>
        </div>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<p key={lastIndex} className="whitespace-pre-wrap text-sm leading-relaxed">{text.slice(lastIndex)}</p>);
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top Controls Workspace Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToDashboard}
            className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold leading-none text-foreground">{activeProject?.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Workspace Editor</p>
          </div>
        </div>

        {/* Shortcuts AI actions bar */}
        {activeFile && (
          <div className="hidden lg:flex items-center space-x-2.5">
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => triggerCodeHelper('explain')}>
              <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Explain
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => triggerCodeHelper('optimize')}>
              <Code2 className="mr-1.5 h-3.5 w-3.5" /> Optimize
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => triggerCodeHelper('debug')}>
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Find Bugs
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => triggerCodeHelper('tests')}>
              <Terminal className="mr-1.5 h-3.5 w-3.5" /> Create Tests
            </Button>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <select
            value={editorTheme}
            onChange={(e) => setEditorTheme(e.target.value)}
            className="h-8 rounded border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="vs-dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </select>
          <Button
            size="sm"
            variant="primary"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 border-none mr-2"
            onClick={runCode}
            disabled={!activeFile}
            isLoading={runLoading}
          >
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Run Code
          </Button>

          <Button size="sm" variant="primary" className="h-8 text-xs" onClick={saveFileChanges} disabled={!activeFile}>
            Save File
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side Utility Panel Toggles */}
        <div className="flex w-12 flex-col items-center border-r border-border bg-card py-4 space-y-4">
          {[
            { id: 'files', icon: FolderOpen, label: 'Files' },
            { id: 'chat', icon: MessageSquare, label: 'AI Assistant' },
            { id: 'analyzer', icon: Shield, label: 'Code Auditor' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary shadow shadow-primary/15'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title={tab.label}
            >
              <tab.icon className="h-5 w-5" />
            </button>
          ))}
        </div>

        {/* Dynamic Panel Content (Folder tree, Chat panel, Audit report) */}
        <AnimatePresence mode="wait">
          {activeTab === 'files' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex w-72 flex-col border-r border-border bg-card overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-border p-4 bg-muted/20">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  File Explorer
                </span>

                <div className="flex items-center space-x-1.5">
                  <button onClick={triggerFileUpload} title="Upload Files" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                    <Upload className="h-4 w-4" />
                  </button>
                  <button onClick={triggerFolderUpload} title="Upload Folder" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                    <FolderOpen className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
              <input
                type="file"
                ref={folderInputRef}
                onChange={handleFileUpload}
                {...({ webkitdirectory: '', directory: '' } as any)}
                className="hidden"
              />

              {uploading && (
                <div className="flex items-center p-4 text-xs text-primary bg-primary/5 space-x-2">
                  <span className="h-3 w-3 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                  <span>Processing uploads and indexing...</span>
                </div>
              )}

              {/* Files Tree listing */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {files.length === 0 ? (
                  <div className="text-center py-10">
                    <FileCode className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-xs text-muted-foreground">No files in project.</p>
                  </div>
                ) : (
                  files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setActiveFile(file)}
                      className={`flex w-full items-center space-x-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all ${
                        activeFile?.id === file.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <FileCode className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate text-xs">{file.path}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex w-96 flex-col border-r border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border p-4 bg-muted/20">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  AI Assistant
                </span>
                <div className="flex items-center gap-2">
                  {chatMessages.length > 0 && (
                    <button
                      onClick={handleClearChat}
                      title="Clear chat"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="flex items-center text-xs text-emerald-500 font-semibold">
                    <Activity className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> Live Stream
                  </span>
                </div>
              </div>

              {/* Chat conversations window */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <Sparkles className="mx-auto h-8 w-8 text-primary/40 animate-bounce" />
                    <p className="text-xs text-muted-foreground">Ask anything about your codebase, upload documents, or get code reviews.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col space-y-1.5 ${
                        msg.sender === 'USER' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {msg.sender === 'USER' ? 'You' : 'CodeCoach AI'}
                      </span>
                      <div
                        className={`rounded-xl p-3.5 text-sm max-w-[90%] shadow-sm ${
                          msg.sender === 'USER'
                            ? 'bg-primary text-primary-foreground shadow-primary/10'
                            : 'bg-muted/50 text-foreground border border-border'
                        }`}
                      >
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input section */}
              <div className="border-t border-border p-4 bg-muted/10">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Ask a question..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 h-10 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="icon" onClick={() => handleSendMessage()} isLoading={chatLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analyzer' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex w-96 flex-col border-r border-border bg-card overflow-hidden"
            >
              <div className="border-b border-border p-4 bg-muted/20">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Audit Report
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {!activeReport ? (
                  <div className="text-center py-20">
                    <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-4 text-xs text-muted-foreground">
                      No analyses run yet. Clone a repository to trigger your audit.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Score summary panel */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Code Quality</p>
                        <h4 className="mt-1 text-2xl font-extrabold text-primary">{activeReport.scoreCodeQuality}%</h4>
                      </div>
                      <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Security Score</p>
                        <h4 className="mt-1 text-2xl font-extrabold text-emerald-500">{activeReport.scoreSecurity}%</h4>
                      </div>
                    </div>

                    {/* Security threats issues */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Security Issues</h4>
                      {activeReport.reportSecurity?.issues?.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No security issues identified.</p>
                      ) : (
                        activeReport.reportSecurity?.issues?.map((issue: any, index: number) => (
                          <div key={index} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 space-y-1">
                            <span className="inline-block text-[9px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded uppercase">
                              {issue.severity}
                            </span>
                            <h5 className="text-xs font-bold text-foreground">{issue.file}</h5>
                            <p className="text-xs text-muted-foreground leading-normal">{issue.description}</p>
                            <p className="text-xs text-primary font-medium mt-2">Remediation: {issue.remediation}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Key recommendations */}
                    <div className="space-y-2 border-t border-border pt-4">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Suggestions</h4>
                      <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
                        {activeReport.suggestions?.map((sug: string, idx: number) => (
                          <li key={idx} className="leading-normal">{sug}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Monaco Editor Window */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#1e1e1e]">
          {activeFile ? (
            <>
              {/* Active Tab filename header */}
              <div className="flex h-10 items-center justify-between border-b border-border bg-muted/10 px-4">
                <div className="flex items-center space-x-2 text-xs font-medium text-foreground">
                  <FileCode className="h-4 w-4 text-primary" />
                  <span>{activeFile.path}</span>
                </div>
              </div>

              {/* Monaco instance */}
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language={activeFile.name.split('.').pop() || 'typescript'}
                  theme={editorTheme}
                  value={activeFile.content}
                  onChange={handleEditorChange}
                  options={{
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono',
                    minimap: { enabled: true },
                    automaticLayout: true,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                  }}
                />
              </div>

              {/* Console Output Panel */}
              {showConsole && (
                <div className="h-48 border-t border-border bg-[#111] text-[#eee] flex flex-col font-mono overflow-hidden">
                  <div className="flex justify-between items-center bg-[#1a1a1a] px-4 py-1.5 border-b border-border text-xs text-muted-foreground select-none">
                    <span className="font-bold flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-emerald-500" /> Console Output
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setConsoleOutput(null)} className="hover:text-foreground">
                        Clear
                      </button>
                      <button onClick={() => setShowConsole(false)} className="hover:text-foreground">
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto text-xs space-y-1">
                    {consoleOutput ? (
                      <>
                        {consoleOutput.stdout && (
                          <pre className="text-emerald-400 whitespace-pre-wrap">{consoleOutput.stdout}</pre>
                        )}
                        {consoleOutput.stderr && (
                          <pre className="text-red-400 whitespace-pre-wrap">{consoleOutput.stderr}</pre>
                        )}
                        <div className="text-[10px] text-muted-foreground border-t border-muted/20 pt-1 mt-2">
                          Process exited with code {consoleOutput.exitCode}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Click "Run Code" to compile and execute program...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center space-y-4">
              <Code2 className="h-16 w-16 text-muted-foreground/30 animate-pulse" />
              <div className="text-center">
                <h3 className="text-sm font-semibold text-foreground">No file open</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a file from the explorer sidebar to begin editing code.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};