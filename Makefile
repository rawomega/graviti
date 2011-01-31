all: clean lint coverage npm-deps

.PHONY: test

clean:
	-rm -rf build

lint:
	jsl --conf etc/jsl.conf

test: lint
	-mkdir -p build
	expresso -q -I lib

coverage: lint
	-rm -rf build/lib-cov
	mkdir -p build
	node-jscoverage lib/ build/lib-cov
	expresso -q -I build/lib-cov

npm-deps:
	npm ls installed > npm-deps

run-multi: kill-all
	node lib/main.js --port 7111 &
	node lib/main.js --port 7112 --bootstraps "localhost:7111" &
	node lib/main.js --port 7113 --bootstraps "localhost:7111" &

kill-all:
	-killall node
