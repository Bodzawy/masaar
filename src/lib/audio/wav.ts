export async function blobTo16KhzMonoWav(blob: Blob): Promise<Blob> {
    const input = await blob.arrayBuffer();
  
    const AudioContextConstructor =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
  
    if (!AudioContextConstructor) {
      throw new Error("AudioContext is not supported.");
    }
  
    const audioContext = new AudioContextConstructor();
  
    const decoded = await audioContext.decodeAudioData(
      input.slice(0)
    );
  
    const sampleRate = 16000;
  
    const frameCount = Math.max(
      1,
      Math.ceil(decoded.duration * sampleRate)
    );
  
    const offlineContext = new OfflineAudioContext(
      1,
      frameCount,
      sampleRate
    );
  
    const source = offlineContext.createBufferSource();
  
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start();
  
    const rendered = await offlineContext.startRendering();
  
    await audioContext.close();
  
    return encodeWav(
      rendered.getChannelData(0),
      sampleRate
    );
  }
  
  function encodeWav(
    samples: Float32Array,
    sampleRate: number
  ): Blob {
    const bytesPerSample = 2;
  
    const buffer = new ArrayBuffer(
      44 + samples.length * bytesPerSample
    );
  
    const view = new DataView(buffer);
  
    writeString(view, 0, "RIFF");
  
    view.setUint32(
      4,
      36 + samples.length * bytesPerSample,
      true
    );
  
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
  
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
  
    writeString(view, 36, "data");
  
    view.setUint32(
      40,
      samples.length * bytesPerSample,
      true
    );
  
    let offset = 44;
  
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(
        -1,
        Math.min(1, samples[i] ?? 0)
      );
  
      view.setInt16(
        offset,
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff,
        true
      );
  
      offset += 2;
    }
  
    return new Blob([buffer], {
      type: "audio/wav",
    });
  }
  
  function writeString(
    view: DataView,
    offset: number,
    text: string
  ) {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(
        offset + i,
        text.charCodeAt(i)
      );
    }
  }