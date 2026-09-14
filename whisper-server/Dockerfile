FROM ghcr.io/ggml-org/whisper.cpp:main

RUN mkdir -p /models && \
    curl -L --fail --retry 3 \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin \
    -o /models/ggml-base-q5_1.bin

EXPOSE 10000

CMD ["whisper-server --host 0.0.0.0 --port ${PORT:-10000} --model /models/ggml-base-q5_1.bin --language ar --convert --no-context --no-timestamps --threads 1"]
