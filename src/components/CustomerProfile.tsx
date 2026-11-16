import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import QRCode from 'react-qr-code';
import { LogOut, MessageCircle, Gift, Pizza } from 'lucide-react';

interface UserData {
  name: string;
  points: number;
  uid: string;
}

export default function CustomerProfile({ uid }: { uid: string }) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserData);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-700"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] dark:bg-stone-900 flex items-center justify-center flex-col">
        <p className="text-amber-900 dark:text-stone-100 mb-4">No se encontró el perfil.</p>
        <button onClick={handleLogout} className="text-red-700 dark:text-red-400 underline font-medium">Cerrar sesión</button>
      </div>
    );
  }

  const points = userData.points || 0;
  const slicesNeeded = 6 - points;
  const isWinner = points >= 6;

  // Get a clean base URL for scanning
  const getScanUrl = (userId: string) => {
    try {
      const url = new URL(window.location.href);
      let path = url.pathname;
      if (!path.endsWith('/')) path += '/';
      return `${url.origin}${path}?scan=${userId}`;
    } catch (e) {
      return `${window.location.origin}/?scan=${userId}`;
    }
  };

  // Generate the clip-path polygon for the progress
  const getClipPath = () => {
    if (points === 0) return 'circle(0% at 50% 50%)';
    if (points >= 6) return 'circle(100% at 50% 50%)';
    
    // For 6 slices, each is 60 degrees.
    // We'll use a polygon to reveal slices.
    const center = "50% 50%";
    const points_list = [center, "50% 0%"];
    
    if (points >= 1) points_list.push("100% 0%", "100% 25%"); // Approx 60 deg
    if (points >= 2) points_list.push("100% 75%"); // Approx 120 deg
    if (points >= 3) points_list.push("100% 100%", "50% 100%"); // 180 deg
    if (points >= 4) points_list.push("0% 100%", "0% 75%"); // Approx 240 deg
    if (points >= 5) points_list.push("0% 25%"); // Approx 300 deg
    
    // More precise coordinates for 60-degree increments in a 100x100 box
    // 0: [50, 0]
    // 1: [50 + 50*tan(60), 0] -> [50 + 86.6, 0] -> [136.6, 0] -> Clamped to [100, 0] then down to [100, 21.1]
    // Let's use SVG mask instead, it's much more reliable for exact angles.
    return ""; 
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] dark:bg-stone-900 font-sans text-amber-950 dark:text-stone-100 pb-20">
      {/* Header */}
      <header className="bg-amber-50 dark:bg-stone-900/50 text-amber-950 dark:text-amber-500 p-4 shadow-md relative overflow-hidden border-b border-amber-100 dark:border-stone-700">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
        <div className="relative z-10 flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-full shadow-sm" />
            <h1 className="font-bold text-xl">Leños Pizzería</h1>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-amber-200 dark:hover:bg-stone-800 rounded-full transition-colors text-amber-950 dark:text-stone-400" aria-label="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 mt-4 space-y-6">
        {/* Welcome & Message */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-400">¡Hola, {userData.name}!</h2>
          {isWinner ? (
            <div className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 p-3 rounded-xl border border-green-200 dark:border-green-800 font-medium animate-pulse">
              ¡Felicidades! Tienes una Pizzeta Gratis disponible.
            </div>
          ) : points === 5 ? (
            <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 p-3 rounded-xl border border-amber-300 dark:border-amber-700 font-medium animate-in slide-in-from-bottom-2">
              🎉 ¡Estás a un solo paso! Tu próxima visita te dará una Pizzeta Gratis.
            </div>
          ) : (
            <p className="text-amber-900 dark:text-amber-300 font-medium">
              ¡Solo te faltan <span className="text-red-700 dark:text-red-400 font-bold text-lg">{slicesNeeded}</span> porciones para tu Pizzeta gratis!
            </p>
          )}
        </div>

        {/* Logo Progress Visual */}
        <div className="bg-white dark:bg-stone-800 p-6 rounded-3xl shadow-sm border border-amber-100 dark:border-stone-700 flex flex-col items-center">
          <div className="relative w-64 h-64 mb-4">
            {/* Background Logo (Grayscale/Dark) */}
            <div className="absolute inset-0 rounded-full border-[8px] border-amber-900 bg-[#290f02] overflow-hidden shadow-xl">
              <img 
                src="/logo.png" 
                alt="Logo Background" 
                className="w-full h-full object-cover opacity-30 grayscale" 
              />
            </div>

            {/* Foreground Logo (Revealed by Slices) */}
            <div className="absolute inset-0 rounded-full border-[8px] border-transparent overflow-hidden z-10">
              <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 transform -rotate-90">
                <defs>
                  <clipPath id="logo-clip">
                    {Array.from({ length: 6 }).map((_, i) => (
                      i < points && (
                        <path
                          key={i}
                          d="M 50 50 L 50 0 A 50 50 0 0 1 93.301 25 Z"
                          transform={`rotate(${i * 60}, 50, 50)`}
                        />
                      )
                    ))}
                  </clipPath>
                </defs>
                <foreignObject x="0" y="0" width="100" height="100" clipPath="url(#logo-clip)">
                  <img 
                    src="/logo.png" 
                    alt="Logo Progress" 
                    className="w-full h-full object-cover transform rotate-90" 
                    style={{ width: '100px', height: '100px' }}
                  />
                </foreignObject>
              </svg>
            </div>

            {/* Slice Dividers */}
            <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 transform -rotate-90 z-20 pointer-events-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <line
                  key={i}
                  x1="50" y1="50"
                  x2="50" y2="0"
                  stroke="#290f02"
                  strokeWidth="0.5"
                  transform={`rotate(${i * 60}, 50, 50)`}
                  opacity="0.5"
                />
              ))}
            </svg>

            {/* Center decoration */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-30 border-2 border-amber-900">
              <span className="font-black text-red-700 text-base">{points}/6</span>
            </div>
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-200 font-bold text-center mt-2">
            {points === 0 ? '¡Haz tu primera compra para ganar un punto!' : '¡Tu logo se está completando!'}
          </p>
        </div>

        {/* QR Code Section */}
        <div className={`p-6 rounded-3xl shadow-sm border flex flex-col items-center transition-all duration-300 ${isWinner ? 'bg-gradient-to-b from-red-50 to-amber-50 dark:from-red-900/30 dark:to-amber-900/30 border-red-300 dark:border-red-900 shadow-red-100 dark:shadow-none' : 'bg-white dark:bg-stone-800 border-amber-100 dark:border-stone-700'}`}>
          <h3 className="font-bold text-amber-900 dark:text-amber-400 mb-4 text-center">
            {isWinner ? '¡Muestra este QR para canjear!' : 'Muestra este QR en caja'}
          </h3>
          
          <div className={`p-4 bg-white rounded-2xl shadow-sm mb-2 transition-all duration-300 ${isWinner ? 'ring-4 ring-red-500 ring-opacity-50 scale-105' : ''}`}>
            <QRCode 
              key={userData.uid}
              value={userData.uid} 
              size={180}
              fgColor="#000000"
            />
          </div>

          <div className="text-center mb-2">
            <span className="text-xs text-stone-500 font-mono bg-amber-50 dark:bg-stone-700/50 px-2.5 py-1 rounded-full border border-amber-200/50 dark:border-stone-600">
              Tel: {userData.phone || userData.email || userData.uid.slice(0, 8)}
            </span>
          </div>
          
          {isWinner && (
            <div className="flex items-center text-red-600 font-bold animate-bounce mt-2">
              <Gift className="w-5 h-5 mr-2" />
              ¡PREMIO DISPONIBLE!
            </div>
          )}
          {!isWinner && (
            <p className="text-xs text-amber-900 dark:text-stone-300 text-center mt-2 max-w-[200px]">
              El cajero escaneará este código para sumarte 1 punto por tu visita.
            </p>
          )}
        </div>
      </main>

      {/* WhatsApp Floating Button */}
      <a 
        href="https://wa.me/573143576422" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 hover:scale-105 transition-all z-50 flex items-center justify-center group"
        aria-label="Pedir por WhatsApp"
      >
        <MessageCircle className="w-7 h-7" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap font-medium group-hover:ml-2 group-hover:mr-1">
          Pedir a domicilio
        </span>
      </a>
    </div>
  );
}
