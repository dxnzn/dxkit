PLUGINS := $(wildcard plugins/*/tsup.config.ts)
PLUGIN_DIRS := $(dir $(PLUGINS))

# Build order: plugins with no cross-plugin deps first, then their dependents
PLUGIN_BUILD_ORDER := plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/

.PHONY: setup build test test-watch lint lint-fix format clean superclean audit commit publish release verify-outputs verify-no-runtime-deps typecheck smoke

setup:
	pnpm install

build:
	@echo
	@echo "BUILDING: ."
	@echo
	@npx tsup
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		echo; \
		echo "BUILDING: $$dir"; \
		echo; \
		(cd $$dir && npx tsup) || exit 1; \
	done

lint:
	npx biome check .

lint-fix:
	npx biome check --write .

lint-format:
	npx biome format --write .

test: lint typecheck
	npx vitest run

test-watch: lint typecheck
	npx vitest

clean:
	@echo
	@echo "CLEANING . . . "
	@echo
	@echo "./dist/"
	@rm -rf dist
	@for dir in $(PLUGIN_DIRS); do \
		echo "$${dir}dist/"; \
		rm -rf $$dir/dist; \
	done

superclean:
	@echo
	@echo "SUPER CLEANING . . . "
	@echo
	@echo "./dist/ ./node_modules/"
	@rm -rf dist node_modules
	@for dir in $(PLUGIN_DIRS); do \
		echo "$${dir}dist/ $${dir}node_modules/"; \
		rm -rf $$dir/dist $$dir/node_modules; \
	done

commit:
	npx cz

release: build verify-outputs verify-no-runtime-deps smoke test
	npx commit-and-tag-version
	@echo
	@echo "Release tagged. Review the changelog, then run:"
	@echo "  make publish"
	@echo "  git push --follow-tags"

publish: build verify-outputs verify-no-runtime-deps smoke test
	pnpm publish --access public
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		(cd $$dir && pnpm publish --access public) || exit 1; \
	done

verify-outputs:
	@echo
	@echo "VERIFYING BUILD OUTPUTS: ."
	@echo
	@for f in dist/index.js dist/index.cjs dist/index.global.js; do \
		test -f "$$f" || { echo "MISSING: $$f (root package)"; exit 1; }; \
		echo "OK: $$f"; \
	done
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		echo; \
		echo "VERIFYING BUILD OUTPUTS: $$dir"; \
		echo; \
		for f in dist/index.js dist/index.cjs dist/index.global.js; do \
			test -f "$$dir$$f" || { echo "MISSING: $$dir$$f"; exit 1; }; \
			echo "OK: $$dir$$f"; \
		done; \
	done
	@echo
	@echo "All build outputs present (3 formats x 5 packages)."

verify-no-runtime-deps:
	@echo
	@echo "VERIFYING ZERO RUNTIME DEPENDENCIES: package.json (GATE-02, core-only)"
	@echo
	@node ./scripts/check-no-runtime-deps.cjs package.json

typecheck:
	@echo
	@echo "TYPECHECKING: ."
	@echo
	@npx tsc --noEmit -p tsconfig.typecheck.json
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		echo; \
		echo "TYPECHECKING: $$dir"; \
		echo; \
		(cd $$dir && npx tsc --noEmit -p tsconfig.typecheck.json) || exit 1; \
	done

smoke: build
	@echo
	@echo "RUNNING BUILD-ARTIFACT SMOKE TEST (FCT-04)"
	@echo
	@npx vitest run --config vitest.smoke.config.ts

audit:
	@echo
	@echo "==> pnpm audit"
	@echo
	@pnpm audit || true
	@echo
	@echo "==> semgrep (TypeScript SAST)"
	@echo
	@semgrep --config p/typescript --metrics off src/ plugins/ || true
	@echo
	@echo "==> gitleaks (secret detection)"
	@echo
	@gitleaks detect --source . --no-banner || true
