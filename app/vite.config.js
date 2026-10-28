import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/* relative base: the build works from any folder or sub-path of a static host */
export default defineConfig({
  base: './',
  plugins: [react()]
});
