import './assets/styles.css';
import '@/services'; // Register all AWS service plugins at startup
import { useState, useEffect, useCallback } from 'react';
import { Projects, Editor, Settings } from './pages';
import { AppSidebar, type AppShellView } from './components/app-sidebar';
import { Toaster } from './components/ui/toaster';
import { createInitialDiagram } from './utils';
import { useCreateProject } from '@/api';

import { useAppSelector } from '@/store';

/* Simple Hash Router */

type Route =
  | { view: 'projects' }
  | { view: 'settings' }
  | { view: 'editor'; projectId: string };

function parseHash(): Route {
  const hash = window.location.hash;

  // #/editor/:projectId
  const editorMatch = hash.match(/^#\/editor\/(.+)$/);
  if (editorMatch) {
    return { view: 'editor', projectId: decodeURIComponent(editorMatch[1]) };
  }

  if (/^#\/(?:settings|settinga)\/?$/.test(hash)) {
    return { view: 'settings' };
  }

  return { view: 'projects' };
}

function navigateTo(path: string) {
  window.location.hash = path;
}

/* App */

function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const theme = useAppSelector((state) => state.ui.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleOpenProject = useCallback((projectId: string) => {
    navigateTo(`/editor/${encodeURIComponent(projectId)}`);
  }, []);

  const createProjectMutation = useCreateProject();

  const handleNewProject = useCallback(async () => {
    const diagram = createInitialDiagram();
    try {
      const serverProject = await createProjectMutation.mutateAsync({
        projectName: diagram.projectName,
        projectDescription: diagram.projectDescription,
        nodes: diagram.nodes,
        edges: diagram.edges,
        deploymentSettings: diagram.deploymentSettings,
      });
      navigateTo(`/editor/${encodeURIComponent(serverProject.projectId)}`);
    } catch (err) {
      console.error('Failed to create new project:', err);
    }
  }, [createProjectMutation]);

  const handleNavigateHome = useCallback(() => {
    navigateTo('/');
  }, []);

  const handleShellNavigate = useCallback((path: string) => {
    navigateTo(path);
  }, []);

  const shellView: AppShellView | null =
    route.view === 'projects' || route.view === 'settings' ? route.view : null;

  return (
    <>
      {shellView && (
        <div className="flex min-h-screen bg-[var(--color-bg-base)] text-foreground">
          <AppSidebar
            currentView={shellView}
            onNavigate={handleShellNavigate}
          />
          <main className="min-w-0 flex-1 overflow-y-auto bg-background">
            {route.view === 'projects' && (
              <Projects
                onOpenProject={handleOpenProject}
                onNewProject={handleNewProject}
              />
            )}
            {route.view === 'settings' && <Settings />}
          </main>
        </div>
      )}
      {route.view === 'editor' && (
        <Editor
          key={route.projectId}
          projectId={route.projectId}
          onNavigateHome={handleNavigateHome}
        />
      )}
      <Toaster />
    </>
  );
}

export default App;
