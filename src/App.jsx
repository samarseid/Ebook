import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Reader from './components/Reader';
import ReaderEpub from './components/ReaderEpub';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/reader-epub" element={<ReaderEpub />} />
      </Routes>
    </Router>
  );
}

export default App;
