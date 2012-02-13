#! /bin/bash

if [ `grep Ubuntu -q /etc/lsb-release` -ne 0 ]; then
    echo Unsupported distro - only ubuntu is currently supported! >&2
    exit 1
fi

sudo apt-get install python-software-properties
sudo add-apt-repository ppa:chris-lea/node.js
sudo apt-get update
sudo apt-get install -y nodejs nodejs-dev curl

curl http://npmjs.org/install.sh | sudo sh


# install javascript lint
curl http://www.javascriptlint.com/download/jsl-0.3.0-src.tar.gz | tar -xf
cd jsl-0.3.0/src
make -f Makefile.ref
sudo cp Linux_All_DBG.OBJ/jsl  /usr/bin/
sudo chown root:root /usr/bin/jsl
cd ../..
rm -rf jsl-0.3.0

# install nodeunit
git clone https://github.com/caolan/nodeunit.git /tmp/nodeunit
pushd /tmp/nodeunit
make && sudo make install
popd
rm -rf /tmp/nodeunit


# install test npm deps
npm install timespan
npm install request



