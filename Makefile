.PHONY: nrepl
nrepl:
	cd test && clj -M:nrepl

start_nrepl:
	echo "FIXME"

stop_nrepl:
	echo "FIXME"

.PHONY: test
test:
	deno test --coverage=./cov --unstable --allow-all

.PHONY: lint
lint:
	deno fmt --check *.ts
	deno lint --unstable

.PHONY: update
# https://github.com/hayd/deno-udd
# deno install -A -f -n udd https://deno.land/x/udd@0.4.0/main.ts
update:
	udd deps.ts
