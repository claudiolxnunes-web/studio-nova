import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EditorPage from "./pages/EditorPage";
import CriarVideo from "./pages/CriarVideo";
import Help from "./pages/Help";
import ScriptVideo from "./pages/ScriptVideo";
import ScriptPost from "./pages/ScriptPost";
import Projects from "./pages/Projects";
import AvatarStudio from "./pages/AvatarStudio";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Projects} />
      <Route path="/aula/:id" component={EditorPage} />
      <Route path="/avatar" component={AvatarStudio} />
      <Route path="/criar-video" component={CriarVideo} />
      <Route path="/ajustes" component={Settings} />
      <Route path="/ajuda" component={Help} />
      <Route path="/roteiro" component={ScriptVideo} />
      <Route path="/postagem" component={ScriptPost} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
