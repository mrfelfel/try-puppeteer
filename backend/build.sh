#!/bin/bash

docker build --build-arg CACHEBUST=$(date +%d) -t try-rayconnect-docker .
