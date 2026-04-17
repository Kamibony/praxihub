'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

export default function QrScanner({ onScanSuccess, onScanError }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // We only want to instantiate the scanner when scanning starts
    if (isScanning && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scannerRef.current.render(
        (decodedText) => {
          onScanSuccess(decodedText);
          // Optional: we can stop scanning after a successful scan
          if (scannerRef.current) {
             scannerRef.current.clear().catch(error => {
                 console.error("Failed to clear html5QrcodeScanner. ", error);
             });
             scannerRef.current = null;
             setIsScanning(false);
          }
        },
        (errorMessage) => {
          if (onScanError) {
            onScanError(errorMessage);
          }
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner on unmount. ", error);
        });
        scannerRef.current = null;
      }
    };
  }, [isScanning, onScanSuccess, onScanError]);

  return (
    <div className="flex flex-col items-center">
      {!isScanning ? (
        <button
          onClick={() => setIsScanning(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Spustit QR Skener
        </button>
      ) : (
        <div className="w-full max-w-sm border-2 border-dashed border-blue-300 rounded-xl p-4 bg-white shadow-sm relative">
          <button
             onClick={() => {
               if (scannerRef.current) {
                 scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner. ", error);
                 });
                 scannerRef.current = null;
               }
               setIsScanning(false);
             }}
             className="absolute top-2 right-2 z-10 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
          <div id="qr-reader" className="w-full"></div>
        </div>
      )}
    </div>
  );
}
