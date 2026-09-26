import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { agentReply, speakText, transcribeSpeech } from "@/lib/voice.functions";

export type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ended";

export type Turn = { role: "user" | "assistant"; content: string };

const SILENCE_THRESHOLD = 0.018;
const SILENCE_MS = 900;
const MIN_SPEECH_MS = 320;
const BARGE_IN_MS = 280;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the recorded audio."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export function useVoiceCall(customerName: string | null) {
  const transcribe = useServerFn(transcribeSpeech);
  const reply = useServerFn(agentReply);
  const speak = useServerFn(speakText);

  const [status, setStatus] = useState<CallStatus>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const callIdRef = useRef<string | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const liveRef = useRef(false);
  const speechStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const bargeStartRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const setPhase = useCallback((next: CallStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const persist = useCallback(async (role: "user" | "assistant", content: string) => {
    const id = callIdRef.current;
    if (!id) return;
    await supabase.from("call_messages").insert({ call_id: id, role, content });
  }, []);

  const pushTurn = useCallback(
    (turn: Turn) => {
      turnsRef.current = [...turnsRef.current, turn];
      setTurns(turnsRef.current);
      void persist(turn.role, turn.content);
    },
    [persist],
  );

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    liveRef.current = false;
    stopMeter();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    playerRef.current?.pause();
    playerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
  }, [stopMeter]);

  useEffect(() => teardown, [teardown]);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !liveRef.current) return;
    if (recorderRef.current && recorderRef.current.state === "recording") return;

    chunksRef.current = [];
    speechStartRef.current = null;
    silenceStartRef.current = null;

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (!liveRef.current || chunks.length === 0) return;
      void handleUtterance(new Blob(chunks, { type: "audio/webm" }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setPhase("listening");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPhase]);

  const speakReply = useCallback(
    async (text: string) => {
      const { audioBase64 } = await speak({ data: { text } });
      if (!liveRef.current) return;
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      playerRef.current = audio;
      setPhase("speaking");
      bargeStartRef.current = null;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      playerRef.current = null;
    },
    [setPhase, speak],
  );

  const runAgentTurn = useCallback(async () => {
    const { text } = await reply({
      data: { history: turnsRef.current, customerName },
    });
    if (!liveRef.current) return;
    pushTurn({ role: "assistant", content: text });
    await speakReply(text);
  }, [customerName, pushTurn, reply, speakReply]);

  const handleUtterance = useCallback(
    async (blob: Blob) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        setPhase("thinking");
        const audioBase64 = await blobToBase64(blob);
        const { text } = await transcribe({ data: { audioBase64 } });
        if (!liveRef.current) return;
        const spoken = text.trim();
        if (spoken.length < 2) {
          startRecorder();
          return;
        }
        pushTurn({ role: "user", content: spoken });
        await runAgentTurn();
      } catch (cause) {
        if (liveRef.current) {
          setError(cause instanceof Error ? cause.message : "Something went wrong on the call.");
        }
      } finally {
        busyRef.current = false;
        if (liveRef.current) startRecorder();
      }
    },
    [pushTurn, runAgentTurn, setPhase, startRecorder, transcribe],
  );

  const meter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !liveRef.current) return;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const sample of buffer) sum += sample * sample;
    const rms = Math.sqrt(sum / buffer.length);
    setLevel(Math.min(1, rms * 12));

    const now = performance.now();
    const phase = statusRef.current;

    if (phase === "listening" && recorderRef.current?.state === "recording") {
      if (rms > SILENCE_THRESHOLD) {
        if (speechStartRef.current === null) speechStartRef.current = now;
        silenceStartRef.current = null;
      } else if (speechStartRef.current !== null) {
        if (silenceStartRef.current === null) silenceStartRef.current = now;
        const spoke = now - speechStartRef.current > MIN_SPEECH_MS;
        if (spoke && now - silenceStartRef.current > SILENCE_MS) {
          recorderRef.current.stop();
        }
      }
    }

    if (phase === "speaking" && playerRef.current) {
      if (rms > SILENCE_THRESHOLD * 2.2) {
        if (bargeStartRef.current === null) bargeStartRef.current = now;
        if (now - bargeStartRef.current > BARGE_IN_MS) {
          playerRef.current.pause();
          playerRef.current = null;
          bargeStartRef.current = null;
          startRecorder();
        }
      } else {
        bargeStartRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(meter);
  }, [startRecorder]);

  const startCall = useCallback(async () => {
    setError(null);
    setTurns([]);
    turnsRef.current = [];
    setPhase("connecting");

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("You need to be signed in to start a call.");

      const { data: call, error: callError } = await supabase
        .from("calls")
        .insert({ customer_id: userId, status: "active" })
        .select("id")
        .single();
      if (callError || !call) throw new Error("Could not open a new call record.");
      callIdRef.current = call.id;
      setCallId(call.id);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      liveRef.current = true;
      rafRef.current = requestAnimationFrame(meter);

      setPhase("thinking");
      await runAgentTurn();
      if (liveRef.current) startRecorder();
    } catch (cause) {
      const message =
        cause instanceof DOMException
          ? "Microphone access was blocked. Allow the microphone and try again."
          : cause instanceof Error
            ? cause.message
            : "The call could not be started.";
      setError(message);
      teardown();
      setPhase("idle");
    }
  }, [meter, runAgentTurn, setPhase, startRecorder, teardown]);

  const endCall = useCallback(async () => {
    const id = callIdRef.current;
    liveRef.current = false;
    teardown();
    setPhase("ended");
    if (id) {
      await supabase
        .from("calls")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", id);
    }
    callIdRef.current = null;
  }, [setPhase, teardown]);

  return { status, turns, level, error, callId, startCall, endCall };
}
