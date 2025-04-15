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

  useEffect(() => {
    const loadVoices = () => {
      const synthVoices = window.speechSynthesis.getVoices();
      setVoices(synthVoices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    handsRef.current = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    handsRef.current.onResults((results) => {
      console.log("Landmarks detected:", results.multiHandLandmarks);
      setLastLandmarks(results.multiHandLandmarks || null);
      drawLiveLandmarks(results.multiHandLandmarks);
    });

    const savedSigns = JSON.parse(localStorage.getItem("signs")) || [];
    setSigns(savedSigns);

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
    };
  }, []);

  const drawLiveLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    if (landmarks) {
      landmarks.forEach((points) => {
        points.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "red";
          ctx.fill();
        });
      });
    }
    ctx.restore();
  };

  const startTraining = () => {
    if (!videoRef.current) return;

    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        if (handsRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    cameraRef.current.start();
    setIsTraining(true);
    speakText("Training started, camera is active.");
  };

  const stopTraining = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsTraining(false);
    speakText("Training stopped, camera is inactive.");
  };

  const saveSign = () => {
    if (currentSign.trim() && lastLandmarks) {
      const image = captureSignImage();
      const updatedSigns = [
        ...signs,
        { name: currentSign.trim(), landmarks: lastLandmarks, image },
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
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = voices.find(
      v => v.name.toLowerCase().includes("female") ||
           v.name.toLowerCase().includes("google") ||
           v.name.toLowerCase().includes("en-us")
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.9;
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

  return (
    <div className="p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Train Your Custom Sign</h1>

      <div className="relative">
        <video
          ref={videoRef}
          style={{ transform: "scaleX(-1)" }}
          width="640"
          height="480"
          autoPlay
          playsInline
          className="border rounded-lg"
        ></video>
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          className="absolute top-0 left-0"
        ></canvas>
      </div>

      <input
        type="text"
        placeholder="Enter sign meaning"
        value={currentSign}
        onChange={(e) => setCurrentSign(e.target.value)}
        className="border p-2 mt-4"
      />

      <div className="mt-2 flex gap-2">
        <button onClick={saveSign} className="bg-blue-500 text-white px-4 py-2 rounded">
          Save Sign
        </button>
        {signs.length > 0 && (
          <button
            onClick={clearSigns}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Clear Signs
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-4">
        {!isTraining ? (
          <button
            onClick={startTraining}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Start Training
          </button>
        ) : (
          <button
            onClick={stopTraining}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            Stop Training
          </button>
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
                <button onClick={() => speakText(sign.name)} className="ml-2 text-blue-600 hover:text-blue-800" title="Play Sign Name">🔊</button>
                <button onClick={() => deleteSign(index)} className="ml-2 text-red-600 hover:text-red-800" title="Delete Sign">❌</button>
                <button onClick={() => downloadSign(sign.image, sign.name)} className="ml-2 text-green-600 hover:text-green-800" title="Download Sign Image">📥</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SignTrainer;
