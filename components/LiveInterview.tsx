"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, Square, Copy } from "lucide-react";

type Answer = { id: string; question: string; content: string; style: string; createdAt: string };
type BrowserRecognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };

export default function LiveInterview({ sessionId, style, onAnswer }: { sessionId: string; style: string; onAnswer: (answer: Answer) => void }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [liveAnswer, setLiveAnswer] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const finalRef = useRef("");
  const wantListeningRef = useRef(false);
  const generatingRef = useRef(false);
  const disposedRef = useRef(false);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    disposedRef.current = false;
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      disposedRef.current = true;
      wantListeningRef.current = false;
      if (restartRef.current) clearTimeout(restartRef.current);
      recognitionRef.current?.stop();
      abortRef.current?.abort();
    };
  }, []);

  function start() {
    wantListeningRef.current = true;
    beginRecognition();
  }

  function beginRecognition() {
    if (disposedRef.current || !wantListeningRef.current || generatingRef.current || recognitionRef.current) return;
    const w = window as SpeechWindow;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) { wantListeningRef.current = false; setError("Speech recognition isn't supported in this browser. Try desktop Chrome."); return; }
    setError("");
    const rec = new Recognition();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const line = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current = `${finalRef.current} ${line}`.trim();
        else interim += line;
      }
      setFinalText(finalRef.current);
      setInterimText(interim);
    };
    rec.onerror = (e) => {
      // Permission failures require user action; don't create a restart loop.
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error)) {
        wantListeningRef.current = false;
        setError(`Microphone recognition: ${e.error}. Check browser microphone permissions.`);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Microphone recognition: ${e.error}`);
      }
    };
    rec.onend = () => {
      if (recognitionRef.current === rec) recognitionRef.current = null;
      setListening(false);
      setInterimText("");
      // Browsers end speech sessions after silence. Restart while the user wants to listen.
      if (wantListeningRef.current && !generatingRef.current && !disposedRef.current) {
        restartRef.current = setTimeout(() => { restartRef.current = null; beginRecognition(); }, 350);
      }
    };
    try { rec.start(); setListening(true); }
    catch { recognitionRef.current = null; wantListeningRef.current = false; setError("Unable to start microphone. Check permissions."); }
  }

  function pauseRecognition() {
    if (restartRef.current) { clearTimeout(restartRef.current); restartRef.current = null; }
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { rec.onend = null; rec.onresult = null; rec.stop(); }
    setListening(false);
  }
  function stop() { wantListeningRef.current = false; pauseRecognition(); }
  function clear() { finalRef.current = ""; setFinalText(""); setInterimText(""); }

  async function generate() {
    const question = `${finalRef.current} ${interimText}`.trim();
    if (question.length < 5) return setError("Speak or type an interview question first.");
    generatingRef.current = true;
    setCurrentQuestion(question);
    pauseRecognition();
    clear(); // The next question starts with an empty transcript; listening resumes automatically.
    setError(""); setGenerating(true); setLiveAnswer("");
    const abort = new AbortController(); abortRef.current = abort;
    try {
      const response = await fetch("/api/answers/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, question: question.slice(0, 1200), style }), signal: abort.signal });
      if (!response.ok || !response.body) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Request failed: ${response.status}`); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      let receivedDone = false;
      let receivedText = false;
      const handleBlock = (block: string) => {
        const line = block.split("\n").find(l => l.startsWith("data: "));
        if (!line) return;
        const msg = JSON.parse(line.slice(6));
        if (msg.type === "delta") {
          receivedText = true;
          setLiveAnswer(v => v + msg.text);
        }
        if (msg.type === "done") {
          receivedDone = true;
          // Keep the generated answer visible; store a durable copy in history.
          if (!receivedText) setLiveAnswer(msg.answer.content);
          onAnswer(msg.answer);
        }
        if (msg.type === "error") throw new Error(msg.message);
      };
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() || "";
        for (const block of blocks) handleBlock(block);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handleBlock(buffer);
      if (!receivedDone) throw new Error("The stream ended before the answer was saved. Try again.");
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Could not stream answer"); }
    finally {
      setGenerating(false);
      generatingRef.current = false;
      abortRef.current = null;
      // No second Start Listening click after each generated answer.
      if (wantListeningRef.current && !disposedRef.current) beginRecognition();
    }
  }
  return <section className="livePanel">
    <div className="panelHeading"><span className="roundIcon"><Mic size={20}/></span><div><h2>Live interview assistant <span className="liveBeta">BETA</span></h2><p>Microphone transcript + streaming AI answer suggestions</p></div></div>
    <div className="liveNotice">Practice mode: only activate with permission and when AI assistance is allowed. This listens to your microphone, not directly to Zoom/Teams system audio. Browser transcription may send audio to a browser provider.</div>
    <div className="liveControls"><button className="primary" type="button" disabled={supported === false || wantListeningRef.current} onClick={start}><Mic size={16}/> Start listening</button><button className="secondary" type="button" disabled={!listening && !wantListeningRef.current} onClick={stop}><MicOff size={16}/> Stop</button><span className={listening ? "liveIndicator active" : "liveIndicator"}>{listening ? "● Listening continuously" : generating && wantListeningRef.current ? "○ Paused for answer · resumes automatically" : "○ Idle"}</span></div>
    {supported === false && <p className="liveError">Browser speech recognition is unavailable. Use Chrome or continue using typed questions.</p>}
    <label className="field"><span>Live transcript (editable)</span><textarea rows={4} value={finalText} onChange={e => { finalRef.current = e.target.value; setFinalText(e.target.value); }} placeholder="Start listening once, speak an interview question, or type it here..." /></label>
    {interimText && <p className="interimText">Hearing: {interimText}</p>}
    <div className="liveControls"><button className="primary" type="button" disabled={generating || !(finalText.trim() || interimText.trim())} onClick={generate}><Sparkles size={16}/> {generating ? "Streaming response..." : "Suggest answer"}</button><button className="secondary" type="button" onClick={clear}>Clear transcript</button>{generating && <button className="secondary" type="button" onClick={() => abortRef.current?.abort()}><Square size={14}/> Cancel</button>}</div>
    {error && <p className="liveError" role="alert">{error}</p>}
    {(generating || liveAnswer || currentQuestion) && <div className="streamedAnswer" aria-live="polite"><div className="streamedHeading"><b>Latest answer suggestion</b><button type="button" aria-label="Copy streamed answer" onClick={() => void navigator.clipboard.writeText(liveAnswer)}><Copy size={16}/></button></div>{currentQuestion && <p className="answerQuestion"><strong>Question:</strong> {currentQuestion}</p>}<p>{liveAnswer || (generating ? "Generating your answer…" : "No answer received yet. Check the error above and try again.")}</p></div>}
  </section>;
}
