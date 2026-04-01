PLUGINS := $(wildcard plugins/*/tsup.config.ts)
PLUGIN_DIRS := $(dir $(PLUGINS))

# Build order: plugins with no cross-plugin deps first, then their dependents
PLUGIN_BUILD_ORDER := plugins/settings/ plugins/wallet/ plugins/auth/ plugins/theme/

.PHONY: setup build test test-watch lint lint-fix format clean superclean audit commit publish release

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

test: lint
	npx vitest run

test-watch: lint
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

release: build test
	npx commit-and-tag-version
	@echo
	@echo "Release tagged. Review the changelog, then run:"
	@echo "  make publish"
	@echo "  git push --follow-tags"

publish: build test
	pnpm publish --access public
	@for dir in $(PLUGIN_BUILD_ORDER); do \
		(cd $$dir && pnpm publish --access public) || exit 1; \
	done

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
