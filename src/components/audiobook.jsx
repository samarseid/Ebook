import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // 🟢 navigate uchun qo‘shildi
import "./AudioPlayer.css";
import {
  IoSettingsSharp,
  IoChevronBack,
  IoSearchSharp,
  IoBookmark,
  IoStar,
  IoStarOutline,
} from "react-icons/io5";

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [currentPart, setCurrentPart] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  const audioRef = useRef(null);
  const navigate = useNavigate(); // 🟢 endi bu joyda e’lon qilindi

  const parts = [
    {
      title: "1-qism",
      src: "/audios/Ikki eshik orasi 1 trek - O'tkir Hoshimov.mp3",
    },
    {
      title: "2-qism",
      src: "/audios/Ikki eshik orasi 2 trek - O'tkir Hoshimov.mp3",
    },
    {
      title: "3-qism",
      src: "/audios/Ikki eshik orasi 3 trek - O'tkir Hoshimov.mp3",
    },
  ];

  useEffect(() => {
    const audio = audioRef.current;
    const update = () => setCurrentTime(audio.currentTime);
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    return () => {
      audio.removeEventListener("timeupdate", update);
    };
  }, [currentPart]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (isPlaying) audio.pause();
    else audio.play();
    setIsPlaying(!isPlaying);
  };

  const skip = (sec) => {
    const audio = audioRef.current;
    audio.currentTime += sec;
  };

  const format = (time) => {
    if (!time || isNaN(time)) return "00:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const nextPart = () => {
    if (currentPart < parts.length - 1) {
      setCurrentPart(currentPart + 1);
      setIsPlaying(false);
    }
  };

  const prevPart = () => {
    if (currentPart > 0) {
      setCurrentPart(currentPart - 1);
      setIsPlaying(false);
    }
  };

  const changeSpeed = () => {
    const audio = audioRef.current;
    const newSpeed = speed === 2 ? 1 : speed + 0.5;
    setSpeed(newSpeed);
    audio.playbackRate = newSpeed;
  };

  return (
    <div className="audiobook-container">
      {/* 🔙 Ortga qaytish tugmasi */}
      <button
        onClick={() => navigate("/")}
        title="Orqaga"
        style={{
          background: "transparent",
          border: "none",
          padding: 4,
          cursor: "pointer",
          position: "absolute",
          top: 20,
          left: 20,
          color: "#fff",
        }}
      >
        <IoChevronBack size={26} />
      </button>

      <div className="cover">
        <img src="images/ikki-eshik-orasi.jpg" alt="ikki-eshik-orasi" />
      </div>

      <div className="info">
        <h2>Икки Эшик Ораси</h2>
        <p>O'. Hoshimov</p>
        <span>{parts[currentPart].title}</span>
      </div>

      <div className="progress">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => (audioRef.current.currentTime = e.target.value)}
        />
        <div className="time">
          <span>{format(currentTime)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>

      <div className="controls">
        <button onClick={prevPart}>⏮</button>
        <button onClick={() => skip(-15)}>↺15</button>
        <button className="play-btn" onClick={togglePlay}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={() => skip(15)}>15↻</button>
        <button onClick={nextPart}>⏭</button>
      </div>

      <div className="bottom">
        <button onClick={changeSpeed}>{speed.toFixed(1)}x</button>
        <button onClick={() => setShowMenu(!showMenu)}>☰</button>
      </div>

      {showMenu && (
        <div className="menu">
          <h4>Bo‘limlar</h4>
          {parts.map((part, i) => (
            <div
              key={i}
              onClick={() => {
                setCurrentPart(i);
                setShowMenu(false);
              }}
              className={i === currentPart ? "active" : ""}
            >
              {part.title}
            </div>
          ))}
        </div>
      )}

      <audio ref={audioRef} src={parts[currentPart].src} onEnded={nextPart} />
    </div>
  );
};

export default AudioPlayer;
