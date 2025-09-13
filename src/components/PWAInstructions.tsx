import React, { useEffect } from 'react';
import { useI18n } from '@/i18n/context';

interface LighthousePWAScoreProps {
  onComplete?: (score: number) => void;
}

export const LighthousePWAScore: React.FC<LighthousePWAScoreProps> = ({ onComplete }) => {
  const { t } = useI18n();

  useEffect(() => {
    // Simulate PWA score calculation
    const calculatePWAScore = () => {
      const checks = {
        'Has manifest': true,
        'Service worker': 'serviceWorker' in navigator,
        'Installable': window.matchMedia('(display-mode: standalone)').matches || 'standalone' in window.navigator,
        'Icons': true,
        'Theme color': true,
        'Viewport meta': document.querySelector('meta[name="viewport"]') !== null,
        'HTTPS': location.protocol === 'https:' || location.hostname === 'localhost',
        'Offline ready': 'serviceWorker' in navigator,
      };

      const passed = Object.values(checks).filter(Boolean).length;
      const total = Object.keys(checks).length;
      const score = Math.round((passed / total) * 100);

      console.log('PWA Audit Results:', checks);
      console.log(`PWA Score: ${score}/100`);

      if (onComplete) {
        onComplete(score);
      }

      return score;
    };

    // Run check after component mounts
    setTimeout(calculatePWAScore, 1000);
  }, [onComplete]);

  return null; // This is a utility component
};

export const PWAInstructions: React.FC = () => {
  const { t } = useI18n();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">✅ App Installed Successfully!</h3>
        <p className="text-sm text-green-700">
          You're using the installed version of Gas Transfer Calculator with full offline support.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
      <h3 className="font-semibold text-blue-800">📱 Add to Home Screen</h3>
      
      {isIOS && (
        <div className="text-sm text-blue-700 space-y-2">
          <p className="font-medium">On iOS:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Tap the <strong>Share</strong> button (□↑) in Safari</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> to install the app</li>
          </ol>
          <p className="text-xs opacity-75">
            The app will work offline and feel like a native app once installed.
          </p>
        </div>
      )}

      {isAndroid && (
        <div className="text-sm text-blue-700 space-y-2">
          <p className="font-medium">On Android:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Tap the <strong>three dots menu</strong> (⋮) in Chrome</li>
            <li>Select <strong>"Add to Home screen"</strong></li>
            <li>Tap <strong>"Add"</strong> to install the app</li>
          </ol>
          <p className="text-xs opacity-75">
            Or look for the install prompt that appears at the bottom of the screen.
          </p>
        </div>
      )}

      {!isIOS && !isAndroid && (
        <div className="text-sm text-blue-700 space-y-2">
          <p className="font-medium">On Desktop:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Look for the <strong>install icon</strong> (⊕) in the address bar</li>
            <li>Click it and select <strong>"Install"</strong></li>
            <li>The app will open in its own window</li>
          </ol>
          <p className="text-xs opacity-75">
            You can also use Ctrl+Shift+A (or Cmd+Shift+A on Mac) to install.
          </p>
        </div>
      )}

      <div className="pt-2 border-t border-blue-200">
        <p className="text-xs text-blue-600">
          <strong>Benefits:</strong> Offline calculations, faster loading, native app experience, 
          desktop shortcuts, and automatic updates.
        </p>
      </div>
    </div>
  );
};