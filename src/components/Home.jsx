import React from 'react';
import './Home.css';
import culpaMiaCover from '../assets/culpa-mia-cover.jpg';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/reader');
  };

  return (
    <div className="home-container">
      <h1 className="home-title">Kitoblar</h1>

      <div className="books-grid">
        <div className="book-card" onClick={handleClick}>
          <img src={culpaMiaCover} alt="Culpa Mia" className="book-image" />
          <p className="book-title">Culpa Mía</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
