import 'react';

/**
 * `webkitdirectory` is what turns a file input into a folder picker, but it is
 * not in React's InputHTMLAttributes, so using it directly fails with TS2322.
 */
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
