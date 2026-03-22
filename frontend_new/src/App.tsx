import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import DictionaryPage from './pages/DictionaryPage';
import TrainingPage from './pages/TrainingPage';
import StatsPage from './pages/StatsPage';
import ArenaPage from './pages/ArenaPage';
import ArenaStatsPage from './pages/ArenaStatsPage';

const App: React.FC = () => {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/arena" replace />} />
          <Route path="/codex" element={<DictionaryPage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/arena/stats" element={<ArenaStatsPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
