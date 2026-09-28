import type { MouseEvent } from 'react';

export type Navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => void;

export const navigate: Navigate = (event, path) => {
  event.preventDefault();
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
