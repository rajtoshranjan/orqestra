import { createBrowserHistory } from 'history';

export const history =
  typeof window !== 'undefined'
    ? createBrowserHistory()
    : ({
        push: () => {},
        replace: () => {},
        listen: () => () => {},
        location: { pathname: '/' },
      } as any);

export default history;
