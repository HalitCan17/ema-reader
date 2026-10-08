"""EMA Reader yerel TTS sunucusu.

Yalnızca 127.0.0.1 üzerinde dinler. Seçili metni EMA Lightning ile seslendirip
WAV olarak döndürür. Hiçbir metin bilgisayarın dışına çıkmaz.
"""
import io
import logging
import threading
import wave
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

SAMPLE_RATE = 24000
MAX_CHARS = 2000

log = logging.getLogger("ema-reader")

state = {"tts": None, "device": "cpu"}
lock = threading.Lock()


def load_model():
    import torch
    from ema_lightning import EMA

    tts = EMA()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        try:
            tts = tts.lightning()
        except Exception as exc:  # derleme başarısız olursa düz modda devam et
            log.warning("lightning() başarısız, düz mod kullanılıyor: %s", exc)
    return tts, device


@asynccontextmanager
async def lifespan(app):
    log.info("EMA modeli yükleniyor (ilk çalıştırmada indirilir)...")
    state["tts"], state["device"] = load_model()
    log.info("EMA hazır (%s)", state["device"])
    yield


app = FastAPI(title="EMA Reader", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    expose_headers=["X-Duration"],
    allow_private_network=True,
)


class SayRequest(BaseModel):
    text: str
    speed: float = Field(1.0, ge=0.25, le=4.0)


def to_wav(audio: np.ndarray, sample_rate: int) -> bytes:
    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


@app.get("/health")
def health():
    return {"ok": state["tts"] is not None, "device": state["device"], "sample_rate": SAMPLE_RATE}


@app.post("/say")
def say(req: SayRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "Metin boş.")
    if len(text) > MAX_CHARS:
        raise HTTPException(400, f"Metin çok uzun (en fazla {MAX_CHARS} karakter).")
    with lock:
        speech = state["tts"].say(text, speed=req.speed, sample_rate=SAMPLE_RATE)
    return Response(
        content=to_wav(speech.audio, SAMPLE_RATE),
        media_type="audio/wav",
        headers={"X-Duration": f"{speech.duration:.3f}"},
    )
