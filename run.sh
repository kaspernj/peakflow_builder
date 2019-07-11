#!/bin/sh

docker run -d \
  --privileged \
  --restart=always \
  --name peak-flow-builder \
  --net peak-flow-builder \
  --ip 56.0.0.2 \
  --publish 5676:5676 \
  -v /home/kaspernj/Docker/peak-flow-builder/shared:/shared \
  docker:dind \
  dockerd-entrypoint.sh --group 1000 --tlsverify --tlscacert=/shared/certificates/tlscacert.pem --tlscert=/shared/certificates/tlscert.pem --tlskey=/shared/certificates/tlskey.pem -H tcp://0.0.0.0:5676
