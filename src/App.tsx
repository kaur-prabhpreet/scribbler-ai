import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Link as LinkIcon, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileDown,
  Presentation,
  Trash2,
  Plus,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeNotes, generateDiagramImage } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Section {
  heading: string;
  content: string;
  isElaborated: boolean;
  diagrams?: string[];
  diagramImages?: string[];
}

interface ProcessedNotes {
  title: string;
  sections: Section[];
}

export default function App() {
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [docUrl, setDocUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedNotes | null>(null);
  const [outputType, setOutputType] = useState<'pdf' | 'ppt'>('pdf');
  const [error, setError] = useState<string | null>(null);
  const [googleTokens, setGoogleTokens] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setGoogleTokens(event.data.tokens);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGoogleConnect = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (err) {
      setError('Failed to connect to Google');
    }
  };

  const processNotes = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      let result: ProcessedNotes;

      if (files.length > 0) {
        const imageData = await Promise.all(
          files.map(async f => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(f.file);
            });
          })
        );
        result = await analyzeNotes(imageData.map(data => ({ type: 'image', data })));
      } else if (docUrl && googleTokens) {
        const docId = docUrl.match(/[-\w]{25,}/)?.[0];
        if (!docId) throw new Error('Invalid Google Doc URL');
        
        const res = await fetch('/api/google-doc/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId, tokens: googleTokens })
        });
        const { content } = await res.json();
        result = await analyzeNotes({ type: 'text', data: content });
      } else {
        throw new Error('Please provide notes via image or Google Doc');
      }

      // Generate images for diagrams
      const sectionsWithImages = await Promise.all(
        result.sections.map(async section => {
          if (section.diagrams && section.diagrams.length > 0) {
            const images = await Promise.all(
              section.diagrams.map(desc => generateDiagramImage(desc))
            );
            return { ...section, diagramImages: images.filter(img => img !== null) as string[] };
          }
          return section;
        })
      );

      setProcessedData({ ...result, sections: sectionsWithImages });
    } catch (err: any) {
      setError(err.message || 'Failed to process notes');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToPdf = () => {
    if (!processedData) return;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(22);
    doc.text(processedData.title, 20, y);
    y += 15;

    processedData.sections.forEach(section => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(16);
      doc.text(section.heading, 20, y);
      y += 10;

      doc.setFontSize(12);
      const lines = doc.splitTextToSize(section.content, 170);
      doc.text(lines, 20, y);
      y += (lines.length * 7) + 5;

      if (section.diagramImages) {
        section.diagramImages.forEach(img => {
          if (y > 200) {
            doc.addPage();
            y = 20;
          }
          doc.addImage(img, 'PNG', 20, y, 170, 95);
          y += 105;
        });
      }
    });

    doc.save(`${processedData.title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportToPpt = () => {
    if (!processedData) return;
    const ppt = new pptxgen();
    
    // Title Slide
    let slide = ppt.addSlide();
    slide.addText(processedData.title, { x: 1, y: 1.5, w: '80%', h: 1, fontSize: 44, bold: true, align: 'center' });

    // Content Slides
    processedData.sections.forEach(section => {
      slide = ppt.addSlide();
      slide.addText(section.heading, { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 28, bold: true, color: '363636' });
      
      slide.addText(section.content, { x: 0.5, y: 1.2, w: '90%', h: 3, fontSize: 14, color: '666666', bullet: true });

      if (section.diagramImages && section.diagramImages.length > 0) {
        // If there's a diagram, maybe put it on a new slide or next to text
        // For simplicity, new slide for diagrams
        section.diagramImages.forEach(img => {
          const diagSlide = ppt.addSlide();
          diagSlide.addText(`${section.heading} - Diagram`, { x: 0.5, y: 0.3, fontSize: 18 });
          diagSlide.addImage({ data: img, x: 0.5, y: 1, w: 9, h: 5 });
        });
      }
    });

    ppt.writeFile({ fileName: `${processedData.title.replace(/\s+/g, '_')}.pptx` });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <FileText className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Smart Scribbler</h1>
          </div>
          <div className="flex items-center gap-4">
            {!googleTokens ? (
              <button 
                onClick={handleGoogleConnect}
                className="text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 hover:bg-black/5 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Google Docs
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
                Google Connected
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Input Section */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-black/40">Step 1: Upload Notes</h2>
              
              <div className="space-y-4">
                {/* Image Upload */}
                <div 
                  className="border-2 border-dashed border-black/10 rounded-2xl p-8 text-center hover:border-black/20 transition-all cursor-pointer bg-white group"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input 
                    id="file-upload"
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-black/60" />
                  </div>
                  <p className="font-medium">Drop images or click to upload</p>
                  <p className="text-sm text-black/40 mt-1">Handwritten notes, sketches, or photos</p>
                </div>

                {/* Google Doc Link */}
                <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-black/60">
                    <LinkIcon className="w-4 h-4" />
                    Google Doc Link
                  </div>
                  <input 
                    type="text" 
                    placeholder="https://docs.google.com/document/d/..."
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                  />
                  {!googleTokens && docUrl && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Connect Google account first
                    </p>
                  )}
                </div>
              </div>

              {/* File List */}
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="grid grid-cols-3 gap-3"
                  >
                    {files.map((f, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-black/5">
                        <img src={f.preview} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-black/40">Step 2: Output Format</h2>
              <div className="flex gap-4">
                <button 
                  onClick={() => setOutputType('pdf')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all font-medium",
                    outputType === 'pdf' ? "border-black bg-black text-white" : "border-black/5 bg-white hover:border-black/20"
                  )}
                >
                  <FileDown className="w-5 h-5" />
                  PDF Document
                </button>
                <button 
                  onClick={() => setOutputType('ppt')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all font-medium",
                    outputType === 'ppt' ? "border-black bg-black text-white" : "border-black/5 bg-white hover:border-black/20"
                  )}
                >
                  <Presentation className="w-5 h-5" />
                  PowerPoint
                </button>
              </div>
            </section>

            <button 
              disabled={isProcessing || (files.length === 0 && !docUrl)}
              onClick={processNotes}
              className="w-full py-5 bg-black text-white rounded-2xl font-bold text-lg shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing with AI...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Generate Smart Notes
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-3 border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-black/5 shadow-2xl shadow-black/5 min-h-[600px] flex flex-col overflow-hidden">
              <div className="border-b border-black/5 px-8 py-6 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                <h2 className="font-bold text-lg">Preview Output</h2>
                {processedData && (
                  <button 
                    onClick={outputType === 'pdf' ? exportToPdf : exportToPpt}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download {outputType.toUpperCase()}
                  </button>
                )}
              </div>

              <div className="flex-1 p-8 overflow-y-auto max-h-[800px]">
                {!processedData && !isProcessing && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-black/20">
                    <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="font-bold text-xl text-black/40">No content yet</p>
                      <p className="text-sm">Upload notes to see the AI magic happen</p>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-black/5 border-t-black rounded-full animate-spin" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-bold text-lg">Analyzing your scribbles...</p>
                      <p className="text-sm text-black/40 max-w-[280px]">
                        Our AI is identifying emphasis, filling in headings, and recreating diagrams.
                      </p>
                    </div>
                  </div>
                )}

                {processedData && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-10"
                  >
                    <div className="space-y-2">
                      <h1 className="text-4xl font-black tracking-tight">{processedData.title}</h1>
                      <div className="h-1 w-20 bg-black rounded-full" />
                    </div>

                    <div className="space-y-12">
                      {processedData.sections.map((section, idx) => (
                        <div key={idx} className="space-y-4">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-black/80">{section.heading}</h3>
                            {section.isElaborated && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-amber-200">
                                Elaborated
                              </span>
                            )}
                          </div>
                          <div className="prose prose-sm max-w-none text-black/60 leading-relaxed">
                            <Markdown>{section.content}</Markdown>
                          </div>
                          {section.diagramImages && section.diagramImages.map((img, i) => (
                            <div key={i} className="mt-6 rounded-2xl overflow-hidden border border-black/5 shadow-lg">
                              <div className="bg-black/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-2">
                                <ImageIcon className="w-3 h-3" />
                                AI Generated Diagram
                              </div>
                              <img src={img} className="w-full h-auto" />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-black/5 text-center text-black/40 text-sm">
        <p>© 2026 Smart Scribbler • Powered by Gemini AI</p>
        <div className="mt-8 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase">Upload</span>
          </div>
          <div className="w-8 h-[1px] bg-black/5" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center">
              <Loader2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase">Analyze</span>
          </div>
          <div className="w-8 h-[1px] bg-black/5" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase">Export</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
