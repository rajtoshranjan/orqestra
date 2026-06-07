import './assets/styles.css';
import '@/services'; // Register all AWS service plugins at startup
import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import {
  Projects,
  Editor,
  Preferences,
  LoginPage,
  SignUpPage,
  AuthLayout,
} from './pages';
import { AppSidebar, AppHeader } from './components';
import { Toaster } from './components/ui/toaster';
import { createInitialDiagram } from './utils';
import { AuthGuard, GuestGuard } from './components/guards';
import { useCreateProject } from '@/api';
import { useAppSelector } from '@/store';
import { CustomRouter } from '@/lib/custom-router';
import { history } from '@/lib/utils';

/* App Layout */

function AppLayout() {
  const handleShellNavigate = useCallback((path: string) => {
    history.push(path);
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-base)] text-foreground">
      <AppSidebar onNavigate={handleShellNavigate} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-w-0 flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* Editor Wrapper */

function EditorWrapper({ onNavigateHome }: { onNavigateHome: () => void }) {
  const { projectId } = useParams();
  if (!projectId) return <Navigate to="/" replace />;
  return (
    <Editor
      key={projectId}
      projectId={projectId}
      onNavigateHome={onNavigateHome}
    />
  );
}

/* App */

function App() {
  const theme = useAppSelector((state) => state.ui.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  const handleOpenProject = useCallback((projectId: string) => {
    history.push(`/editor/${encodeURIComponent(projectId)}`);
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
      history.push(`/editor/${encodeURIComponent(serverProject.projectId)}`);
    } catch (err) {
      console.error('Failed to create new project:', err);
    }
  }, [createProjectMutation]);

  const handleNavigateHome = useCallback(() => {
    history.push('/');
  }, []);

  return (
    <>
      <CustomRouter history={history}>
        <Routes>
          {/* Guest Routes */}
          <Route element={<GuestGuard />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
            </Route>
          </Route>

          {/* Authenticated Routes */}
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route
                path="/"
                element={
                  <Projects
                    onOpenProject={handleOpenProject}
                    onNewProject={handleNewProject}
                  />
                }
              />
              <Route path="/preferences" element={<Preferences />} />
            </Route>
            <Route
              path="/editor/:projectId"
              element={<EditorWrapper onNavigateHome={handleNavigateHome} />}
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CustomRouter>
      <Toaster />
    </>
  );
}

export default App;
