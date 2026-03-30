import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(__dirname);

const aliases = {
  '@dnzn/dxkit': path.resolve(root, 'src/index.ts'),
  '@dnzn/dxkit-wallet': path.resolve(root, 'plugins/wallet/src/index.ts'),
  '@dnzn/dxkit-auth': path.resolve(root, 'plugins/auth/src/index.ts'),
  '@dnzn/dxkit-theme': path.resolve(root, 'plugins/theme/src/index.ts'),
  '@dnzn/dxkit-settings': path.resolve(root, 'plugins/settings/src/index.ts'),
};

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    environment: 'happy-dom',
    include: [
      'tests/**/*.test.ts',
      'plugins/*/tests/**/*.test.ts',
    ],
  },
});
