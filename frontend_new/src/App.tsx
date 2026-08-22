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

const RouteFallback: React.FC = () => (
  <div className="h-full flex items-center justify-center text-slate-400">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

const App: React.FC = () => {
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
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
