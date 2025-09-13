import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/context';

interface PWAUpdateManagerProps {
  children: React.ReactNode;
}

export const PWAUpdateManager: React.FC<PWAUpdateManagerProps> = ({ children }) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSWRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
          setSWRegistration(registration);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content available');
                  setUpdateAvailable(true);
                  
                  toast({
                    title: '🔄 Update Available',
                    description: 'A new version of the app is ready. Tap to update.',
                    duration: 0, // Don't auto-dismiss
                    action: (
                      <button
                        onClick={handleUpdate}
                        className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded"
                      >
                        Update Now
                      </button>
                    ),
                  });
                }
              });
            }
          });

          // Check for immediate updates
          registration.update();
        })
        .catch((error) => {
          console.log('SW registration failed: ', error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          setUpdateAvailable(true);
        }
      });

      // Handle navigation events (for skipWaiting)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateAvailable) {
          window.location.reload();
        }
      });
    }

    // Add iOS PWA meta tags
    addIOSPWAMeta();

    // Handle install prompt
    handleInstallPrompt();
  }, [toast]);

  const handleUpdate = () => {
    if (swRegistration && swRegistration.waiting) {
      // Tell the waiting SW to skip waiting and become active
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
      
      toast({
        title: '🔄 Updating...',
        description: 'The app will reload with the latest version.',
        duration: 2000,
      });
    }
  };

  const addIOSPWAMeta = () => {
    // iOS specific meta tags for better PWA experience
    const iosMeta = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'GasCalc' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'msapplication-TileColor', content: '#2563eb' },
      { name: 'msapplication-tap-highlight', content: 'no' },
    ];

    iosMeta.forEach(meta => {
      let element = document.querySelector(`meta[name="${meta.name}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.name = meta.name;
        document.head.appendChild(element);
      }
      element.content = meta.content;
    });

    // iOS app icons
    const iosIcons = [
      { size: '180x180', href: '/icon-512.png' },
      { size: '167x167', href: '/icon-512.png' },
      { size: '152x152', href: '/icon-512.png' },
      { size: '120x120', href: '/icon-512.png' },
    ];

    iosIcons.forEach(icon => {
      let link = document.querySelector(`link[sizes="${icon.size}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.sizes = icon.size;
        document.head.appendChild(link);
      }
      link.href = icon.href;
    });
  };

  const handleInstallPrompt = () => {
    let deferredPrompt: any;

    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      deferredPrompt = e;

      // Show install banner after 30 seconds if not installed
      setTimeout(() => {
        if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
          toast({
            title: '📱 Add to Home Screen',
            description: 'Install this app for a better experience with offline support.',
            duration: 8000,
            action: (
              <button
                onClick={() => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult: any) => {
                      if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                      }
                      deferredPrompt = null;
                    });
                  }
                }}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded"
              >
                Install
              </button>
            ),
          });
        }
      }, 30000);
    });

    // Track if app was launched from home screen
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      deferredPrompt = null;
    });
  };

  return <>{children}</>;
};