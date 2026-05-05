# Backend Integration Guide for OBT Quantifier

This guide explains where and how to connect your backend API to the OBT Quantifier frontend.

## Overview

All backend integration points are marked with **`PASTE_HERE`** comments in the code. Search for this string to find all integration locations.

---

## 1. Diagnostic Module - Video Upload Analysis

**File:** `src/pages/Diagnostic.tsx`  
**Function:** `startAnalysis()`  
**Line:** ~48-77

### Current Flow:
1. User uploads a video file
2. Patient ID is collected
3. Analysis is triggered

### Backend Integration:
Replace the simulation code with your API call:

```typescript
const startAnalysis = () => {
  setCurrentStep('analysis');
  setProgress(0);
  
  // PASTE YOUR BACKEND CODE HERE:
  const formData = new FormData();
  formData.append('video', uploadedFile); // The uploaded file
  formData.append('patientId', patientId);
  
  fetch('YOUR_BACKEND_URL/api/analyze-video', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      setBackendData({
        frequency: data.frequency,      // Hz value (e.g., 5.8)
        amplitude: data.amplitude,      // mm value (e.g., 2.4)
        confidence: data.confidence,    // Percentage (e.g., 94)
        spectrogramData: data.spectrogramData  // Array of {frequency, amplitude}
      });
      setProgress(100);
      setCurrentStep('complete');
    })
    .catch(error => {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please try again.');
    });
};
```

### Expected Response Format:
```json
{
  "frequency": 5.8,
  "amplitude": 2.4,
  "confidence": 94,
  "spectrogramData": [
    { "frequency": 0, "amplitude": 0 },
    { "frequency": 1, "amplitude": 0.2 },
    ...
    { "frequency": 12, "amplitude": 0 }
  ]
}
```

---

## 2. Diagnostic Module - Live Camera Feed Analysis

**File:** `src/pages/Diagnostic.tsx`  
**Function:** `stopRecording()`  
**Line:** ~118-154

### Current Flow:
1. User starts live camera recording
2. Records for 30 seconds
3. Automatically stops and analyzes

### Backend Integration:
You'll need to capture the video stream and send it to your backend:

```typescript
const stopRecording = () => {
  setIsRecording(false);
  setCurrentStep('analysis');
  setProgress(0);
  stopCamera();
  
  // PASTE YOUR BACKEND CODE HERE:
  // Assuming you have a MediaRecorder capturing the stream
  const videoBlob = recordedVideoBlob; // Get from your MediaRecorder
  
  const formData = new FormData();
  formData.append('video', videoBlob, 'live-recording.webm');
  formData.append('patientId', patientId);
  formData.append('duration', recordingDuration.toString());
  formData.append('method', 'live-camera');
  
  fetch('YOUR_BACKEND_URL/api/analyze-live', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      setBackendData({
        frequency: data.frequency,
        amplitude: data.amplitude,
        confidence: data.confidence,
        spectrogramData: data.spectrogramData
      });
      setProgress(100);
      setCurrentStep('complete');
    })
    .catch(error => {
      console.error('Live analysis failed:', error);
      alert('Analysis failed. Please try again.');
    });
};
```

---

## 3. Data Storage & Retrieval

**File:** `src/types/session.ts`

### Session Data Structure:
```typescript
interface DiagnosticSession {
  id: string;                    // Unique identifier
  patientId: string;             // Patient ID entered by user
  date: string;                  // ISO date string
  timestamp: number;             // Unix timestamp
  frequency: number;             // Hz value from backend
  amplitude: number;             // mm value from backend
  confidence: number;            // Percentage from backend
  status: 'normal' | 'alert';    // Based on confidence < 90
  method: 'upload' | 'live-camera';
  duration: number;              // Video duration in seconds
  spectrogramData?: Array<{      // Optional spectrogram data
    frequency: number;
    amplitude: number;
  }>;
}
```

### Storage Functions:
- `saveDiagnosticSession(session)` - Saves to localStorage
- `getDiagnosticSessions()` - Retrieves all sessions
- `getSessionById(id)` - Retrieves specific session

### Backend Integration Option:
Instead of localStorage, connect to your database:

```typescript
export const saveDiagnosticSession = async (session: DiagnosticSession) => {
  // PASTE YOUR BACKEND CODE HERE:
  await fetch('YOUR_BACKEND_URL/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  });
};

export const getDiagnosticSessions = async (): Promise<DiagnosticSession[]> => {
  // PASTE YOUR BACKEND CODE HERE:
  const response = await fetch('YOUR_BACKEND_URL/api/sessions');
  return await response.json();
};
```

---

## 4. Lab Results (History Page)

**File:** `src/pages/History.tsx`  
**Line:** ~27

### Current Implementation:
```typescript
const allSessions = getDiagnosticSessions();
```

Sessions automatically populate from:
1. Completed diagnostics (saved via `saveSession()`)
2. localStorage by default
3. Your backend if you modify `getDiagnosticSessions()`

### No Example Data:
- History page starts empty
- Records are added ONLY when diagnostic completes
- User clicks "Save & View All Results" after analysis

---

## 5. Analytics Page - Session-Specific View

**File:** `src/pages/Analytics.tsx`  
**Line:** ~14-15

### Current Implementation:
```typescript
const sessionData = sessionId ? getSessionById(sessionId) : null;
```

### Flow:
1. User clicks "View Report" in History
2. Analytics page loads with specific session data
3. Frequency spectrogram uses `sessionData.spectrogramData`
4. Metrics display `sessionData.frequency`, `amplitude`, `confidence`

### Spectrogram Data Usage:
```typescript
const currentData = sessionData?.spectrogramData && sessionData.spectrogramData.length > 0
  ? sessionData.spectrogramData  // Use backend data
  : defaultSpectrogramData;       // Fallback to default
```

---

## 6. Dashboard - Recent Activity

**File:** `src/pages/Dashboard.tsx`  
**Line:** ~18-19

### Current Implementation:
```typescript
const allSessions = getDiagnosticSessions();
const recentActivity = allSessions.slice(0, 4);  // Shows last 4 sessions
```

### Statistics Calculation:
```typescript
// Total sessions
allSessions.length

// Average frequency
(allSessions.reduce((sum, s) => sum + s.frequency, 0) / allSessions.length).toFixed(1)

// Average confidence
Math.round(allSessions.reduce((sum, s) => sum + s.confidence, 0) / allSessions.length)
```

---

## 7. Live Camera Implementation Notes

### MediaRecorder Setup (Required for Live Camera):

Add this to `src/pages/Diagnostic.tsx`:

```typescript
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const recordedChunksRef = useRef<Blob[]>([]);

const startRecording = () => {
  if (!streamRef.current) return;
  
  recordedChunksRef.current = [];
  const mediaRecorder = new MediaRecorder(streamRef.current, {
    mimeType: 'video/webm;codecs=vp9'
  });
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunksRef.current.push(event.data);
    }
  };
  
  mediaRecorder.start();
  mediaRecorderRef.current = mediaRecorder;
  setIsRecording(true);
  
  // Your existing timer code...
};

const stopRecording = () => {
  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      // Now send blob to backend
      sendToBackend(blob);
    };
  }
  setIsRecording(false);
  // Rest of your code...
};
```

---

## 8. Patient ID Collection

**File:** `src/pages/Diagnostic.tsx`  
**Screen:** Patient ID input (first step)

### Flow:
1. User enters Patient ID
2. Validation checks for non-empty
3. ID stored in state
4. Used in both upload and live camera methods
5. Saved with diagnostic results

---

## Summary of Integration Points

| Feature | File | Function/Location | Backend Endpoint |
|---------|------|-------------------|------------------|
| Video Upload Analysis | Diagnostic.tsx | `startAnalysis()` | POST /api/analyze-video |
| Live Camera Analysis | Diagnostic.tsx | `stopRecording()` | POST /api/analyze-live |
| Save Session | session.ts | `saveDiagnosticSession()` | POST /api/sessions |
| Load Sessions | session.ts | `getDiagnosticSessions()` | GET /api/sessions |
| Get Specific Session | session.ts | `getSessionById()` | GET /api/sessions/:id |

---

## Testing Without Backend

The application works standalone with:
- Simulated analysis (progress bar animation)
- localStorage for data persistence
- Default placeholder values
- All features fully functional for frontend testing

## Next Steps

1. Search codebase for `PASTE_HERE` comments
2. Replace simulation code with your API calls
3. Update endpoint URLs in all locations
4. Test with your backend
5. Adjust response parsing as needed

For questions or issues, refer to the specific file and line numbers mentioned above.
