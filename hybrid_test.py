import os
import json
import torch
import sounddevice as sd
import soundfile as sf

import azure.cognitiveservices.speech as speechsdk

from transformers import (
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForSequenceClassification
)


# ==========================
# SETTINGS
# ==========================

MODEL_PATH = "/Users/hamzahadidy/Desktop/masaar-ai"

AZURE_KEY = "PUT_KEY_HERE"
AZURE_REGION = "germanywestcentral"
AZURE_ENDPOINT_ID = "a7714b27-2e0c-44dc-b0c1-f57d6f1611a5"

SAMPLE_RATE = 16000
SECONDS = 3


# ==========================
# LOAD MASAAR
# ==========================

print("\nLoading MASAAR...")

feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
    MODEL_PATH
)

model = Wav2Vec2ForSequenceClassification.from_pretrained(
    MODEL_PATH
)

model.eval()


with open("masaar_metadata.json", "r", encoding="utf-8") as f:
    metadata = json.load(f)


id2label = {
    int(k): v
    for k, v in metadata["id2label"].items()
}


print("✅ MASAAR loaded")


# ==========================
# INPUT TARGET
# ==========================

target_letter = input(
    "\nالحرف المطلوب (مثال: ثاء): "
)


# ==========================
# RECORD
# ==========================

print("\n3")
print("2")
print("1")

print("��️ قول الحرف الآن")

audio = sd.rec(
    int(SECONDS * SAMPLE_RATE),
    samplerate=SAMPLE_RATE,
    channels=1,
    dtype="float32"
)

sd.wait()

audio = audio.squeeze()


wav_file = "hybrid_record.wav"

sf.write(
    wav_file,
    audio,
    SAMPLE_RATE
)


print("✅ Recorded")


# ==========================
# MASAAR
# ==========================

inputs = feature_extractor(
    audio,
    sampling_rate=SAMPLE_RATE,
    return_tensors="pt"
)


with torch.no_grad():
    logits = model(**inputs).logits


probs = torch.softmax(logits, dim=-1)[0]


top_id = torch.argmax(probs).item()

masaar_letter = id2label[top_id]

masaar_conf = probs[top_id].item()


print("\n====================")
print("MASAAR")
print("====================")

print(
    f"{masaar_letter} : {masaar_conf:.1%}"
)


# ==========================
# AZURE PRONUNCIATION
# ==========================

print("\n====================")
print("AZURE")
print("====================")


speech_config = speechsdk.SpeechConfig(
    subscription=AZURE_KEY,
    region=AZURE_REGION
)


speech_config.endpoint_id = AZURE_ENDPOINT_ID


# Arabic language
speech_config.speech_recognition_language = "ar-SA"


audio_config = speechsdk.audio.AudioConfig(
    filename=wav_file
)


recognizer = speechsdk.SpeechRecognizer(
    speech_config=speech_config,
    audio_config=audio_config
)


pronunciation_config = speechsdk.PronunciationAssessmentConfig(
    reference_text=target_letter,
    grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
    granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme
)


pronunciation_config.apply_to(recognizer)


result = recognizer.recognize_once()


if result.reason == speechsdk.ResultReason.RecognizedSpeech:

    assessment = speechsdk.PronunciationAssessmentResult(result)


    print(
        "Recognized:",
        result.text
    )

    print(
        "Accuracy:",
        assessment.accuracy_score
    )


    azure_score = assessment.accuracy_score


else:

    print("Azure ERROR")

    details = result.cancellation_details

    print(details.reason)
    print(details.error_code)
    print(details.error_details)

    azure_score = 0


# ==========================
# FINAL DECISION
# ==========================

print("\n====================")
print("FINAL")
print("====================")


# convert english labels
arabic_map = {
    "Tha": "ثاء",
    "Ta": "تاء",
    "Seen": "سين",
    "Fa": "فاء",
    "Jeem": "جيم"
}


masaar_ar = arabic_map.get(
    masaar_letter,
    masaar_letter
)


if (
    masaar_ar == target_letter
    and azure_score >= 70
):

    print("✅ النطق صحيح")

else:

    print("❌ يحتاج تدريب")

    print(
        "المطلوب:",
        target_letter
    )

    print(
        "MASAAR سمع:",
        masaar_ar
    )
