export interface SpectrogramPoint {
  frequency: number;
  amplitude: number;
}

export interface HandResult {
  frequency: number;
  amplitude: number;
  label: string;
}

export interface AnalysisResponse {
  frequency: number;
  amplitude: number;
  confidence: number;
  label?: string;
  spectrogramData: SpectrogramPoint[];
  leftHand?: HandResult;
  rightHand?: HandResult;
  asymmetry?: {
    value: number;
    percent: number;
    dominant: string;
  } | null;
  framesProcessed?: number;
  fps?: number;
  patientId?: string;
  method?: string;
  duration?: string;
  filename?: string;
  savedName?: string;
}

export interface DiagnosticSession {
  id: string;
  patientId: string;
  date: string;
  timestamp: number;
  frequency: number;
  amplitude: number;
  confidence: number;
  label?: string;                          // ← ADD
  status: "normal" | "alert";
  method: "upload" | "live-camera";
  duration: number;
  spectrogramData: SpectrogramPoint[];     // ← non-optional, always send it
  leftHand?: HandResult;
  rightHand?: HandResult;
  asymmetry?: {                            // ← ADD
    value: number;
    percent: number;
    dominant: string;
  };
}

export async function analyzeUploadedVideo(file: File, patientId: string) {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("patientId", patientId);

  const response = await fetch("/api/analyze-video", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Video analysis failed");
  return response.json() as Promise<AnalysisResponse>;
}

export async function analyzeLiveVideo(blob: Blob, patientId: string, duration: number) {
  const formData = new FormData();
  formData.append("video", blob, "live-recording.webm");
  formData.append("patientId", patientId);
  formData.append("duration", duration.toString());
  formData.append("method", "live-camera");

  const response = await fetch("/api/analyze-live", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Live analysis failed");
  return response.json() as Promise<AnalysisResponse>;
}

export async function saveDiagnosticSession(session: DiagnosticSession) {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // JSON.stringify serialises the full object including spectrogramData array
    body: JSON.stringify(session),
  });

  if (!response.ok) throw new Error("Failed to save session");
  return response.json();
}

export async function getDiagnosticSessions() {
  const response = await fetch("/api/sessions");
  if (!response.ok) throw new Error("Failed to fetch sessions");
  return response.json() as Promise<DiagnosticSession[]>;
}

export async function getSessionById(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}`);
  if (!response.ok) throw new Error("Failed to fetch session");
  return response.json() as Promise<DiagnosticSession>;
}