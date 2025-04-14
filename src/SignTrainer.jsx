import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

const SignTrainer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [signs, setSigns] = useState([]);
  const [currentSign, setCurrentSign] = useState("");
  const [lastLandmarks, setLastLandmarks] = useState(null);
  const [voices, setVoices] = useState([]);
  const [isTraining, setIsTraining] = useState(false); // State to track if training is active
  const [camera, setCamera] = useState(null);

  useEffect(() => {
    const loadVoices = () => {
      const synthVoices = window.speechSynthesis.getVoices();
      setVoices(synthVoices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const savedSigns = JSON.parse(localStorage.getItem("signs")) || [];
    setSigns(savedSigns);

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      setLastLandmarks(results.multiHandLandmarks || null);
      drawLiveLandmarks(results.multiHandLandmarks);
    });

    // Initialize the camera, but don't start it until the "Start Training" button is pressed.
    const newCamera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && isTraining) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });
    setCamera(newCamera);

    return () => {
      if (camera) camera.stop(); // Cleanup camera when the component unmounts
    };
  }, [isTraining]);

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

  const saveSign = () => {
    if (currentSign.trim() && lastLandmarks) {
      const signImage = captureSignImage();
      const updatedSigns = [
        ...signs,
        { name: currentSign.trim(), landmarks: lastLandmarks, image: signImage },
      ];
      setSigns(updatedSigns);
      localStorage.setItem("signs", JSON.stringify(updatedSigns));
      speakText(`Saved ${currentSign.trim()} successfully!`);
      setCurrentSign("");
    }
  };

  const captureSignImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL(); // Captures the image from the canvas
  };

  const speakText = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = voices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("google") || v.name.toLowerCase().includes("en-us"));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
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
    const link = document.createElement('a');
    link.href = image;
    link.download = `${signName}.png`;  // Use the sign's name as the filename
    link.click();
  };

  const startTraining = () => {
    setIsTraining(true);
    camera.start(); // Start camera when training begins
    speakText("Training started, camera is now active.");
  };

  const stopTraining = () => {
    setIsTraining(false);
    camera.stop(); // Stop camera when training stops
    speakText("Training stopped, camera is now inactive.");
  };

  return (
    <div className="p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Train Your Custom Sign</h1>

      <div className="relative">
        <video
          ref={videoRef}
          style={{ transform: "scaleX(-1)" }}
          className="border rounded-lg"
          width="640"
          height="480"
          autoPlay
          playsInline
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
          <button onClick={clearSigns} className="bg-red-500 text-white px-4 py-2 rounded">
            Clear Signs
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-4">
        {!isTraining ? (
          <button onClick={startTraining} className="bg-green-500 text-white px-4 py-2 rounded">
            Start Training
          </button>
        ) : (
          <button onClick={stopTraining} className="bg-yellow-500 text-white px-4 py-2 rounded">
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
                <img src={sign.image} alt={sign.name} width="50" height="50" className="mr-2" />
                <span className="cursor-pointer text-blue-700 hover:underline">{sign.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => speakText(sign.name)} className="ml-2 text-blue-600 hover:text-blue-800" title="Play Sign Name">
                  🔊
                </button>
                <button onClick={() => deleteSign(index)} className="ml-2 text-red-600 hover:text-red-800" title="Delete Sign">
                  ❌
                </button>
                {/* Download Button */}
                <button onClick={() => downloadSign(sign.image, sign.name)} className="ml-2 text-green-600 hover:text-green-800" title="Download Sign Image">
                  📥
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SignTrainer;
