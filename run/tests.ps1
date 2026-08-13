#!/usr/bin/env sh
# runs the XData test suite on whatever deno is on the PATH
# (same as: deno run -Aq XData/run/all_tests.js)
exec deno run -Aq "$(dirname "$0")/all_tests.js" "$@"
