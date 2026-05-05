import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Play, CheckCircle, ArrowRight, FileVideo,
  Loader2, Activity, Video, Camera, StopCircle, User
} from 'lucide-react';
import { Page } from '../App';
import {
  analyzeUploadedVideo,
  analyzeLiveVideo,
  saveDiagnosticSession,
} from '../utils/api';
import type { DiagnosticSession } from '../types/session';

interface DiagnosticProps {
  onNavigate: (page: Page) => void;
}

type Step = 'patient-id' | 'method-selection' | 'setup' | 'live-camera' | 'analysis' | 'complete';
type DiagnosticMethod = 'upload' | 'live-camera' | null;

type BackendData = {
  frequency: number;
  amplitude: number;
  confidence: number;
  label?: string;                    // ← top-level dominant label
  spectrogramData: { frequency: number; amplitude: number }[];
  leftHand?: { frequency: number; amplitude: number; label: string };
  rightHand?: { frequency: number; amplitude: number; label: string };
  asymmetry?: {
    value: number;
    percent: number;
    dominant: string;
  };
};

type VideoMeta = {
  fps: number;
  duration: number;
  resolution: string;
  quality: string;
};

// Pick the label from whichever hand has higher amplitude
function dominantLabel(data: BackendData): string {
  if (data.label) return data.label;
  const l = data.leftHand;
  const r = data.rightHand;
  if (!l && !r) return 'No tremor detected';
  if (!l) return r!.label;
  if (!r) return l.label;
  return l.amplitude >= r.amplitude ? l.label : r.label;
}

const Diagnostic = ({ onNavigate }: DiagnosticProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('patient-id');
  const [patientId, setPatientId] = useState('');
  const [diagnosticMethod, setDiagnosticMethod] = useState<DiagnosticMethod>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedName, setSavedName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const [backendData, setBackendData] = useState<BackendData>({
    frequency: 0,
    amplitude: 0,
    confidence: 0,
    spectrogramData: [],
  });

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadedFile(file);
    setVideoMeta(null);
    if (file) {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        const dur = isFinite(vid.duration) ? vid.duration : 0;
        setVideoMeta({
          fps: 30,
          duration: Math.round(dur),
          resolution: `${vid.videoWidth}x${vid.videoHeight}`,
          quality:
            vid.videoWidth >= 1920 ? 'Excellent' :
            vid.videoWidth >= 1280 ? 'Good' : 'Standard',
        });
        URL.revokeObjectURL(url);
      };
      vid.src = url;
    }
  };

  // ── Analysis (upload) ────────────────────────────────────────────────────
  const startAnalysis = async () => {
    if (!uploadedFile || !patientId.trim()) {
      alert('Please select a video file and enter a Patient ID.');
      return;
    }
    setCurrentStep('analysis');
    setProgress(0);
    setSavedName(null);

    const timer = window.setInterval(() => {
      setProgress(prev => Math.min(prev + 3, 88));
    }, 300);

    try {
      const data = await analyzeUploadedVideo(uploadedFile, patientId);
      window.clearInterval(timer);
      setProgress(100);
      if (data.savedName) setSavedName(data.savedName as string);
      setBackendData({
        frequency: data.frequency,
        amplitude: data.amplitude,
        confidence: data.confidence,
        label: data.label,
        spectrogramData: data.spectrogramData,
        leftHand: data.leftHand,
        rightHand: data.rightHand,
        asymmetry: data.asymmetry,
      });
      setTimeout(() => setCurrentStep('complete'), 800);
    } catch (error) {
      window.clearInterval(timer);
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please try again.');
      setCurrentStep('setup');
    }
  };

  // ── Save session ─────────────────────────────────────────────────────────
  const saveSession = async () => {
    const session: DiagnosticSession = {
      id: crypto.randomUUID(),
      patientId,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      frequency: backendData.frequency,
      amplitude: backendData.amplitude,
      confidence: backendData.confidence,
      label: dominantLabel(backendData),
      status: backendData.confidence < 90 ? 'alert' : 'normal',
      method: diagnosticMethod || 'upload',
      duration: diagnosticMethod === 'live-camera'
        ? recordingDuration
        : (videoMeta?.duration ?? 45),
      spectrogramData: backendData.spectrogramData ?? [],
      leftHand: backendData.leftHand,
      rightHand: backendData.rightHand,
      asymmetry: backendData.asymmetry,
    };
    try {
      await saveDiagnosticSession(session);
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  };

  // ── Camera helpers ───────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert('Unable to access camera. Please check permissions.');
      setCurrentStep('method-selection');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      setCurrentStep('analysis');
      setProgress(0);
      setSavedName(null);
      const timer = window.setInterval(() => {
        setProgress(prev => Math.min(prev + 3, 88));
      }, 300);
      try {
        const data = await analyzeLiveVideo(blob, patientId, recordingDuration || 30);
        window.clearInterval(timer);
        setProgress(100);
        if (data.savedName) setSavedName(data.savedName as string);
        setBackendData({
          frequency: data.frequency,
          amplitude: data.amplitude,
          confidence: data.confidence,
          label: data.label,
          spectrogramData: data.spectrogramData,
          leftHand: data.leftHand,
          rightHand: data.rightHand,
          asymmetry: data.asymmetry,
        });
        setTimeout(() => setCurrentStep('complete'), 800);
      } catch {
        window.clearInterval(timer);
        alert('Live analysis failed. Please try again.');
        setCurrentStep('live-camera');
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setRecordingDuration(0);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= 30) {
          window.clearInterval(recordingTimerRef.current!);
          stopRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    stopCamera();
  };

  const selectMethod = (method: DiagnosticMethod) => {
    setDiagnosticMethod(method);
    if (method === 'upload') setCurrentStep('setup');
    else { setCurrentStep('live-camera'); setTimeout(startCamera, 100); }
  };

  const resetWorkflow = () => {
    setCurrentStep('patient-id');
    setPatientId('');
    setDiagnosticMethod(null);
    setUploadedFile(null);
    setVideoMeta(null);
    setProgress(0);
    setIsRecording(false);
    setRecordingDuration(0);
    setSavedName(null);
    setBackendData({ frequency: 0, amplitude: 0, confidence: 0, spectrogramData: [] });
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    stopCamera();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#004F7E] mb-2">Diagnostic Pipeline</h1>
        <p className="text-gray-600 text-lg">Multi-step tremor analysis workflow</p>
      </div>

      {/* Step indicator */}
      {currentStep !== 'method-selection' && currentStep !== 'patient-id' && (
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { id: 'setup', label: diagnosticMethod === 'live-camera' ? 'Camera' : 'Setup' },
              { id: 'analysis', label: 'Analysis' },
              { id: 'complete', label: 'Complete' },
            ].map((step, index, array) => {
              const stepId = step.id === 'setup' && diagnosticMethod === 'live-camera'
                ? 'live-camera' : step.id;
              const isActive = currentStep === stepId;
              const isCompleted =
                (currentStep === 'analysis' && index === 0) ||
                (currentStep === 'complete' && index < 2);
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all
                      ${isActive ? 'bg-[#004F7E] text-white scale-110'
                        : isCompleted ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'}`}>
                      {isCompleted ? <CheckCircle className="w-6 h-6" /> : index + 1}
                    </div>
                    <span className={`mt-2 text-sm font-semibold
                      ${isActive ? 'text-[#004F7E]' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < array.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 transition-all
                      ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── PATIENT ID ── */}
        {currentStep === 'patient-id' && (
          <motion.div key="patient-id"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className="max-w-2xl mx-auto">
            <div className="glass-card p-12">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-[#004F7E] to-[#005A92] rounded-full flex items-center justify-center mx-auto mb-6">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Patient Information</h2>
                <p className="text-lg text-gray-600">Enter patient ID to begin diagnostic session</p>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Patient ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientId}
                    onChange={e => setPatientId(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && patientId.trim())
                        setCurrentStep('method-selection');
                    }}
                    placeholder="Enter patient ID (e.g., PT-1234)"
                    className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-[#004F7E] focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Note:</strong> Patient ID is required for record keeping and will be
                    associated with all diagnostic results.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (patientId.trim()) setCurrentStep('method-selection');
                    else alert('Please enter a valid Patient ID');
                  }}
                  disabled={!patientId.trim()}
                  className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  Continue to Diagnostic Methods <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── METHOD SELECTION ── */}
        {currentStep === 'method-selection' && (
          <motion.div key="method-selection"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Diagnostic Method</h2>
              <p className="text-lg text-gray-600">Choose how you want to capture tremor data</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <motion.button whileHover={{ scale: 1.02, y: -5 }} whileTap={{ scale: 0.98 }}
                onClick={() => selectMethod('upload')}
                className="glass-card-hover p-10 text-left group">
                <div className="flex justify-center mb-6">
                  <div className="p-6 bg-gradient-to-br from-[#004F7E] to-[#005A92] rounded-2xl group-hover:scale-110 transition-transform">
                    <Upload className="w-16 h-16 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">Upload Video</h3>
                <p className="text-gray-600 text-center mb-6">
                  Upload a pre-recorded video file for analysis. Supports MP4, MOV, and AVI formats.
                </p>
                <div className="space-y-2 text-sm">
                  {['Upload existing recordings', 'Process offline video files', 'Batch analysis support'].map(t => (
                    <div key={t} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-600" /><span>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <span className="inline-flex items-center gap-2 text-[#004F7E] font-semibold">
                    Select Method <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </span>
                </div>
              </motion.button>

              <motion.button whileHover={{ scale: 1.02, y: -5 }} whileTap={{ scale: 0.98 }}
                onClick={() => selectMethod('live-camera')}
                className="glass-card-hover p-10 text-left group relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <div className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">LIVE</div>
                </div>
                <div className="flex justify-center mb-6">
                  <div className="p-6 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl group-hover:scale-110 transition-transform">
                    <Video className="w-16 h-16 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">Live Camera Feed</h3>
                <p className="text-gray-600 text-center mb-6">
                  Use your device camera for real-time tremor detection and analysis.
                </p>
                <div className="space-y-2 text-sm">
                  {['Real-time monitoring', 'Instant feedback', '30-second capture window'].map(t => (
                    <div key={t} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-600" /><span>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <span className="inline-flex items-center gap-2 text-green-600 font-semibold">
                    Start Live Feed <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </span>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── SETUP ── */}
        {currentStep === 'setup' && (
          <motion.div key="setup"
            initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
            className="max-w-3xl mx-auto">
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Video</h2>
              <label className="block">
                <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
                <div className="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-[#004F7E] hover:bg-blue-50 transition-all cursor-pointer group">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4 group-hover:text-[#004F7E] group-hover:scale-110 transition-all" />
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    {uploadedFile ? 'File Selected' : 'Drop video file here or click to browse'}
                  </p>
                  {uploadedFile ? (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg inline-flex items-center gap-3">
                      <FileVideo className="w-6 h-6 text-green-600" />
                      <span className="font-mono text-green-700">{uploadedFile.name}</span>
                    </div>
                  ) : (
                    <p className="text-gray-500">Supported formats: MP4, MOV, AVI, WebM</p>
                  )}
                </div>
              </label>

              {uploadedFile && videoMeta && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Video Parameters</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-mono font-semibold">{videoMeta.duration}s</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Resolution:</span>
                        <span className="ml-2 font-mono font-semibold">{videoMeta.resolution}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Frame Rate:</span>
                        <span className="ml-2 font-mono font-semibold">{videoMeta.fps} fps</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Quality:</span>
                        <span className={`ml-2 font-mono font-semibold
                          ${videoMeta.quality === 'Excellent' ? 'text-green-600'
                            : videoMeta.quality === 'Good' ? 'text-blue-600'
                            : 'text-yellow-600'}`}>
                          {videoMeta.quality}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={startAnalysis}
                    className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3">
                    <Play className="w-6 h-6" /> Start Analysis Pipeline <ArrowRight className="w-6 h-6" />
                  </button>
                </motion.div>
              )}

              {uploadedFile && !videoMeta && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-600">Reading video metadata...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── LIVE CAMERA ── */}
        {currentStep === 'live-camera' && (
          <motion.div key="live-camera"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="max-w-5xl mx-auto">
            <div className="glass-card p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Camera Feed</h2>
                <p className="text-gray-600">Position hands in view for tremor analysis</p>
              </div>
              <div className="relative bg-gray-900 rounded-xl overflow-hidden mb-6" style={{ minHeight: '300px' }}>
                <video ref={videoRef} autoPlay playsInline muted
                  className="w-full h-auto block" style={{ maxHeight: '70vh' }} />
                <div className="absolute inset-0 pointer-events-none">
                  {isRecording && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="text-white font-bold">REC</span>
                      <span className="text-white font-mono">{recordingDuration}s / 30s</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="border-4 border-dashed border-green-500/50 rounded-lg w-96 h-64 flex items-center justify-center">
                      <span className="text-green-500 font-semibold bg-black/50 px-4 py-2 rounded">
                        Position Hands Here
                      </span>
                    </div>
                  </div>
                  {isRecording && (
                    <div className="absolute bottom-4 left-4 glass-card p-4">
                      <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-green-600 animate-pulse" />
                        <div>
                          <p className="text-xs text-gray-600 font-semibold uppercase">Detecting</p>
                          <p className="text-lg font-bold text-green-600 font-mono">Live Analysis</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {!isRecording ? (
                  <>
                    <button
                      onClick={() => { stopCamera(); setCurrentStep('method-selection'); }}
                      className="btn-secondary py-4 text-lg">
                      <ArrowRight className="w-5 h-5 rotate-180 mr-2" /> Change Method
                    </button>
                    <button onClick={startRecording} className="btn-primary py-4 text-lg gap-3">
                      <Camera className="w-6 h-6" /> Start Recording (30s)
                    </button>
                  </>
                ) : (
                  <button onClick={stopRecording}
                    className="btn-alert py-4 text-lg gap-3 md:col-span-2">
                    <StopCircle className="w-6 h-6" /> Stop & Analyze ({30 - recordingDuration}s remaining)
                  </button>
                )}
              </div>
              <div className="mt-6 p-6 bg-blue-50 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-3">Recording Instructions</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  {[
                    'Position hands within the guide frame',
                    'Keep hands relaxed and at rest during recording',
                    'Recording will automatically stop after 30 seconds',
                    'Ensure good lighting for optimal detection',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ANALYSIS ── */}
        {currentStep === 'analysis' && (
          <motion.div key="analysis"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-5xl mx-auto">
            <div className="glass-card p-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Pipeline Active</h2>
                <p className="text-lg text-gray-600">Analyzing kinematic data and frequency patterns...</p>
              </div>

              <div className="relative bg-gray-900 rounded-xl overflow-hidden mb-8" style={{ minHeight: '300px' }}>
                {savedName ? (
                  <img src={`/api/stream/${savedName}`} alt="Live analysis stream"
                    className="w-full h-auto block" style={{ maxHeight: '70vh' }} />
                ) : (
                  <div className="w-full flex items-center justify-center" style={{ height: '360px' }}>
                    <div className="text-center text-white">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="font-semibold text-lg">Uploading & processing video...</p>
                      <p className="text-sm text-gray-400 mt-2">Landmark overlay will appear shortly</p>
                    </div>
                  </div>
                )}
                <div className="absolute top-4 right-4 px-4 py-2 bg-[#004F7E] rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white font-bold text-sm">LIVE ANALYSIS</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm font-semibold text-gray-600 mb-2">
                  <span>Processing frames...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-[#004F7E] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Video Processing',    done: progress > 25 },
                  { label: 'Motion Tracking',     done: progress > 50 },
                  { label: 'Frequency Analysis',  done: progress > 75 },
                  { label: 'Pattern Recognition', done: progress > 90 },
                ].map(task => (
                  <div key={task.label}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${task.done ? 'bg-green-50' : 'bg-gray-50'}`}>
                    {task.done
                      ? <CheckCircle className="w-5 h-5 text-green-600" />
                      : <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
                    <span className={`font-semibold text-sm ${task.done ? 'text-green-700' : 'text-gray-600'}`}>
                      {task.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── COMPLETE ── */}
        {currentStep === 'complete' && (
          <motion.div key="complete"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="max-w-4xl mx-auto">
            <div className="glass-card p-8">
              <div className="text-center mb-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-12 h-12 text-white" />
                </motion.div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Analysis Complete</h2>
                <p className="text-lg text-gray-600">Diagnostic results ready for review</p>
              </div>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Patient ID:</p>
                <p className="text-xl font-bold text-[#004F7E] font-mono">{patientId}</p>
              </div>

              {savedName && (
                <div className="mb-8 relative bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: '240px' }}>
                  <img src={`/api/stream/${savedName}`} alt="Analysis replay"
                    className="w-full h-auto block" style={{ maxHeight: '60vh' }} />
                  <div className="absolute bottom-4 right-4 glass-card p-3">
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Status</p>
                    <p className="text-lg font-bold text-green-600">Analysis Complete</p>
                  </div>
                </div>
              )}

              {/* Core metrics */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <h3 className="font-semibold text-gray-700 mb-3">Diagnostic Interpretation</h3>
                  <p className="text-4xl font-bold text-[#004F7E] mb-2 font-mono">
                    {backendData.frequency.toFixed(1)} Hz
                  </p>
                  {/* ── FIX: use dominantLabel() so right hand isn't shadowed by left ── */}
                  <p className="text-lg font-semibold text-[#004F7E]">
                    {dominantLabel(backendData)}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Frequency pattern extracted from video analysis.
                  </p>
                </div>
                <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  <h3 className="font-semibold text-gray-700 mb-3">Additional Metrics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Patient ID:</span>
                      <span className="font-mono font-semibold">{patientId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amplitude:</span>
                      <span className="font-mono font-semibold">{backendData.amplitude.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Confidence:</span>
                      <span className="font-mono font-semibold text-green-600">{backendData.confidence}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-mono font-semibold">
                        {diagnosticMethod === 'live-camera' ? `${recordingDuration}s` : `${videoMeta?.duration ?? '–'}s`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Method:</span>
                      <span className="font-mono font-semibold capitalize">{diagnosticMethod}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ASYMMETRY INDEX ── */}
              {backendData.asymmetry && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6 p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <h3 className="font-bold text-purple-900 mb-4 text-lg">Asymmetry Index</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-white/70 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Index Value</p>
                      <p className="text-3xl font-bold font-mono text-purple-700">
                        {backendData.asymmetry.value.toFixed(3)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">–1 to +1 scale</p>
                    </div>
                    <div className="text-center p-4 bg-white/70 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Asymmetry %</p>
                      <p className={`text-3xl font-bold font-mono
                        ${backendData.asymmetry.percent < 10 ? 'text-green-600'
                          : backendData.asymmetry.percent < 25 ? 'text-yellow-600'
                          : 'text-red-600'}`}>
                        {backendData.asymmetry.percent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {backendData.asymmetry.percent < 10 ? 'Symmetric'
                          : backendData.asymmetry.percent < 25 ? 'Mild asymmetry'
                          : 'Significant asymmetry'}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-white/70 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Dominant Side</p>
                      <p className={`text-3xl font-bold
                        ${backendData.asymmetry.dominant === 'Symmetric' ? 'text-green-600' : 'text-purple-700'}`}>
                        {backendData.asymmetry.dominant}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {backendData.asymmetry.dominant === 'Symmetric'
                          ? 'Bilateral tremor' : 'Higher amplitude side'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Right dominant</span><span>Symmetric</span><span>Left dominant</span>
                    </div>
                    <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 z-10" />
                      <div className="absolute top-0 h-full bg-purple-500 rounded-full transition-all duration-700"
                        style={{
                          left: '50%',
                          width: `${Math.abs(backendData.asymmetry.value) * 50}%`,
                          transform: backendData.asymmetry.value >= 0 ? 'none' : 'translateX(-100%)',
                        }} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-purple-800 bg-purple-100 rounded px-3 py-2">
                    <strong>Clinical note:</strong> Asymmetry Index (AI) = (L – R) / (L + R).
                    Values above 25% may indicate unilateral onset, a hallmark of early Parkinson's Disease.
                  </p>
                </motion.div>
              )}

              {/* Per-hand breakdown */}
              {(backendData.leftHand || backendData.rightHand) && (
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {backendData.leftHand && (
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-xs uppercase font-bold text-green-700 mb-2">Left Hand</p>
                      <p className="text-2xl font-bold font-mono text-green-800">
                        {backendData.leftHand.frequency.toFixed(1)} Hz
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{backendData.leftHand.label}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Amplitude: {backendData.leftHand.amplitude.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {backendData.rightHand && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-xs uppercase font-bold text-blue-700 mb-2">Right Hand</p>
                      <p className="text-2xl font-bold font-mono text-blue-800">
                        {backendData.rightHand.frequency.toFixed(1)} Hz
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{backendData.rightHand.label}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Amplitude: {backendData.rightHand.amplitude.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button onClick={resetWorkflow} className="btn-secondary flex-1">New Session</button>
                <button
                  onClick={async () => { await saveSession(); onNavigate('history'); }}
                  className="btn-primary flex-1">
                  Save & View All Results
                </button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default Diagnostic;