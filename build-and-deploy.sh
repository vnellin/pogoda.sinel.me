#!/bin/bash
#
# Sample shell script to demo exit code usage #
#

npx next build

## Did we found IP address? Use exit status of the grep command ##
if [ $? -eq 0 ]
then
  cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
  rsync -avu --delete .next/standalone/ sinel@sky:/home/sinel/pogoda.sinel.me
  ssh sinel@sky "pm2 restart pogoda"
  echo "Success"
  exit 0
else
  echo "Failure"
  exit 1
fi