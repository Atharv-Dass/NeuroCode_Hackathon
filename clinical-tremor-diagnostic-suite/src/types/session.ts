export interface SpectrogramPoint {
  frequency: number;
  amplitude: number;
}

export interface HandResult {
  frequency: number;
  amplitude: number;
  label: string;
}

export interface DiagnosticSession {
  id: string;
  patientId: string;
  date: string;
  timestamp: number;
  frequency: number;
  amplitude: number;
  confidence: number;
  label?: string;          // ← ADD: dominant hand label
  status: 'normal' | 'alert';
  method: string;
  duration: number;
  spectrogramData: { frequency: number; amplitude: number }[];
  leftHand?: { frequency: number; amplitude: number; label: string };
  rightHand?: { frequency: number; amplitude: number; label: string };
  asymmetry?: {
    value: number;
    percent: number;
    dominant: string;
  };
}

export function getDiagnosticSessions(): DiagnosticSession[] {
  return [];
}

export function saveDiagnosticSession(_session: DiagnosticSession): void {
  // No-op
}

export function deleteSession(_id: string): void {
  // No-op
}

export async function getSessionById(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}`);
  if (!response.ok) throw new Error('Failed to fetch session');
  return response.json() as Promise<DiagnosticSession>;
}