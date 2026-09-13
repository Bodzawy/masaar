"use client";

import { useEffect, useState } from "react";

type LetterItem = {
  letter: string;
  name: string;
};

const letters: LetterItem[] = [
  { letter: "ا", name: "ألف" },
  { letter: "ب", name: "باء" },
  { letter: "ت", name: "تاء" },
  { letter: "ث", name: "ثاء" },
  { letter: "ج", name: "جيم" },
  { letter: "ح", name: "حاء" },
  { letter: "خ", name: "خاء" },
  { letter: "د", name: "دال" },
  { letter: "ر", name: "راء" },
  { letter: "س", name: "سين" },
];

const firstName = "Lukas";

function getRandomLetter(currentName?: string): LetterItem {
  const available = letters.filter(
    (item) => item.name !== currentName
  );

  const randomIndex = Math.floor(
    Math.random() * available.length
  );

  return (
    available[randomIndex] ?? {
      letter: "ا",
      name: "ألف",
    }
  );
}

function speakGerman(text: string) {
  if (typeof window === "undefined") return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "de-DE";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices =
    window.speechSynthesis.getVoices();

  const germanVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("de")
  );

  const preferredVoice =
    germanVoices.find((voice) =>
      /premium|enhanced/i.test(voice.name)
    ) ||
    germanVoices.find((voice) =>
      /anna/i.test(voice.name)
    ) ||
    germanVoices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export default function PronunciationTest() {
  const [current, setCurrent] =
    useState<LetterItem>(() => getRandomLetter());

  const [status, setStatus] =
    useState("");

  const [heard, setHeard] =
    useState("");

  const [recording, setRecording] =
    useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      speakGerman(
        `Los, ${firstName}! Lies diesen Buchstaben vor.`
      );
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [current]);

  function nextLetter() {
    setCurrent((previous) =>
      getRandomLetter(previous.name)
    );

    setStatus("");
    setHeard("");
  }

  function repeatQuestion() {
    speakGerman(
      `Los, ${firstName}! Lies diesen Buchstaben vor.`
    );
  }

  async function startRecording() {
    if (recording) return;

    const targetName = current.name;

    try {
      setRecording(true);
      setHeard("");

      setStatus(
        `🎤 Ich höre dir zu, ${firstName}...`
      );

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const recorder =
        new MediaRecorder(stream);

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.start();

      setTimeout(() => {
        if (
          recorder.state === "recording"
        ) {
          recorder.stop();
        }
      }, 2500);

      recorder.onstop = async () => {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        setStatus(
          "⏳ Ich prüfe deine Aussprache..."
        );

        const blob = new Blob(
          chunks,
          {
            type:
              recorder.mimeType ||
              "audio/webm",
          }
        );

        const formData =
          new FormData();

        formData.append(
          "audio",
          blob,
          "voice.webm"
        );

        formData.append(
          "target",
          targetName
        );

        try {
          const response =
            await fetch(
              "/api/pronunciation",
              {
                method: "POST",
                body: formData,
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            setStatus(
              "❌ " +
                (result.error ||
                  "Es ist ein Fehler aufgetreten.")
            );

            setRecording(false);
            return;
          }

          setHeard(
            `Erkannt: ${result.heard}`
          );

          if (result.correct) {
            setStatus(
              "✅ Sehr gut!"
            );

            speakGerman(
              `Super, ${firstName}! Sehr gut gemacht.`
            );

            setTimeout(() => {
              nextLetter();
            }, 1800);
          } else {
            setStatus(
              "❌ Versuch es noch einmal."
            );

            speakGerman(
              `Fast, ${firstName}. Versuch es noch einmal.`
            );
          }
        } catch (error) {
          console.error(error);

          setStatus(
            "❌ Verbindungsfehler."
          );
        }

        setRecording(false);
      };
    } catch (error) {
      console.error(error);

      setStatus(
        "❌ Bitte erlaube den Zugriff auf dein Mikrofon."
      );

      setRecording(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-lg">

        <p className="mb-3 text-gray-500">
          Aussprachetraining
        </p>

        <h1 className="mb-3 text-3xl font-bold">
          Lies den Buchstaben vor
        </h1>

        <p className="mb-10 text-gray-500">
          Sprich den Namen des arabischen Buchstabens laut aus.
        </p>

        <div
          dir="rtl"
          className="mb-10 text-9xl font-bold"
        >
          {current.letter}
        </div>

        <div className="flex flex-col items-center gap-3">

          <button
            onClick={startRecording}
            disabled={recording}
            className="rounded-xl bg-black px-8 py-4 text-xl text-white disabled:opacity-50"
          >
            {recording
              ? "🎤 Ich höre zu..."
              : "🎤 Sprechen"}
          </button>

          <button
            onClick={repeatQuestion}
            disabled={recording}
            className="rounded-xl border border-gray-300 px-6 py-3 text-lg disabled:opacity-50"
          >
            🔊 Noch einmal hören
          </button>

        </div>

        {heard && (
          <p className="mt-8 text-xl">
            {heard}
          </p>
        )}

        {status && (
          <p className="mt-5 text-2xl font-bold">
            {status}
          </p>
        )}

      </div>
    </main>
  );
}