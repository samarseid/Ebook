import React from 'react';
import './Home.css';
import ikkiEshikCover from '../assets/ikki-eshik-orasi.jpg';
import yaxshiyamCover from '../assets/yaxshiyam-sen-borsan.jpg';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const handleClick = (book) => {
    // 1. Fayl nomini saqlaymiz
    localStorage.setItem('bookId', book.path.split('/').pop());

    // 2. Kitob turi bo‘yicha yo‘naltiramiz
    if (book.type === 'pdf') {
      navigate('/reader');
    } else if (book.type === 'epub') {
      navigate('/reader-epub');
    }
  };

  const books = [
    {
      title: 'Икки Эшик Ораси',
      cover: ikkiEshikCover,
      path: '/books/test.pdf',
      type: 'pdf',
    },
    {
      title: 'Yaxshiyam Sen Borsan',
      cover: yaxshiyamCover,
      path: '/books/test2.epub',
      type: 'epub',
    },
  ];

  return (
    <div className="home-container">
      <h1 className="home-title">Kitoblar</h1>
      <div className="books-grid">
        {books.map((book, index) => (
          <div key={index} className="book-card" onClick={() => handleClick(book)}>
            <img src={book.cover} alt={book.title} className="book-image" />
            <p className="book-title">{book.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
