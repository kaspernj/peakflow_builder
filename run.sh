#!/bin/sh

docker run -d \
  --privileged \
  --restart=always \
  --name peakflow-builder \
  --net peakflow-builder \
  --ip 58.0.0.2 \
  --publish 8676:8676 \
  -v $(pwd)/shared:/shared \
  docker:27.0.3-dind \
  dockerd-entrypoint.sh --group 1000 --tlsverify --tlscacert=/shared/certificates/tlscacert.pem --tlscert=/shared/certificates/tlscert.pem --tlskey=/shared/certificates/tlskey.pem -H tcp://0.0.0.0:8676
