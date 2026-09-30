import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface RouterContextType {
  currentPath: string;
  navigate: (path: string) => void;
  searchParams: URLSearchParams;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getNormalizedPath = () => {
    if (typeof window === 'undefined') return '/midia';
    const path = window.location.pathname;
    // Map root to /midia by default
    if (path === '/' || path === '') return '/midia';
    return path;
  };

  const [currentPath, setCurrentPath] = useState<string>(getNormalizedPath);
  const [searchParams, setSearchParams] = useState<URLSearchParams>(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getNormalizedPath());
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (typeof window === 'undefined') return;
    const target = path === '/' ? '/midia' : path;
    const [pathname, search] = target.split('?');
    const normalizedPath = pathname === '/' || pathname === '' ? '/midia' : pathname;
    const fullTarget = search !== undefined ? `${normalizedPath}?${search}` : normalizedPath;
    const currentFull = window.location.pathname + window.location.search;
    if (currentFull !== fullTarget) {
      window.history.pushState({}, '', fullTarget);
      setCurrentPath(normalizedPath);
      setSearchParams(new URLSearchParams(search !== undefined ? `?${search}` : ''));
    }
  }, []);

  return (
    <RouterContext.Provider value={{ currentPath, navigate, searchParams }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
