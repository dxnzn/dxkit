DXKIT_ROOT := ../..

.PHONY: serve clean

serve: vendor
	npx serve .

vendor:
	@test -f $(DXKIT_ROOT)/dist/index.global.js || (echo "Error: must run 'make build' from the dxkit root first" && exit 1)
	@mkdir -p vendor
	cp $(DXKIT_ROOT)/dist/index.global.js vendor/dxkit.global.js
	cp $(DXKIT_ROOT)/plugins/theme/dist/index.global.js vendor/dxkit-theme.global.js
	cp $(DXKIT_ROOT)/plugins/settings/dist/index.global.js vendor/dxkit-settings.global.js

clean:
	rm -rf vendor
