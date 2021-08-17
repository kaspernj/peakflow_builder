#!/bin/bash

docker network create \
  --subnet=56.0.0.0/24 \
   peakflow-builder
