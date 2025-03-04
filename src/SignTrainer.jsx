import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

const SignTrainer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [signs, setSigns] = useState([]); // Stores saved signs
  const [currentSign, setCurrentSign] = useState(""); // Stores input value
  const [lastLandmarks, setLastLandmarks] = useState(null); // Stores latest detected landmarks
  const [selectedSign, setSelectedSign] = useState(null); // Stores currently displayed saved sign

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Load saved signs from localStorage on mount
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
      drawOnCanvas(results.multiHandLandmarks);
    });

    // Request access to the front camera
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Error accessing webcam:", err));

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();
  }, []);

  // Function to draw hand landmarks on the canvas
  const drawOnCanvas = (landmarks) => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    // Clear canvas before drawing
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Flip canvas horizontally
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);

    if (landmarks) {
      landmarks.forEach((points) => {
        points.forEach((point) => {
          canvasCtx.beginPath();
          canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
          canvasCtx.fillStyle = selectedSign ? "blue" : "red"; // Blue for saved sign, Red for live detection
          canvasCtx.fill();
        });
      });
    }

    canvasCtx.restore();
  };

  // Function to save a sign along with detected landmarks
  const saveSign = () => {
    if (currentSign.trim() && lastLandmarks) {
      const updatedSigns = [...signs, { name: currentSign.trim(), landmarks: lastLandmarks }];
      setSigns(updatedSigns);
      localStorage.setItem("signs", JSON.stringify(updatedSigns)); // Store in localStorage
      setCurrentSign(""); // Clear input after saving
    }
  };

  // Function to continuously display a saved sign on the canvas
  const showSavedSign = (sign) => {
    setSelectedSign(sign); // Set the sign to be displayed continuously
    drawOnCanvas(sign.landmarks); // Draw the sign immediately
  };

  // Function to stop displaying a saved sign
  const clearDisplayedSign = () => {
    setSelectedSign(null);
  };

  // Function to clear all saved signs
  const clearSigns = () => {
    localStorage.removeItem("signs");
    setSigns([]);
    setSelectedSign(null);
  };

  // Continuously redraw the saved sign if selected
  useEffect(() => {
    if (selectedSign) {
      const interval = setInterval(() => {
        drawOnCanvas(selectedSign.landmarks);
      }, 100); // Redraw every 100ms to keep it visible
      return () => clearInterval(interval);
    }
  }, [selectedSign]);

  return (
    <div className="p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Train Your Custom Sign</h1>

      {/* Video & Canvas Container */}
      <div className="relative">
        <video
          ref={videoRef}
          style={{ transform: "scaleX(-1)" }} // Flip video
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

      {/* Input for sign name */}
      <input
        type="text"
        placeholder="Enter sign meaning"
        value={currentSign}
        onChange={(e) => setCurrentSign(e.target.value)}
        className="border p-2 mt-4"
      />

      {/* Save and Clear Buttons */}
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

      {/* Display saved signs */}
      {signs.length > 0 && (
        <ul className="mt-4 border p-4 w-64 rounded bg-gray-100">
          <h2 className="font-bold">Saved Signs:</h2>
          {signs.map((sign, index) => (
            <li
              key={index}
              className={`border-b p-2 last:border-0 cursor-pointer hover:bg-gray-200 ${
                selectedSign?.name === sign.name ? "bg-blue-200" : ""
              }`}
              onClick={() => showSavedSign(sign)}
            >
              {sign.name}
            </li>
          ))}
        </ul>
      )}

      {/* Close saved sign button */}
      {selectedSign && (
        <button
          onClick={clearDisplayedSign}
          className="bg-gray-500 text-white px-4 py-2 mt-2 rounded"
        >
          Close Saved Sign
        </button>
      )}
    </div>
  );
};

export default SignTrainer;
