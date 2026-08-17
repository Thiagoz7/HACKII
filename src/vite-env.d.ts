/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module 'plotly.js-dist-min' {
  const Plotly: {
    newPlot: (el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<void>;
    purge: (el: HTMLElement) => void;
    Data: unknown;
    Layout: unknown;
  };
  export = Plotly;
}

declare module '*.svg?react' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.svg?import&react' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}
