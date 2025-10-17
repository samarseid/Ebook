import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AudioPlayer.css";
import { IoChevronBack } from "react-icons/io5";

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [currentPart, setCurrentPart] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  const audioRef = useRef(null);
  const navigate = useNavigate();

  const parts = [
    {
      title: "1-qism",
      src: "/audios/Ikki eshik orasi 1  - O'tkir Hoshimov.mp3",
    },
    {
      title: "2-qism",
      src: "/audios/Ikki eshik orasi 2  - O'tkir Hoshimov.mp3",
    },
    {
      title: "3-qism",
      src: "/audios/Ikki eshik orasi 3  - O'tkir Hoshimov.mp3",
    },
  ];

  // 🔹 Avvalgi part va vaqtni yuklash
  useEffect(() => {
    const savedPart = localStorage.getItem("audio_current_part");
    const savedTime = localStorage.getItem(`audio_progress_${savedPart}`);
    if (savedPart !== null) setCurrentPart(Number(savedPart));
    if (savedTime !== null) setCurrentTime(Number(savedTime));
  }, []);

  // 🔹 Har bir qism uchun alohida vaqtni saqlash
  useEffect(() => {
    const audio = audioRef.current;

    const update = () => {
      setCurrentTime(audio.currentTime);
      localStorage.setItem(
        `audio_progress_${currentPart}`,
        audio.currentTime.toString()
      );
      localStorage.setItem("audio_current_part", currentPart.toString());
    };

    const setMeta = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", setMeta);

    // 🔹 Qism o‘zgarganda avvalgi saqlangan vaqtdan davom etish
    const savedTime = localStorage.getItem(`audio_progress_${currentPart}`);
    if (savedTime) {
      audio.currentTime = Number(savedTime);
    }

    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", setMeta);
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
        <img src="images/yaxshiyam-sen-borsan.jpg" alt="yaxshiyam-sen-borsan" />
      </div>

      <div className="info">
        <h2>Yaxshiyam Sen Borsan</h2>
        <p>U. Hamdam</p>
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
