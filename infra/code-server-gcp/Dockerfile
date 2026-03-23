FROM codercom/code-server:latest

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends git nodejs npm \
  && rm -rf /var/lib/apt/lists/*

COPY infra/code-server-gcp/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY infra/code-server-gcp/vscode-user-settings.json /home/coder/.local/share/code-server/User/settings.json
COPY extensions/aipa-lecturer-bridge /tmp/aipa-lecturer-bridge

RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /home/coder/workspace \
  && chown -R coder:coder /home/coder/workspace /home/coder/.local/share/code-server /tmp/aipa-lecturer-bridge

USER coder
RUN cd /tmp/aipa-lecturer-bridge \
  && npm ci --omit=dev \
  && pub="$(node -p "require('./package.json').publisher")" \
  && name="$(node -p "require('./package.json').name")" \
  && ver="$(node -p "require('./package.json').version")" \
  && dest="/home/coder/.local/share/code-server/extensions/${pub}.${name}-${ver}" \
  && mkdir -p "${dest}" \
  && cp -a . "${dest}/" \
  && rm -rf /tmp/aipa-lecturer-bridge

WORKDIR /home/coder/workspace

ENV CODE_SERVER_WORKSPACE=/home/coder/workspace
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
