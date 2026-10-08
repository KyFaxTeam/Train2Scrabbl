import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout/Layout';
import ArenaPage from './pages/ArenaPage';

/**
 * Decoupage par route.
 *
 * Mesure avant : 788 Ko decodes / 244 Ko gzip charges au premier ecran, dont
 * `recharts` et ses dependances `d3-*` (~75 Ko gzip) qui ne servent qu'aux deux
 * pages de statistiques. L'Arene, ecran d'accueil, les telechargeait pour rien.
 *
 * `ArenaPage` reste chargee d'emblee : c'est la destination de « / », la rendre
 * paresseuse ajouterait un aller-retour au demarrage sans rien economiser.
 */
const DictionaryPage = lazy(() => import('./pages/DictionaryPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const ArenaStatsPage = lazy(() => import('./pages/ArenaStatsPage'));
const StudySession = lazy(() =>
  import('./components/Arena/StudySession').then(m => ({ default: m.StudySession }))
);
const ReflexChallenge = lazy(() =>
  import('./components/Arena/ReflexChallenge').then(m => ({ default: m.ReflexChallenge }))
);
const ClubVerbsPage = lazy(() => import('./pages/ClubVerbsPage'));

const RouteFallback: React.FC = () => (
  <div className="h-full flex items-center justify-center text-slate-400">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

/**
 * Prechauffage du moteur d'entrainement : le lexique (236 Ko, puis lu depuis le
 * cache de l'appareil) est charge dans le worker des que le site est au repos,
 * sur n'importe quelle page. Ouvrir Training ne fait alors plus attendre ce
 * chargement - c'etait l'essentiel du temps avant le premier plateau.
 */
function usePrechauffageMoteur() {
  React.useEffect(() => {
    const lancer = () => {
      import('./engine/WorkerClient')
        .then((m) => m.EngineWorkerClient.getInstance().initialize())
        .catch(() => { /* Training retentera a l'ouverture */ });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(lancer, { timeout: 4000 });
    } else {
      const t = setTimeout(lancer, 2000);
      return () => clearTimeout(t);
    }
  }, []);
}

const App: React.FC = () => {
  usePrechauffageMoteur();
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Layout>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/arena" replace />} />
            <Route path="/codex" element={<DictionaryPage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/arena/stats" element={<ArenaStatsPage />} />
            <Route path="/arena/study/:world" element={<StudySession />} />
            <Route path="/arena/reflex" element={<ReflexChallenge />} />
            <Route path="/arena/entry/:entryId" element={<StudySession singleEntry />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/verbs" element={<ClubVerbsPage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
