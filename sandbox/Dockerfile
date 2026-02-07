FROM alpine:3.19

# ─── Install compilers, Python, and utilities ───
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    python3 \
    bash \
    coreutils \
    && rm -rf /var/cache/apk/*

# ─── Copy runner script ───
COPY run.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh

# ─── Create sandbox directory ───
RUN mkdir -p /sandbox && chmod 755 /sandbox

# ─── Create non-root user for running submitted code ───
RUN adduser -D -u 1000 judge

WORKDIR /sandbox

ENTRYPOINT ["/usr/local/bin/run.sh"]
