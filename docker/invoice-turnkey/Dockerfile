# MOF e-Invoice Turnkey 3.2.x (Linux edition), linux/amd64
#
# Build context is this directory (docker/invoice-turnkey/). Put the official installer
# next to this file. The installer is NOT part of this repository; obtain it from the
# official channel. See README.md, section "Build the image".
#
#   docker build --platform linux/amd64 \
#     --build-arg TURNKEY_TARBALL=EINVTurnkey_setup_3.2.2.tar.gz \
#     -t einv-turnkey:3.2.2 .
#
# The installer ships an empty jre/ directory. Its start scripts use $JAVA_HOME only when
# ./javahome exists, so this image provides OpenJDK 17 and creates that marker file.
FROM eclipse-temurin:17-jre-jammy

ARG TURNKEY_TARBALL=EINVTurnkey_setup_3.2.2.tar.gz

ENV TZ=Asia/Taipei \
    LANG=zh_TW.UTF-8 \
    LC_ALL=zh_TW.UTF-8 \
    TURNKEY_HOME=/opt/EINVTurnkey \
    TURNKEY_DATA=/data

# locales/tzdata: timezone and Chinese encoding; fonts-noto-cjk: CJK font for the
# evidence reports; procps: ps/pkill for troubleshooting
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      locales tzdata fonts-noto-cjk procps \
 && sed -i 's/^# *zh_TW.UTF-8/zh_TW.UTF-8/' /etc/locale.gen && locale-gen \
 && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
 && rm -rf /var/lib/apt/lists/*

COPY ${TURNKEY_TARBALL} /tmp/turnkey.tar.gz
RUN tar xzf /tmp/turnkey.tar.gz -C /opt && rm /tmp/turnkey.tar.gz \
 && touch ${TURNKEY_HOME}/javahome \
 && chmod +x ${TURNKEY_HOME}/*.sh \
 && mv ${TURNKEY_HOME}/einvUserConfig.xml ${TURNKEY_HOME}/einvUserConfig.dist.xml

COPY turnkey-entrypoint.sh /usr/local/bin/turnkey-entrypoint
RUN chmod +x /usr/local/bin/turnkey-entrypoint

WORKDIR ${TURNKEY_HOME}
VOLUME ["/data"]
ENTRYPOINT ["turnkey-entrypoint"]
CMD ["start"]
