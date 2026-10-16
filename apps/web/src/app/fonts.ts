import { Fraunces, Geist, Geist_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

/**
 * The three typefaces (docs/DESIGN.md §3), as CSS variables for `<html>`. Shared by the root
 * layout and the page that replaces it when it fails (`global-error.tsx`, P10-09).
 */
export const fontVariables = `${fraunces.variable} ${geist.variable} ${geistMono.variable}`;
