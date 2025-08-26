import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Reader from './components/Reader';
import ReaderEpub from './components/ReaderEpub';
import Reader1 from './components/reader1'
import Reader2 from './components/reader2'
import Reader3 from './components/reader3'
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/reader-epub" element={<ReaderEpub />} />
         <Route path="/reader1" element={<Reader1 />} />
         <Route path="/reader2" element={<Reader2 />} />
                  <Route path="/reader3" element={<Reader3 />} />

      </Routes>
    </Router>
  );
}

export default App;
