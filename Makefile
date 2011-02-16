all: clean lint coverage npm-deps

.PHONY: test
.PHONY: npm-deps

clean:
	-rm -rf build

lint:
	jsl --conf etc/jsl.conf

test: lint
	-mkdir -p build
	nodeunit test/common test/core

coverage: lint
	-rm -rf build/lib-cov
	mkdir -p build
	#node-jscoverage lib/ build/lib-cov  --exclude thirdparty
	#cp -R lib/thirdparty build/lib-cov
	#expresso -q -I builnd/lib-cov
	#awaiting nodeunit coverage integration
	nodeunit test/common test/core

npm-deps:
	-npm ls installed > npm-deps

run-multi: kill-all
	bin/graviti --port 7111 &
	sleep 1
	bin/graviti --port 7112 --bootstraps "localhost:7111" &
	sleep 1
	bin/graviti --port 7113 --bootstraps "localhost:7111" &

kill-all:
	-killall node
