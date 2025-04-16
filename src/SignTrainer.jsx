import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

const SignTrainer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);

  const [signs, setSigns] = useState([]);
  const [currentSign, setCurrentSign] = useState("");
  const [lastLandmarks, setLastLandmarks] = useState(null);
  const [voices, setVoices] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedSign, setDetectedSign] = useState("");
  const lastAnnouncedRef = useRef("");

  useEffect(() => {
    const loadVoices = () => {
      let synthVoices = window.speechSynthesis.getVoices();
      if (synthVoices.length > 0) {
        const filtered = synthVoices.filter(voice =>
          voice.name.includes("Microsoft") ||
          voice.name.includes("Google") ||
          voice.lang.includes("en-US")
        );
        setVoices(filtered.length > 0 ? filtered : synthVoices);
      }
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    } else {
      loadVoices();
    }

    handsRef.current = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    handsRef.current.onResults((results) => {
      const landmarks = results.multiHandLandmarks || null;
      setLastLandmarks(landmarks);
      drawLiveLandmarks(landmarks);
      if (isDetecting && landmarks) {
        handleDetection(landmarks);
      }
    });

    const savedSigns = JSON.parse(localStorage.getItem("signs")) || [];
    setSigns(savedSigns);

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
    };
  }, [isDetecting]);

  const drawLiveLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    if (landmarks) {
      landmarks.forEach(points => {
        points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "red";
          ctx.fill();
        });
      });
    }

    const boxSize = 275;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 3;
    ctx.strokeRect(centerX - boxSize / 2, centerY - boxSize / 2, boxSize, boxSize);
    ctx.restore();
  };

  const startCamera = () => {
    if (!videoRef.current) return;
    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        if (handsRef.current) await handsRef.current.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });
    cameraRef.current.start();
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
  };

  const startTraining = () => {
    setIsTraining(true);
    setIsDetecting(false);
    lastAnnouncedRef.current = "";
    startCamera();
    speakText("Training started, camera is active.");
  };

  const stopTraining = () => {
    stopCamera();
    setIsTraining(false);
    speakText("Training stopped.");
  };

  const startDetection = () => {
    setIsTraining(false);
    setIsDetecting(true);
    lastAnnouncedRef.current = "";
    startCamera();
    speakText("Detection started, show your sign!");
  };

  const stopDetection = () => {
    stopCamera();
    setIsDetecting(false);
    setDetectedSign("");
    lastAnnouncedRef.current = "";
    speakText("Detection stopped.");
  };

  const saveSign = () => {
    if (currentSign.trim() && lastLandmarks) {
      const image = captureSignImage();
      const updatedSigns = [
        ...signs,
        { name: currentSign.trim(), landmarks: normalizeLandmarks(lastLandmarks[0]), image },
      ];
      setSigns(updatedSigns);
      localStorage.setItem("signs", JSON.stringify(updatedSigns));
      speakText(`Saved ${currentSign.trim()} successfully!`);
      setCurrentSign("");
    }
  };

  const captureSignImage = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL() : null;
  };

  const speakText = (text) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    if (voices.length > 0) {
      const localVoice = voices.find(v => v.name.includes("Microsoft"));
      utterance.voice = localVoice || voices[0];
    }
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const deleteSign = (index) => {
    const updatedSigns = signs.filter((_, i) => i !== index);
    setSigns(updatedSigns);
    localStorage.setItem("signs", JSON.stringify(updatedSigns));
    speakText("Sign deleted successfully!");
  };

  const clearSigns = () => {
    localStorage.removeItem("signs");
    setSigns([]);
    speakText("All signs cleared.");
  };

  const downloadSign = (image, signName) => {
    const link = document.createElement("a");
    link.href = image;
    link.download = `${signName}.png`;
    link.click();
  };

  const normalizeLandmarks = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return [];
    const center = landmarks[0];
    return landmarks.map(point => ({
      x: point.x - center.x,
      y: point.y - center.y,
      z: point.z - center.z
    }));
  };

  const handleDetection = (landmarks) => {
    if (!landmarks[0]) return;
    const normalizedLive = normalizeLandmarks(landmarks[0]);
    let matched = false;

    for (const sign of signs) {
      if (compareLandmarks(sign.landmarks, normalizedLive)) {
        if (lastAnnouncedRef.current !== sign.name) {
          lastAnnouncedRef.current = sign.name;
          setDetectedSign(sign.name);
          speakText(`Detected: ${sign.name}`);
        }
        matched = true;
        break;
      }
    }

    if (!matched && lastAnnouncedRef.current !== "No sign detected") {
      lastAnnouncedRef.current = "No sign detected";
      setDetectedSign("No sign detected");
    }
  };

  const compareLandmarks = (stored, live) => {
    if (!stored || !live) return false;
    let totalDist = 0;
    for (let i = 0; i < stored.length; i++) {
      const dx = stored[i].x - live[i].x;
      const dy = stored[i].y - live[i].y;
      const dz = stored[i].z - live[i].z;
      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return totalDist / stored.length < 0.04; // Stricter for accuracy
  };

  return (
    <div className="p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Train & Detect Custom Signs</h1>
      <div className="relative">
        <video ref={videoRef} style={{ transform: "scaleX(-1)" }} width="640" height="480" autoPlay playsInline className="border rounded-lg" />
        <canvas ref={canvasRef} width="640" height="480" className="absolute top-0 left-0" />
      </div>

      {isDetecting && detectedSign && (
        <div className="mt-4 text-xl text-blue-600 font-bold">
          Detected Sign: {detectedSign}
        </div>
      )}

      <input
        type="text"
        placeholder="Enter sign meaning"
        value={currentSign}
        onChange={(e) => setCurrentSign(e.target.value)}
        className="border p-2 mt-4"
      />

      <div className="mt-2 flex gap-2">
        <button onClick={saveSign} className="bg-blue-500 text-white px-4 py-2 rounded">Save Sign</button>
        {signs.length > 0 && <button onClick={clearSigns} className="bg-red-500 text-white px-4 py-2 rounded">Clear Signs</button>}
      </div>

      <div className="mt-4 flex gap-4">
        {!isTraining ? (
          <button onClick={startTraining} className="bg-green-500 text-white px-4 py-2 rounded">Start Training</button>
        ) : (
          <button onClick={stopTraining} className="bg-yellow-500 text-white px-4 py-2 rounded">Stop Training</button>
        )}

        {!isDetecting ? (
          <button onClick={startDetection} className="bg-purple-500 text-white px-4 py-2 rounded">Start Detecting</button>
        ) : (
          <button onClick={stopDetection} className="bg-orange-500 text-white px-4 py-2 rounded">Stop Detecting</button>
        )}
      </div>

      {signs.length > 0 && (
        <div className="mt-4 w-full max-w-md p-4 bg-gray-100 border rounded">
          <h2 className="font-bold mb-2">Saved Signs:</h2>
          {signs.map((sign, index) => (
            <div key={index} className="flex justify-between items-center border-b p-2 last:border-0 hover:bg-gray-200">
              <div className="flex items-center">
                <img src={sign.image} alt={sign.name} width="150" height="150" className="mr-3" />
                <span className="cursor-pointer text-blue-700 hover:underline">{sign.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => speakText(sign.name)} className="text-blue-600 hover:text-blue-800">🔊</button>
                <button onClick={() => deleteSign(index)} className="text-red-600 hover:text-red-800">❌</button>
                <button onClick={() => downloadSign(sign.image, sign.name)} className="text-green-600 hover:text-green-800">📥</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SignTrainer;
