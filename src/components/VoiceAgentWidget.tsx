import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, isTokenExpired, triggerSessionExpired } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { Station } from '../store/stations/stationsState';
import { fetchStations } from '../store/stations/stationsThunks';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

interface RecommendedAction {
  id: number;
  name: string;
}

interface VehicleDto {
  id: number;
  model: string;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultListItem {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultListItem>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5096/api';

const QUICK_PROMPTS = [
  'מצא לי עמדה מהירה קרובה לרוטשילד פתח תקווה',
  'יש לי 20% סוללה ואני ממהר, מה הכי קרוב?',
  'אני יושב לפגישה של שעתיים בתל אביב, מה מומלץ?',
];

function parseAgentMessage(raw: string): { cleanText: string; stations: RecommendedAction[] } {
  const stations: RecommendedAction[] = [];
  const seenIds = new Set<number>();
  const regex = /\[\[STATION:(\d+):([^\]]+)\]\]/g;

  let match: RegExpExecArray | null = regex.exec(raw);
  while (match !== null) {
    const id = Number(match[1]);
    const name = match[2].trim();
    if (!Number.isNaN(id) && !seenIds.has(id)) {
      seenIds.add(id);
      stations.push({ id, name });
    }
    match = regex.exec(raw);
  }

  const cleanText = raw
    .replace(/\[\[STATION:\d+:[^\]]+\]\]/g, '')
    .replace(/\*\*/g, '')
    .trim();

  return { cleanText, stations };
}

export default function VoiceAgentWidget() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { role, carModel } = useAppSelector((state) => state.user);
  const { currentBatteryPercent, targetBatteryPercent } = useAppSelector((state) => state.stations);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      text: 'היי! אני העוזר החכם שלך לטעינה ⚡ לחצי על המיקרופון, דברי חופשי, וכשאת מוכנה לחצי שלח — ותקבלי כפתור ישיר לשריון העמדה!',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [reservingStationId, setReservingStationId] = useState<number | null>(null);
  const [hasActiveBookingError, setHasActiveBookingError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const ignoreVoiceRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      ignoreVoiceRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  const stopVoiceIfActive = () => {
    ignoreVoiceRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleReserveFromAgent = async (stationId: number) => {
    setErrorMessage(null);
    setHasActiveBookingError(false);
    setReservingStationId(stationId);

    try {
      const station = await apiFetch<Station>(`/ChargingStations/${stationId}`);
      let vehicles = await apiFetch<VehicleDto[]>('/UsersVehicles/my');

      if (vehicles.length === 0) {
        const created = await apiFetch<VehicleDto>('/UsersVehicles', {
          method: 'POST',
          body: JSON.stringify({
            model: carModel || 'Tesla Model 3',
            batteryCapacityKwh: 75,
            currentBattery: currentBatteryPercent,
            supportedChargerType: station.chargerType || 'CCS',
          }),
        });
        vehicles = [created];
      }

      const currentBattery = Math.min(currentBatteryPercent, 95);
      const targetBattery = Math.max(targetBatteryPercent, currentBattery + 1);
      const arrivalTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await apiFetch('/ChargeBooking', {
        method: 'POST',
        body: JSON.stringify({
          stationId: station.id,
          vehicleId: vehicles[0].id,
          currentBatteryPercent: currentBattery,
          targetBatteryPercent: targetBattery,
          estimatedArrivalTime: arrivalTime,
        }),
      });

      setIsOpen(false);
      navigate('/active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בשריון העמדה';
      if (msg.includes('הזמנה פעילה')) {
        setHasActiveBookingError(true);
      }
      setErrorMessage(
        msg.includes('403')
          ? 'שריון עמדה זמין רק במצב נהג (Driver).'
          : msg
      );
    } finally {
      setReservingStationId(null);
    }
  };

  const handleOpenMapResults = async () => {
    await dispatch(fetchStations());
    setIsOpen(false);
    navigate('/results');
  };

  const sendMessageToAgent = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isStreaming) return;

    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      triggerSessionExpired();
      return;
    }

    stopVoiceIfActive();
    setErrorMessage(null);
    setHasActiveBookingError(false);
    setInputText('');

    const userMsg: ChatMessage = { role: 'user', text: trimmed };
    const historyForServer: ChatMessage[] = [...messages.slice(1), userMsg].map((m) => ({
      role: m.role,
      text: m.text.slice(0, 2000),
    }));

    setMessages((prev) => [...prev, userMsg, { role: 'ai', text: '' }]);
    setIsStreaming(true);

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 90000);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: historyForServer }),
        signal: abortController.signal,
      });

      if (response.status === 401) {
        triggerSessionExpired();
        return;
      }

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '');
        let parsedMsg = errText;
        try {
          const jsonErr = JSON.parse(errText) as { detail?: string; title?: string; message?: string };
          parsedMsg = jsonErr.detail || jsonErr.title || jsonErr.message || errText;
        } catch {
          // נשאר טקסט רגיל
        }
        throw new Error(parsedMsg || `שגיאת שרת (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedAnyText = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const lines = rawEvent.split(/\r?\n/);
          let eventType = 'message';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (!dataStr || dataStr === '[DONE]') {
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr) as { text?: string; title?: string };
                if (eventType === 'error') {
                  throw new Error(parsed.title || 'התשובה נקטעה באמצע, נסי שוב.');
                }
                if (parsed.text) {
                  receivedAnyText = true;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    if (lastIndex >= 0 && updated[lastIndex].role === 'ai') {
                      updated[lastIndex] = {
                        ...updated[lastIndex],
                        text: updated[lastIndex].text + parsed.text,
                      };
                    }
                    return updated;
                  });
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && eventType === 'error') {
                  throw parseErr;
                }
              }
            }
          }
        }
      }

      if (!receivedAnyText) {
        throw new Error('השרת לא החזיר תשובה. בדקי את הקונסול ב-Visual Studio.');
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'הסוכן התעכב יותר מדי (Timeout). בדקי את הקונסול של השרת.'
          : err instanceof Error
            ? err.message
            : 'שגיאה בחיבור לסוכן החכם';
      setErrorMessage(msg);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'ai' && !last.text) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessageToAgent(inputText);
  };

  const handleToggleVoice = () => {
    setErrorMessage(null);
    setIsOpen(true);

    if (isListening) {
      stopVoiceIfActive();
      return;
    }

    const w = window as WindowWithSpeech;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMessage('זיהוי דיבור נתמך בדפדפני Chrome / Edge. אפשר גם להקליד רגיל.');
      return;
    }

    ignoreVoiceRef.current = false;
    const recognition = new SpeechRec();
    recognition.lang = 'he-IL';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (ignoreVoiceRef.current) return;
      let transcriptAll = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const chunk = event.results[i]?.[0]?.transcript;
        if (chunk) {
          transcriptAll += `${chunk} `;
        }
      }
      setInputText(transcriptAll.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setErrorMessage('לא אושרה גישה למיקרופון בדפדפן.');
      } else if (event.error !== 'aborted') {
        setErrorMessage('לא הצלחתי לשמוע ברור, נסי שוב.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      {isOpen && (
        <div
          style={{
            width: '370px',
            maxWidth: 'calc(100vw - 32px)',
            height: '490px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '14px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: 'white',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              background: '#1e293b',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
              🤖 העוזר החכם לטעינה
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                fontSize: '1.1rem',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '85%',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      fontSize: '0.88rem',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      textAlign: 'right',
                      background: '#2563eb',
                      color: 'white',
                    }}
                  >
                    {msg.text}
                  </div>
                );
              }

              const { cleanText, stations } = parseAgentMessage(msg.text);
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '88%',
                    padding: '9px 12px',
                    borderRadius: '12px',
                    fontSize: '0.88rem',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    textAlign: 'right',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: 'white',
                  }}
                >
                  <div>
                    {cleanText || (isStreaming && idx === messages.length - 1 ? 'חושב ומחפש עמדות...' : '')}
                  </div>

                  {stations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                      {stations.map((st) => (
                        <div key={st.id} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {role === 'Driver' && (
                            <button
                              type="button"
                              disabled={reservingStationId === st.id}
                              onClick={() => void handleReserveFromAgent(st.id)}
                              style={{
                                flex: 1,
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--primary)',
                                color: 'black',
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                              }}
                            >
                              {reservingStationId === st.id
                                ? 'משריין...'
                                : `⚡ שריין את "${st.name}" (15 דק')`}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleOpenMapResults()}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '8px',
                              border: '1px solid #475569',
                              background: '#0f172a',
                              color: '#e2e8f0',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            🗺️ למפה
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 8px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void sendMessageToAgent(prompt)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'right',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                background: '#7f1d1d',
                color: '#fecaca',
                fontSize: '0.8rem',
                padding: '8px 10px',
                textAlign: 'center',
              }}
            >
              <div>⚠️ {errorMessage}</div>
              {hasActiveBookingError && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/active');
                  }}
                  style={{
                    marginTop: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'black',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                  }}
                >
                  ⏱️ עבור להזמנה הפעילה שלי ➔
                </button>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              padding: '10px',
              background: '#1e293b',
              borderTop: '1px solid #334155',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleToggleVoice}
              disabled={isStreaming}
              title={isListening ? 'עצור הקלטה' : 'הקלט בקול בעברית'}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: isListening ? '#dc2626' : '#0ea5e9',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              {isListening ? '⏹️' : '🎤'}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'מדברת... המילים יופיעו כאן' : 'שאלי על עמדה קרובה...'}
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: isListening ? '1px solid #ef4444' : '1px solid #475569',
                background: '#0f172a',
                color: 'white',
                fontSize: '0.88rem',
              }}
            />

            <button
              type="submit"
              disabled={isStreaming || !inputText.trim()}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary)',
                color: 'black',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              שלח
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            padding: '10px 16px',
            borderRadius: '999px',
            border: '1px solid #38bdf8',
            background: '#0f172a',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            fontSize: '0.9rem',
          }}
        >
          {isOpen ? 'סגור עוזר' : '🤖 עוזר חכם'}
        </button>

        <button
          type="button"
          onClick={handleToggleVoice}
          disabled={isStreaming}
          title="קיצור דרך להקלטת הודעה קולית לסוכן"
          style={{
            padding: '10px 14px',
            borderRadius: '999px',
            border: 'none',
            background: isListening ? '#dc2626' : 'var(--primary)',
            color: isListening ? 'white' : 'black',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            fontSize: '0.9rem',
          }}
        >
          {isListening ? '🔴 מקליט... לחצי לעצירה' : '🎤 הקלט לסוכן'}
        </button>
      </div>
    </div>
  );
}