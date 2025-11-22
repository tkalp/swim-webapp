#!/bin/bash

docker-compose stop worker
docker-compose exec redis redis-cli FLUSHALL
docker-compose start worker