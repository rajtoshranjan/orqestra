import './assets/styles.css';
import '@/services'; // Register all AWS service plugins at startup
import { useState, useEffect, useCallback } from 'react';
import { Dashboard, Editor } from './pages';
import { Toaster } from './components/ui/toaster';
import { createInitialDiagram } from './utils';
import { useCreateProject } from '@/lib/api';

/* ─── Simple Hash Router ──────────────────────────────────────────────── */

type Route = { view: 'dashboard' } | { view: 'editor'; projectId: string };

function parseHash(): Route {
  const hash = window.location.hash;

  // #/editor/:projectId
  const editorMatch = hash.match(/^#\/editor\/(.+)$/);
  if (editorMatch) {
    return { view: 'editor', projectId: decodeURIComponent(editorMatch[1]) };
  }

  return { view: 'dashboard' };
}

function navigateTo(path: string) {
  window.location.hash = path;
}

/* ─── App ─────────────────────────────────────────────────────────────── */

function App() {
  const [route, setRoute] = useState<Route>(parseHash);

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

  return (
    <>
      {route.view === 'dashboard' && (
        <Dashboard
          onOpenProject={handleOpenProject}
          onNewProject={handleNewProject}
        />
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
