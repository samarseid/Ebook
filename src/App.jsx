import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Reader from './components/Reader';
import ReaderEpub from './components/ReaderEpub';
import Reader1 from './components/reader1'
import Reader2 from './components/reader2'
import Reader3 from './components/reader3'
import Audiobook from "./components/audiobook";
import Audiobook2 from "./components/audiobook2";
import Audiobook3 from "./components/audiobook3";
import Audiobook4 from "./components/audiobook4";
import Audiobook5 from "./components/audiobook5";

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
                   <Route path="/audiobook" element={<Audiobook />} />
                    <Route path="/audiobook2" element={<Audiobook2 />} />
  <Route path="/audiobook3" element={<Audiobook3 />} />
  <Route path="/audiobook4" element={<Audiobook4 />} />
  <Route path="/audiobook5" element={<Audiobook5 />} />

      </Routes>
    </Router>
  );
}

export default App;
