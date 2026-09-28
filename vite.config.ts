import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.APP_TARGET || 'workshop';

  if (target === 'admin') {
    return {
      plugins: [react()],
      base: './',
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      define: {
        __DEMO_ENABLED__: false,
      },
      server: {
        port: 3001,
        host: true,
      },
      build: {
        outDir: 'dist-admin',
        emptyOutDir: true,
        rollupOptions: {
          input: {
            admin: path.resolve(__dirname, 'admin.html'),
          },
          output: {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
      },
    };
  }

  if (target === 'demo') {
    return {
      plugins: [react()],
      base: './',
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
      define: {
        __DEMO_ENABLED__: true,
      },
      server: {
        port: 3002,
        host: true,
      },
      build: {
        outDir: 'dist-demo',
        emptyOutDir: true,
        rollupOptions: {
          input: {
            demo: path.resolve(__dirname, 'index.html'),
          },
          output: {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
      },
    };
  }

  // target === 'workshop' (default productive workshop artifact)
  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      __DEMO_ENABLED__: false,
    },
    server: {
      port: 3000,
      host: true,
    },
    build: {
      outDir: 'dist-workshop',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          workshop: path.resolve(__dirname, 'index.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  };
});
